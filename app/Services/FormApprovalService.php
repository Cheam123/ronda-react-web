<?php

namespace App\Services;

use App\Jobs\FormStageNotification;
use App\Models\Form;
use App\Models\FormSubmission;
use App\Models\FormSubmissionApproval;
use App\Models\User;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Runtime approval engine over the materialised stage rows.
 *
 * The process definition is snapshotted onto the submission at submit time
 * and materialised INCREMENTALLY into form_submission_approvals rows via a
 * cursor (FormProcessService::materializeFrom): static parts of the tree
 * materialise immediately (so future stages stay visible), while runtime
 * branches (loop arms / conditions on handler-filled fields) and
 * runtime-assignee handlers materialise only when the flow reaches them.
 * Runtime decisions therefore see the answers as they are at that moment,
 * which is what makes "loop until Status is Complete" possible.
 *
 * When a runtime-assignee handler activates and no assignee was supplied,
 * the engine throws NeedsAssigneeException inside the action's transaction:
 * the whole action rolls back and the caller returns a needs_assignee
 * payload so the client can ask "who handles this next?" and retry.
 */
class FormApprovalService
{
    private FormSchemaService $schema;
    private FormProcessService $process;

    public function __construct(?FormSchemaService $schema = null, ?FormProcessService $process = null)
    {
        $this->schema  = $schema ?? new FormSchemaService();
        $this->process = $process ?? new FormProcessService();
    }

    /**
     * Snapshot the form's process definition onto the submission and
     * materialise as much of the chain as is statically resolvable.
     * Auto-approves when the materialised chain completes with no blocking
     * nodes.
     *
     * May throw NeedsAssigneeException (runtime-assignee handler as first
     * activating step, no $nextAssigneeIds given) — call inside a
     * transaction and catch it to return a needs_assignee payload.
     */
    public function instantiate(FormSubmission $submission, Form $form, array $nextAssigneeIds = [], ?int $assignedBy = null): void
    {
        $schema     = $this->schema->normalize($form->form_elements);
        $definition = $this->process->normalize($form->process_definition);

        $submission->process_snapshot = [
            'process_version' => 1,
            'definition'      => $definition,
            'deferred_ids'    => $this->process->deferredFieldIds($definition, $schema, $this->schema),
            'chain'           => [],
            'branch_trail'    => [],
            'cursor'          => [['scope' => 'root', 'index' => 0]],
            'complete'        => false,
        ];
        $submission->status = 'pending';
        $submission->save();

        $this->advance($submission, $nextAssigneeIds, $assignedBy ?? (int) $submission->submitted_by, null);
        $this->bustTaskCaches($submission);
    }

