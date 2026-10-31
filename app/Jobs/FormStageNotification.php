<?php

namespace App\Jobs;

use App\Models\FormSubmission;
use App\Models\User;
use App\Services\AlertInbox;
use App\Services\FirebaseService;
use App\Services\FormRecordService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Push notifications for form process transitions.
 *
 * Modes:
 *  - stage:   a blocking stage became current -> notify its pending
 *             approvers/assignees ("your turn")
 *  - cc:      notify CC recipients they were copied on a submission
 *  - outcome: notify the submitter of the final result (approved/rejected)
 *
 * MOBILE CONTRACT — the app routes on the `data` block, so it is fixed:
 *
 *   data.type = "formtask"   a stage is waiting for the recipient to act
 *               "formentry"  no action needed (an outcome, or a CC copy)
 *   data.id   = the ENTRY id, as a string (FCM data values must be strings).
 *               Not the record id, and not the stage id.
 *
 * Both types open the same screen; they are separate names so analytics and
 * future routing can tell "your turn" apart from "for your information".
 *
 * Two things must never appear on a forms push (the server no longer sends
 * GPS pings, but installed app builds still special-case both):
 *  - `notification_id` — both RN message handlers read that key as a GPS /
 *    app-time ping and POST to sendAppTime.
 *  - type "gps" — special-cased in the app to suppress display.
 *
 * The `notification` block is what makes the OS draw the notification and
 * deliver the tap to the already-wired firebase handlers; FirebaseService
 * always sends it, so these stay ordinary notification+data messages rather
 * than data-only pushes (which take a different path in the app).
 *
 * Defensive by design: users without an fcm_token are skipped and every
 * send failure is logged, never thrown — a notification must not break
 * the approval flow.
 */
class FormStageNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 60;

    protected int $submissionId;
    protected string $mode;      // stage | cc | outcome
    protected ?int $stageId;     // form_submission_approvals id (stage/cc modes)
    protected ?string $outcome;  // approved | rejected (outcome mode)

    public function __construct(int $submissionId, string $mode, ?int $stageId = null, ?string $outcome = null)
    {
        $this->submissionId = $submissionId;
        $this->mode         = $mode;
        $this->stageId      = $stageId;
        $this->outcome      = $outcome;

        // The approval engine dispatches from inside DB transactions (which may
        // roll back on a needs-assignee pause) — never push about uncommitted
        // or rolled-back stage rows. Set on the trait's property rather than
        // redeclaring it (a differing default is an incompatible redefinition).
        $this->afterCommit = true;
    }

    public function handle()
    {
        try {
            $submission = FormSubmission::with(['form', 'submittedBy', 'rejectedBy', 'approvals.actedBy'])
                ->find($this->submissionId);
            if (!$submission) {
                return;
            }

            $formName  = optional($submission->form)->name ?? 'a form';
            $submitter = optional($submission->submittedBy)->name ?? 'someone';
            // What the record is called beats what it is numbered: "Acme CNC-220
            // coolant leak" tells you what this is about, REC-1102 does not.
            // The reference still rides along on the context line.
            $subject   = app(FormRecordService::class)->titleFor($submission);
            $context   = $formName . ' · ' . $submission->recordReference();

            if ($this->mode === 'outcome') {
                $approved = $this->outcome === 'approved';
                $title    = $approved ? 'Submission approved' : 'Submission rejected';

                // Who decided, and why. On a rejection the reason is the whole
                // point of the notification — without it the submitter has to
                // open the app just to find out what to fix.
                if ($approved) {
                    $decision = $submission->approvals
                        ->filter(fn ($row) => $row->acted_by && $row->status === 'approved')
                        ->sortByDesc('acted_at')
                        ->first();
                    $by     = optional(optional($decision)->actedBy)->name;
                    $remark = optional($decision)->remark;
                } else {
                    $by     = optional($submission->rejectedBy)->name;
                    $remark = $submission->rejected_remark;
                }

                $body = $this->lines([
                    $subject,
                    $context,
                    $by ? ($approved ? 'Approved by ' : 'Rejected by ') . $by : null,
                    trim((string) $remark) !== '' ? ($approved ? 'Note: ' : 'Reason: ') . trim($remark) : null,
                ]);

                // formentry: nothing is waiting on the recipient.
                $this->push($submission->submittedBy, $title, $body, [
                    'type' => 'formentry',
                    'id'   => (string) $submission->id,
                ]);
                return;
            }

            $stage = $submission->approvals->firstWhere('id', $this->stageId);
            if (!$stage) {
                return;
            }

            $actedIds = collect($stage->actions ?? [])->pluck('user_id')->map(fn ($id) => (int) $id)->all();
            $userIds  = array_values(array_filter(
                array_map('intval', $stage->approver_ids ?? []),
                fn ($id) => !in_array($id, $actedIds, true)
            ));

            if ($this->mode === 'cc') {
                $title = 'Copied on a form';
                $lines = [$subject, $context, 'Submitted by ' . $submitter];
            } elseif ($stage->node_type === 'fill') {
                $title = 'Your section is ready to fill';
                // The step name is the instruction ("Technician Section"), so it
                // leads; the subject says which job it belongs to.
                $lines = [$stage->name . ' — ' . $subject, $context, 'Submitted by ' . $submitter];
            } else {
                $title = 'Waiting for your approval';
                $lines = [$stage->name . ' — ' . $subject, $context, 'Submitted by ' . $submitter];
            }

            $body = $this->lines($lines);

            // A CC is a copy, not a task: nothing is waiting on the recipient,
            // so it routes as an entry even though it comes from a stage row.
            $data = [
                'type' => $this->mode === 'cc' ? 'formentry' : 'formtask',
                'id'   => (string) $submission->id,
            ];

            foreach (User::whereIn('id', $userIds)->get() as $user) {
                $this->push($user, $title, $body, $data);
            }
        } catch (\Throwable $e) {
            Log::error('FormStageNotification failed', [
                'submission_id' => $this->submissionId,
                'mode'          => $this->mode,
                'error'         => $e->getMessage(),
            ]);
        }
    }

    /**
     * Joins the body lines, dropping the ones that had nothing to say — a
     * missing remark or an unnamed actor must not leave a blank line or a
     * dangling label in the tray.
     */
    private function lines(array $lines): string
    {
        return implode("\n", array_filter(
            array_map(fn ($line) => trim((string) $line), $lines),
            fn ($line) => $line !== ''
        ));
    }

    private function push(?User $user, string $title, string $body, array $data): void
    {
        // Saved to the app's inbox for everyone, even with no device to push to.
        AlertInbox::record($user, $title, $body, $data);

        if (!$user || !$user->fcm_token) {
            return;
        }

        try {
            app(FirebaseService::class)->sendToDevice($user->fcm_token, $title, $body, $data);
        } catch (\Throwable $e) {
            Log::warning('FormStageNotification push failed', [
                'user_id' => $user->id,
                'error'   => $e->getMessage(),
            ]);
        }
    }
}