    /**
     * Materialise everything the cursor can currently resolve, then notify
     * the (possibly new) current stage or finalise the submission. Central
     * "what happens next" step shared by instantiate/approve/completeFill.
     *
     * @param array $nextAssigneeIds handler pick for a runtime-assignee step
     * @param ?int  $assignedBy      user who made that pick (audit)
     * @param ?int  $wasCurrentId    current stage row id before the action —
     *                               a stage notification goes out only when
     *                               the current stage actually changed
     */
    private function advance(FormSubmission $submission, array $nextAssigneeIds = [], ?int $assignedBy = null, ?int $wasCurrentId = null): void
    {
        $submission->load('approvals');
        $snapshot = $submission->process_snapshot ?? [];

        // Legacy snapshots (pre-cursor, fully materialised) skip straight to
        // the notify-or-finalise step below.
        if (isset($snapshot['cursor']) && empty($snapshot['complete'])) {
            $schema  = $this->schema->normalize(optional($submission->form)->form_elements);
            $answers = $this->schema->answersById($submission->form_elements, $schema);
            $reached = !$submission->approvals->contains(fn ($row) => $row->isBlockingNode() && $row->status === 'pending');

            $result = $this->process->materializeFrom(
                $snapshot['definition'] ?? ['nodes' => []],
                $snapshot['cursor'],
                $answers,
                $snapshot['deferred_ids'] ?? [],
                $reached,
                $nextAssigneeIds
            );

            if ($result['needs'] !== null) {
                throw new NeedsAssigneeException($result['needs']);
            }

            // Archive + blank the repeated range BEFORE its rows go in, so the
            // next handler opens a clean section. Branch decisions were already
            // made above against the pre-reset answers.
            foreach ($result['rounds'] as $round) {
                $this->startRound($submission, $schema, $snapshot, $round);
            }

            $sequence = (int) ($submission->approvals->max('sequence') ?? 0);
            foreach ($result['steps'] as $step) {
                $sequence++;
                $isBlocking = in_array($step['type'] ?? '', ['approval', 'fill'], true);

                $row = $submission->approvals()->create([
                    'sequence'          => $sequence,
                    'iteration'         => (int) ($step['iteration'] ?? 1),
                    'node_id'           => $step['node_id'],
                    'node_type'         => $step['type'],
                    'source_branch_id'  => $step['source_branch_id'],
                    'name'              => $step['name'],
                    'approval_mode'     => $step['approval_mode'] ?? 'any',
                    'approver_ids'      => $isBlocking ? ($step['approver_ids'] ?? []) : ($step['user_ids'] ?? []),
                    'assigned_by'       => !empty($step['runtime_assigned']) ? $assignedBy : null,
                    'field_permissions' => $step['field_permissions'] ?? ['default' => 'read'],
                    'status'            => $isBlocking ? 'pending' : 'notified',
                    'actions'           => [],
                ]);

                if ($row->node_type === 'cc') {
                    FormStageNotification::dispatch($submission->id, 'cc', $row->id);
                }
            }

            $snapshot['cursor']           = $result['cursor'];
            $snapshot['complete']         = $result['complete'];
            $snapshot['chain']            = array_merge($snapshot['chain'] ?? [], $result['steps']);
            $snapshot['branch_trail']     = array_merge($snapshot['branch_trail'] ?? [], $result['trail']);
            $submission->process_snapshot = $snapshot;
            $submission->save();

            $submission->load('approvals');
        }

        $current = $submission->currentStage();
        if ($current) {
            if ($wasCurrentId === null || (int) $current->id !== $wasCurrentId) {
                FormStageNotification::dispatch($submission->id, 'stage', $current->id);
            }

            return;
        }

        if ($submission->status === 'pending') {
            $submission->update(['status' => 'approved']);
            FormStageNotification::dispatch($submission->id, 'outcome', null, 'approved');
        }
    }

    /**
     * A repeated range is about to run again: archive the answers it owns
     * into round_snapshots, then blank them so the next handler starts from
     * scratch. Fields outside the range (the original request) are untouched
     * — this is a new round, NOT an edit of the submission.
     */
    private function startRound(FormSubmission $submission, array $schema, array $snapshot, array $round): void
    {
        $definition = $snapshot['definition'] ?? ['nodes' => []];
        $nodeIds    = array_flip($round['node_ids'] ?? []);
        $resetIds   = [];

        foreach ($this->process->allNodes($definition) as $node) {
            if (($node['type'] ?? null) !== 'fill' || !isset($nodeIds[$node['id'] ?? ''])) {
                continue;
            }
            $permissions = $node['field_permissions'] ?? [];
            $permissions['default'] = 'read'; // only explicit "Fill" fields are owned by the step
            foreach ($this->schema->resolveFieldPermissions($schema, $permissions) as $elementId => $level) {
                if ($level === 'edit') {
                    $resetIds[$elementId] = true;
                }
            }
        }

        // Descriptions and other non-field elements have nothing to reset.
        $fieldIds = collect($schema['elements'] ?? [])
            ->filter(fn ($e) => ($e['kind'] ?? 'field') === 'field')
            ->pluck('id')
            ->flip();
        $resetIds = array_keys(array_intersect_key($resetIds, $fieldIds->all()));

        if (empty($resetIds)) {
            return;
        }

        $answers  = $this->schema->answersById($submission->form_elements, $schema);
        $previous = (int) ($round['iteration'] ?? 2) - 1;

        $archive = [
            'iteration' => $previous,
            'closed_at' => now()->toDateTimeString(),
            'actors'    => $submission->approvals
                ->filter(fn ($row) => (int) ($row->iteration ?? 1) === $previous && $row->acted_by)
                ->pluck('acted_by')
                ->map(fn ($id) => (int) $id)
                ->unique()
                ->values()
                ->all(),
            'answers'   => collect($resetIds)->mapWithKeys(fn ($id) => [$id => $answers[$id] ?? null])->all(),
        ];

        $snapshotRows = collect($submission->form_elements ?? [])->map(function ($entry) use ($resetIds) {
            if (is_array($entry) && !empty($entry['id']) && in_array($entry['id'], $resetIds, true)) {
                $entry['value'] = null;
            }

            return $entry;
        })->values()->all();

        $submission->update([
            'form_elements'   => $snapshotRows,
            'round_snapshots' => array_merge($submission->round_snapshots ?? [], [$archive]),
        ]);
    }

    /**
     * Whether the user can act on the submission right now.
     * Legacy fallback: submissions with no stage rows (pre-engine, tierless
     * forms) remain actionable by any form_admin, matching old behaviour.
     */
    public function canAct(FormSubmission $submission, User $user): bool
    {
        if ($submission->status !== 'pending') {
            return false;
        }

        $stage = $submission->currentStage();

        if (!$stage) {
            return $submission->approvals->isEmpty() && $user->can('form_admin');
        }

        return $stage->hasApprover((int) $user->id) && !$stage->hasActed((int) $user->id);
    }

    /**
     * Users the current stage is waiting on (for "waiting for X" hints).
     *
     * @return array<int>
     */
    public function waitingOn(FormSubmission $submission): array
    {
        $stage = $submission->currentStage();
        if (!$stage) {
            return [];
        }

        $acted = collect($stage->actions ?? [])->pluck('user_id')->map(fn ($id) => (int) $id)->all();

        return array_values(array_filter(
            array_map('intval', $stage->approver_ids ?? []),
            fn ($id) => !in_array($id, $acted, true)
        ));
    }

    /**
     * @param array $nextAssigneeIds handler pick when this approval activates
     *                               a runtime-assignee step
     * @return array{ok: bool, message: string, needs_assignee?: array}
     */
    public function approve(FormSubmission $submission, User $user, ?string $remark = null, array $nextAssigneeIds = []): array
    {
        if (!$this->canAct($submission, $user)) {
            return ['ok' => false, 'message' => 'You cannot act on this submission at its current stage.'];
        }

        $stage = $submission->currentStage();

        if ($stage && $stage->isFillNode()) {
            return ['ok' => false, 'message' => 'This stage is a fill phase — complete the assigned section instead.'];
        }

        // Legacy fallback: no stage rows -> direct admin approval with an audit row.
        if (!$stage) {
            $submission->approvals()->create([
                'sequence'          => 1,
                'node_id'           => 'nd_adhoc',
                'node_type'         => 'approval',
                'name'              => 'Admin Approval',
                'approval_mode'     => 'any',
                'approver_ids'      => [(int) $user->id],
                'field_permissions' => ['default' => 'read'],
                'status'            => 'approved',
                'actions'           => [$this->action($user, 'approved', $remark)],
                'acted_by'          => $user->id,
                'acted_at'          => now(),
                'remark'            => $remark,
            ]);
            $submission->update(['status' => 'approved']);

            return ['ok' => true, 'message' => 'Submission approved.'];
        }

        $actions   = collect($stage->actions ?? [])->push($this->action($user, 'approved', $remark))->values()->all();
        $actedIds  = collect($actions)->pluck('user_id')->map(fn ($id) => (int) $id)->unique();
        $required  = collect($stage->approver_ids ?? [])->map(fn ($id) => (int) $id)->unique();
        $completed = $stage->approval_mode === 'any' || $required->diff($actedIds)->isEmpty();

        $stageData = [
            'actions'  => $actions,
            'status'   => $completed ? 'approved' : 'pending',
            'acted_by' => $completed ? $user->id : null,
            'acted_at' => $completed ? now() : null,
            'remark'   => $completed ? $remark : null,
        ];

        if (!$completed) {
            $stage->update($stageData);
            $this->bustTaskCaches($submission);

            return ['ok' => true, 'message' => 'Your approval has been recorded; waiting on other approvers.'];
        }

        try {
            DB::transaction(function () use ($stage, $stageData, $submission, $user, $nextAssigneeIds) {
                $stage->update($stageData);
                $this->advance($submission, $nextAssigneeIds, (int) $user->id, (int) $stage->id);
            });
        } catch (NeedsAssigneeException $e) {
            return [
                'ok'             => false,
                'needs_assignee' => $e->node,
                'message'        => 'Choose who should handle "' . ($e->node['name'] ?? 'the next step') . '".',
            ];
        }

        $this->bustTaskCaches($submission);

        return ['ok' => true, 'message' => 'Stage approved.'];
    }

    /**
     * @return array{ok: bool, message: string}
     */
    public function reject(FormSubmission $submission, User $user, string $remark): array
    {
        if (!$this->canAct($submission, $user)) {
            return ['ok' => false, 'message' => 'You cannot act on this submission at its current stage.'];
        }

        $stage = $submission->currentStage();

        if ($stage && $stage->isFillNode()) {
            return ['ok' => false, 'message' => 'This stage is a fill phase — it can only be completed, not rejected.'];
        }

        if ($stage) {
            $stage->update([
                'actions'  => collect($stage->actions ?? [])->push($this->action($user, 'rejected', $remark))->values()->all(),
                'status'   => 'rejected',
                'acted_by' => $user->id,
                'acted_at' => now(),
                'remark'   => $remark,
            ]);
        }

        $submission->update([
            'status'          => 'rejected',
            'rejected_by'     => $user->id,
            'rejected_remark' => $remark,
        ]);

        FormStageNotification::dispatch($submission->id, 'outcome', null, 'rejected');
        $this->bustTaskCaches($submission);

        return ['ok' => true, 'message' => 'Submission rejected.'];
    }

    /**
     * A fill-phase assignee completes their section: merges the submitted
     * values for that stage's editable fields into the answers snapshot and
     * advances the chain.
     *
     * @param array $fieldUpdates    element id => value
     * @param array $nextAssigneeIds handler pick when completing this section
     *                               activates a runtime-assignee step (e.g. a
     *                               loop round on "Status is Pending")
     * @return array{ok: bool, message: string, errors?: array<string,string>, needs_assignee?: array}
     */
    public function completeFill(FormSubmission $submission, User $user, array $fieldUpdates, array $nextAssigneeIds = []): array
    {
        if (!$this->canAct($submission, $user)) {
            return ['ok' => false, 'message' => 'You cannot act on this submission at its current stage.'];
        }

        $stage = $submission->currentStage();

        if (!$stage || !$stage->isFillNode()) {
            return ['ok' => false, 'message' => 'The current stage is not a fill phase.'];
        }

        $form   = $submission->form;
        $schema = $this->schema->normalize(optional($form)->form_elements);

        // Only fields this stage marks as "edit" may be written.
        $permissions = $this->schema->resolveFieldPermissions($schema, $stage->field_permissions ?: []);
        $editableIds = array_keys(array_filter($permissions, fn ($level) => $level === 'edit'));

        $answers    = $this->schema->answersById($submission->form_elements, $schema);
        $elements   = collect($schema['elements'] ?? [])->keyBy('id');
        $evaluator  = new FormConditionEvaluator();
        $errors     = [];

        foreach ($fieldUpdates as $elementId => $value) {
            if (!in_array($elementId, $editableIds, true)) {
                continue;
            }

            // Person pickers decide who handles later steps — only active
            // people the field offers may be written (or the answer already
            // there, kept as it was).
            $element = $elements->get($elementId);
            if ($element && ($element['type'] ?? '') === 'user' && !$evaluator->isEmptyValue($value)) {
                $picked  = (int) (is_array($value) ? reset($value) : $value);
                $refusal = $this->schema->personPickError($element, $picked, $answers[$elementId] ?? null);
                if ($refusal) {
                    $errors[$elementId] = $refusal;
                    continue;
                }
                $value = $picked;
            }

            // Location stamps must be a real coordinate pair, same as on submit.
            if ($element && ($element['type'] ?? '') === 'gps') {
                $gps = $this->schema->normalizeGps($element, $value);
                if ($gps['error'] !== null) {
                    $errors[$elementId] = $gps['error'];
                    continue;
                }
                $value = $gps['value'];
            }

            $answers[$elementId] = $value;
        }

        if (!empty($errors)) {
            return ['ok' => false, 'message' => 'Please correct the highlighted fields.', 'errors' => $errors];
        }

        // Re-resolve visibility with the merged answers; enforce mandatory
        // for this stage's visible editable fields.
        $visibility = $this->schema->resolveVisibility($schema, $answers);

        foreach ($editableIds as $elementId) {
            $element = $elements->get($elementId);
            if (!$element || ($element['kind'] ?? 'field') !== 'field') {
                continue;
            }
            if (($visibility[$elementId] ?? true)
                && ($element['mandatory'] ?? false)
                && $evaluator->isEmptyValue($answers[$elementId] ?? null)) {
                $errors[$elementId] = ($element['label'] ?? 'This field') . ' is required.';
            }
        }

        if (!empty($errors)) {
            return ['ok' => false, 'message' => 'Please complete all required fields in your section.', 'errors' => $errors];
        }

        // Write the merged values back into the snapshot (hidden flags refresh too).
        $snapshot = collect($submission->form_elements ?? [])->map(function ($entry) use ($editableIds, $answers, $visibility) {
            if (!is_array($entry) || empty($entry['id'])) {
                return $entry;
            }
            $id = $entry['id'];
            if (in_array($id, $editableIds, true)) {
                $entry['value'] = $answers[$id] ?? null;
            }
            $entry['hidden'] = !($visibility[$id] ?? true);
            return $entry;
        })->values()->all();

        try {
            DB::transaction(function () use ($submission, $snapshot, $stage, $user, $nextAssigneeIds) {
                $submission->update(['form_elements' => $snapshot]);

                $stage->update([
                    'actions'  => collect($stage->actions ?? [])->push($this->action($user, 'completed', null))->values()->all(),
                    'status'   => 'completed',
                    'acted_by' => $user->id,
                    'acted_at' => now(),
                ]);

                $this->advance($submission, $nextAssigneeIds, (int) $user->id, (int) $stage->id);
            });
        } catch (NeedsAssigneeException $e) {
            // Whole action rolled back — the client re-submits the section
            // together with the chosen handler.
            $submission->refresh();
            $stage->refresh();

            return [
                'ok'             => false,
                'needs_assignee' => $e->node,
                'message'        => 'Choose who should handle "' . ($e->node['name'] ?? 'the next step') . '".',
            ];
        }

        $this->bustTaskCaches($submission);

        return ['ok' => true, 'message' => 'Your section has been submitted.'];
    }

    /**
     * Submissions currently awaiting this user's action (approvals and fill phases).
     */
    public function pendingFor(User $user)
    {
        return FormSubmission::with(['form.group', 'submittedBy', 'approvals'])
            ->where('status', 'pending')
            ->whereHas('approvals', function ($q) use ($user) {
                $q->whereIn('node_type', ['approval', 'fill'])
                  ->where('status', 'pending')
                  ->whereJsonContains('approver_ids', (int) $user->id);
            })
            ->orderBy('created_at', 'desc')
            ->get()
            ->filter(fn ($submission) => $this->canAct($submission, $user))
            ->values();
    }

    /**
     * Whether the user participates (approver or CC) in any stage of the submission.
     */
    public function isParticipant(FormSubmission $submission, User $user): bool
    {
        return $submission->approvals->contains(fn ($row) => $row->hasApprover((int) $user->id));
    }

    /**
     * Cached count of submissions awaiting this user's action RIGHT NOW —
     * drives the "Form Tasks" menu badge. Uses pendingFor() so future stages
     * (rows that exist but aren't current yet) don't inflate the badge.
     * Busted on every stage transition.
     */
    public static function pendingCountFor(int $userId): int
    {
        return (int) Cache::remember("form_tasks_count_{$userId}", 300, function () use ($userId) {
            $user = User::find($userId);

            return $user ? app(self::class)->pendingFor($user)->count() : 0;
        });
    }

    public static function userHasPendingApprovals(int $userId): bool
    {
        return self::pendingCountFor($userId) > 0;
    }

    /**
     * Bust the task-count cache for everyone involved in a submission
     * (all stage participants + the submitter). Public because an entry can
     * also stop being someone's task from outside the engine — closing a
     * record cancels whatever it had in flight.
     */
    public function bustTaskCaches(FormSubmission $submission): void
    {
        $ids = [(int) $submission->submitted_by];
        foreach ($submission->approvals as $row) {
            foreach (($row->approver_ids ?? []) as $id) {
                $ids[] = (int) $id;
            }
        }
        foreach (array_unique($ids) as $id) {
            Cache::forget("form_tasks_count_{$id}");
        }
    }

    private function action(User $user, string $action, ?string $remark): array
    {
        return [
            'user_id' => (int) $user->id,
            'action'  => $action,
            'at'      => now()->toDateTimeString(),
            'remark'  => $remark,
        ];
    }

    /* ---------------------------------------------------------------
     *  Reading back what earlier rounds answered
     *
     *  startRound() above blanks a repeated phase's answers out of
     *  form_elements and keeps them in round_snapshots. These two methods are
     *  the only way to read them back, and both the web entry page and the
     *  mobile entry payload go through them so the two never drift.
     * --------------------------------------------------------------- */

    /**
     * Every archived round, newest first, with ids resolved to names and each
     * answer given the label/type its schema element carries.
     *
     * Stored shape: {iteration, closed_at, actors:[user id], answers:{el id => value}}
     *
     * @param  array  $permissions  fieldPermissionsForViewer(): 'hidden' fields are dropped
     * @return array  [['round','closed_at','handled_by','answers'], ...]
     */
    public function previousRounds(FormSubmission $submission, array $schema, array $permissions = []): array
    {
        $snapshots = $submission->round_snapshots ?? [];
        if (empty($snapshots)) {
            return [];
        }

        $elementMap = collect($schema['elements'] ?? [])->keyBy('id');
        $actorNames = User::whereIn('id', collect($snapshots)->pluck('actors')->flatten()->filter()->unique())
            ->pluck('name', 'id');

        return collect($snapshots)
            ->map(fn ($round) => [
                'round'      => (int) ($round['iteration'] ?? 1),
                'closed_at'  => $round['closed_at'] ?? null,
                'handled_by' => collect($round['actors'] ?? [])
                                  ->filter(fn ($id) => isset($actorNames[$id]))
                                  ->map(fn ($id) => ['id' => (int) $id, 'name' => $actorNames[$id]])
                                  ->values()->all(),
                'answers'    => collect($round['answers'] ?? [])
                                  ->reject(fn ($v, $elementId) => ($permissions[$elementId] ?? 'read') === 'hidden')
                                  ->map(fn ($value, $elementId) => [
                                      'id'    => $elementId,
                                      'label' => $elementMap[$elementId]['label'] ?? $elementId,
                                      'type'  => $elementMap[$elementId]['type'] ?? 'text',
                                      'value' => $value,
                                      'text'  => $this->answerPreview($elementMap[$elementId]['type'] ?? 'text', $value),
                                  ])
                                  ->values()->all(),
            ])
            ->sortByDesc('round')
            ->values()
            ->all();
    }

    /**
     * The last thing each of $elementIds was answered with, for showing beside
     * the inputs a handler is about to fill in again.
     *
     * Reference only — never pre-filled into the form. A new round is a fresh
     * answer, so a stale value must not be able to reach a submit untouched.
     *
     * Rounds arrive newest-first, so the first value found per field wins: a
     * field answered in round 1 but skipped in round 2 still reports round 1's.
     *
     * @param  array  $rounds  output of previousRounds()
     * @return array  [element id => ['value','text','round','actor']]
     */
    public function latestPreviousAnswers(array $rounds, array $elementIds): array
    {
        if (empty($rounds) || empty($elementIds)) {
            return [];
        }

        $wanted = array_flip($elementIds);
        $found  = [];

        foreach ($rounds as $round) {
            foreach ($round['answers'] as $answer) {
                $id = $answer['id'];
                if (!isset($wanted[$id]) || isset($found[$id])) {
                    continue;
                }
                if ($answer['value'] === null || $answer['value'] === '' || $answer['value'] === []) {
                    continue; // an unanswered field is not worth showing
                }

                $found[$id] = [
                    'value' => $answer['value'],
                    'text'  => $answer['text'],
                    'round' => $round['round'],
                    'actor' => collect($round['handled_by'])->pluck('name')->implode(', '),
                ];
            }
        }

        return $found;
    }

    /** One short line describing an answer, for the previous-round hint. */
    private function answerPreview(string $type, $value): string
    {
        if ($type === 'user') {
            return (string) $this->schema->userLabel($value);
        }

        if ($type === 'file') {
            $count = is_array($value) ? count($value) : 0;

            return $count === 1 ? '1 attachment' : "{$count} attachments";
        }

        if ($type === 'gps') {
            return is_array($value) && isset($value['lat'], $value['lng'])
                ? $value['lat'] . ', ' . $value['lng']
                : '';
        }

        if (is_array($value)) {
            return collect($value)->filter(fn ($v) => is_scalar($v) && $v !== '')->implode(', ');
        }

        return (string) $value;
    }
}
