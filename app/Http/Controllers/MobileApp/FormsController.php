<?php

namespace App\Http\Controllers\MobileApp;

use App\Helpers\Helper;
use App\Http\Controllers\Controller;
use App\Models\Form;
use App\Models\FormGroup;
use App\Models\FormSubmission;
use App\Models\User;
use App\Services\FormApprovalService;
use App\Services\FormRecordService;
use App\Services\FormProcessService;
use App\Services\FormSchemaService;
use App\Services\FormUploadService;
use App\Services\NeedsAssigneeException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class FormsController extends Controller
{
  private FormSchemaService $schemaService;
  private FormProcessService $processService;
  private FormApprovalService $approvalService;
  private FormRecordService $recordService;

  public function __construct(FormSchemaService $schemaService,
                              FormProcessService $processService,
                              FormApprovalService $approvalService,
                              FormRecordService $recordService)
  {
    $this->schemaService   = $schemaService;
    $this->processService  = $processService;
    $this->approvalService = $approvalService;
    $this->recordService   = $recordService;
  }

  public function getAllForms(Request $request)
  {
    try {
      // Arranged, not alphabetical: the app should list forms in the order an
      // admin put them in, the same as the web.
      $query = Form::with('group')->where('is_enabled', 1)->arranged();

      if ($request->filled('search')) {
        $search = $request->input('search');
        $query->where(function ($q) use ($search) {
          $q->where('name', 'like', "%{$search}%")
            ->orWhere('description', 'like', "%{$search}%");
        });
      }

      $user = $request->user();

      $forms = $query->get()
        ->filter(fn ($form) => $this->schemaService->canSubmit($form->settings, $user))
        ->map(function ($form) {
          return [
            'id'                  => $form->id,
            'name'                => $form->name,
            'description'         => $form->description,
            'number_of_elements'  => count($form->schema['elements'] ?? []),
            // Section the form is filed under. null when it is ungrouped —
            // render those last, under a neutral heading.
            'group'               => $form->group ? [
              'id'   => $form->group->id,
              'name' => $form->group->name,
            ] : null,
          ];
        })->values();

      // Section headings in the order an admin arranged them, limited to the
      // groups this caller actually has a form in — an empty heading would
      // hint at forms they cannot submit.
      $usedGroupIds = $forms->pluck('group.id')->filter()->unique();
      $groups = FormGroup::ordered()->get()
        ->whereIn('id', $usedGroupIds)
        ->map(fn ($group) => ['id' => $group->id, 'name' => $group->name])
        ->values();

      return $this->response_ok([
        'forms'       => $forms,
        // NOT the same as form.groups, which is the schema's field sections.
        'form_groups' => $groups,
      ], 'Forms retrieved successfully.');
    } catch (\Throwable $e) {
      Log::error('Mobile getAllForms failed', ['error' => $e->getMessage()]);
      return $this->response_failed('Failed to retrieve forms.', $e->getMessage());
    }
  }

  /**
   * The form definition.
   *
   * Two different people need this and only one of them is starting a form:
   * the submitter picking it off the Start screen, and a handler rendering the
   * inputs for a stage assigned to them. Gating on "may you submit" alone
   * refused the handler — who then saw an empty section and no way to act.
   */
  public function getForm(Request $request, $id)
  {
    try {
      $form = Form::find($id);

      if (!$form) {
        return $this->response_failed('Form not found.');
      }

      $user = $request->user();

      // A disabled form takes no NEW submissions, but work already in flight
      // still has to be finishable.
      $maySubmit = $form->is_enabled
                   && $this->schemaService->canSubmit($form->settings, $user);

      // Anyone who submitted, or is named on a stage of, any entry of this
      // form. Structure only — the answers still come from getEntry, which is
      // filtered per viewer.
      $involved = $this->recordService->visibleFor($user)
                       ->where('form_id', $form->id)
                       ->exists();

      if (!$maySubmit && !$involved) {
        // Don't reveal that a disabled form exists to someone with no claim on it.
        return $this->response_failed($form->is_enabled
          ? 'You do not have access to this form.'
          : 'Form not found.');
      }

      $payload = $this->formPayload($form);
      // So the app knows whether this definition was fetched to start something
      // or merely to render a stage it was assigned.
      $payload['can_submit'] = $maySubmit;

      return $this->response_ok([
        'form' => $payload,
      ], 'Form retrieved successfully.');
    } catch (\Throwable $e) {
      Log::error('Mobile getForm failed', ['error' => $e->getMessage(), 'form_id' => $id]);
      return $this->response_failed('Failed to retrieve form.', $e->getMessage());
    }
  }

  /* =====================================================================
   *  MY RECORDS
   * ===================================================================== */

  /** Records the caller opened or took part in (one row per record). */
  public function getRecords(Request $request)
  {
    try {
      $user  = $request->user();
      $query = $this->recordService->visibleFor($user)->with(['form.group', 'submittedBy', 'approvals']);

      if ($request->filled('form_id')) {
        $query->where('form_id', $request->input('form_id'));
      }
      if ($request->filled('group_id')) {
        $query->whereHas('form', fn ($q) => $q->where('form_group_id', $request->input('group_id')));
      }
      if ($request->filled('status')) {
        // Mirrors the web: closed is a record property, not an entry status.
        if ($request->input('status') === 'closed') {
          $query->where('record_status', 'closed');
        } else {
          $query->where('status', $request->input('status'))
                ->where(fn ($q) => $q->where('record_status', '!=', 'closed')
                                      ->orWhereNull('record_status'));
        }
      }

      $roots = $query->with('parent')->orderBy('created_at', 'desc')->get();

      $records = $roots->map(function ($root) {
        $summary = $this->recordService->summarize($root);

        return [
          // A case and its submission are the same row now; `record_id` is kept
          // as an alias of `id` so the app keeps working. Deprecated - read
          // `id`, and this key will go once nothing depends on it.
          'record_id'        => $root->id,
          'id'               => $root->id,
          'reference'        => $summary['reference'],
          'title'            => $summary['title'],
          'form_id'          => $root->form_id,
          'form_name'        => optional($root->form)->name,
          // The form's group, so My Records can be sectioned or filtered the
          // same way Start is (?group_id= narrows this list).
          'group'            => optional($root->form)->group ? [
            'id'   => $root->form->group->id,
            'name' => $root->form->group->name,
          ] : null,
          'record_status'    => $root->record_status,
          // 'closed' once an admin closes the record, whatever the last entry
          // did; entry_status keeps that underlying outcome available.
          'status'           => $summary['status'],
          'entry_status'     => $summary['entry_status'],
          'current_stage'    => $summary['stage_name'],
          'waiting_on'       => $summary['waiting_on'],
          'opened_by'        => optional($root->submittedBy)->name,
          'opened_at'        => optional($root->created_at)->toDateTimeString(),
          'updated_at'       => optional($summary['updated_at'])->toDateTimeString(),
          // The case this one follows up on, or null. Enough to show a "return
          // visit" marker in a list without a second request.
          'parent'           => $root->parent ? [
            'id'        => $root->parent->id,
            'reference' => $root->parent->recordReference(),
            'title'     => $this->recordService->titleFor($root->parent),
          ] : null,
        ];
      })->values();

      return $this->response_ok(['records' => $records], 'Records retrieved successfully.');
    } catch (\Throwable $e) {
      Log::error('Mobile getRecords failed', ['error' => $e->getMessage()]);
      return $this->response_failed('Failed to retrieve records.', $e->getMessage());
    }
  }

  /** One case, plus the cases it links to. */
  public function getRecord(Request $request, $id)
  {
    try {
      $root = FormSubmission::with(['form.group', 'submittedBy', 'recordClosedBy', 'parent'])
        ->find($id);

      if (!$root) {
        return $this->response_failed('Record not found.');
      }
      if (!$this->recordService->canView($root, $request->user())) {
        return $this->response_failed('You do not have access to this record.');
      }

      // Both directions are filtered to what this caller may see: a case link
      // must not become a side channel onto work they have no part in.
      $user     = $request->user();
      $parent   = $root->parent && $this->recordService->canView($root->parent, $user) ? $root->parent : null;
      $children = $root->children()->with('submittedBy')->get()
        ->filter(fn ($child) => $this->recordService->canView($child, $user))
        ->values();

      return $this->response_ok([
        'record' => [
          // Deprecated alias of `id` — see getRecords().
          'record_id'        => $root->id,
          'id'               => $root->id,
          'reference'        => $root->recordReference(),
          'title'            => $this->recordService->titleFor($root),
          'form_id'          => $root->form_id,
          'form_name'        => optional($root->form)->name,
          'group'            => optional($root->form)->group ? [
            'id'   => $root->form->group->id,
            'name' => $root->form->group->name,
          ] : null,
          'record_status'    => $root->record_status,
          // Closing a record cancels whatever was in flight, so a handler can
          // lose a task without acting. Ship the reason or the app cannot
          // explain the disappearance.
          'closed'           => $root->isRecordOpen() ? null : [
            'remark'    => $root->record_closed_remark,
            'closed_by' => optional($root->recordClosedBy)->name,
            'closed_at' => optional($root->record_closed_at)->toDateTimeString(),
          ],
          'opened_by'        => optional($root->submittedBy)->name,
          'opened_at'        => optional($root->created_at)->toDateTimeString(),
          // A follow-up may be started from any case that is not itself a
          // follow-up — completed and closed ones included, which is the point.
          'can_follow_up'    => $root->canBeParent()
                                && $this->schemaService->canSubmit(optional($root->form)->settings, $user),
          // Same rule as the web: the opener or a form admin, while it is open.
          'can_close'        => $root->isRecordOpen() && $this->recordService->canClose($root, $user),
          // Who the open step waits on, as names, the same as My Records
          // (empty once nobody owes anything), so the trail can name them.
          'waiting_on'       => $this->recordService->summarize($root)['waiting_on'],
          'parent'           => $parent ? [
            'id'        => $parent->id,
            'reference' => $parent->recordReference(),
            'title'     => $this->recordService->titleFor($parent),
            'status'    => $parent->status,
          ] : null,
          'children'         => $children->map(fn ($child) => [
            'id'            => $child->id,
            'reference'     => $child->recordReference(),
            'title'         => $this->recordService->titleFor($child),
            'status'        => $child->status,
            'submitted_by'  => optional($child->submittedBy)->name,
            'submitted_at'  => optional($child->created_at)->toDateTimeString(),
            'current_stage' => optional($child->currentStage())->name,
          ])->values(),
        ],
      ], 'Record retrieved successfully.');
    } catch (\Throwable $e) {
      Log::error('Mobile getRecord failed', ['error' => $e->getMessage(), 'record_id' => $id]);
      return $this->response_failed('Failed to retrieve record.', $e->getMessage());
    }
  }

  /**
   * Close a case, the same as the web's closeRecord: a reason is required,
   * and a case still in progress is cancelled with it so no handler is left
   * holding a live task against it.
   */
  public function closeRecord(Request $request, $id)
  {
    try {
      $request->validate(
        ['remark' => 'required|string|max:1000'],
        ['remark.required' => 'A reason is required to close a record.']
      );

      $case = FormSubmission::with('approvals')->find($id);
      if (!$case) {
        return $this->response_failed('Record not found.');
      }

      $user = $request->user();
      if (!$this->recordService->canClose($case, $user)) {
        return $this->response_failed('Only the person who opened this case, or a form admin, can close it.');
      }
      if (!$case->isRecordOpen()) {
        return $this->response_failed('This record is already closed.');
      }

      $wasPending = $case->status === 'pending';

      DB::transaction(function () use ($case, $request, $user, $wasPending) {
        if ($wasPending) {
          $case->update([
            'status'          => 'cancelled',
            'rejected_remark' => 'Record closed: ' . $request->remark,
            'rejected_by'     => $user->id,
          ]);
        }

        $case->update([
          'record_status'        => 'closed',
          'record_closed_remark' => $request->remark,
          'record_closed_by'     => $user->id,
          'record_closed_at'     => now(),
        ]);
      });

      // The task badge is cached per user, so each handler's has to go.
      if ($wasPending) {
        $this->approvalService->bustTaskCaches($case);
      }

      // `entry_status`, not `status`: response_ok() writes its own `status`.
      return $this->response_ok([
        'record_id'     => $case->id,
        'entry_status'  => $case->fresh()->status,
        'record_status' => 'closed',
      ], $wasPending ? 'The case was in progress and has been cancelled.' : 'The case is closed.');
    } catch (\Illuminate\Validation\ValidationException $e) {
      return $this->response_failed('Validation failed.', $e->errors());
    } catch (\Throwable $e) {
      Log::error('Mobile closeRecord failed', ['error' => $e->getMessage(), 'record_id' => $id]);
      return $this->response_failed('Failed to close record.', $e->getMessage());
    }
  }

  /**
   * One entry in full - the answers the caller may see, the approval trail,
   * and whether they can act on it. Serves both My Records and My Tasks.
   */
  public function getEntry(Request $request, $id)
  {
    try {
      $entry = FormSubmission::with([
        'form', 'submittedBy', 'rejectedBy', 'approvals.actedBy', 'documentUploads.uploadedBy',
      ])->find($id);

      if (!$entry) {
        return $this->response_failed('Entry not found.');
      }

      $user = $request->user();
      $mayView = $user->can('form_admin')
        || (int) $entry->submitted_by === (int) $user->id
        || $this->approvalService->isParticipant($entry, $user);

      if (!$mayView) {
        return $this->response_failed('You do not have access to this entry.');
      }

      $permissions = $this->schemaService->fieldPermissionsForViewer($entry, $user);

      // The docs tell an assignee to render only editable_element_ids as
      // inputs, which is only honest if this payload carries enough to render
      // them. The answer snapshot has id/type/label/value but not the options
      // of a choice field or whether it is required, so graft those on from
      // the schema. Without them a select here is an empty dropdown.
      $schema         = $this->schemaService->normalize(optional($entry->form)->form_elements);
      $schemaElements = collect($schema['elements'] ?? [])->keyBy('id');

      // Strip answers the viewer's stages mark as hidden.
      $visibleAnswers = collect($entry->form_elements ?? [])
        ->filter(function ($answer) use ($permissions) {
          $elementId = is_array($answer) ? ($answer['id'] ?? null) : null;
          return $elementId === null || (($permissions[$elementId] ?? 'read') !== 'hidden');
        })
        ->map(function ($answer) use ($schemaElements) {
          $element = is_array($answer) ? $schemaElements->get($answer['id'] ?? null) : null;
          if (!$element) {
            return $answer;
          }

          $answer['values']    = $element['values'] ?? [];
          $answer['mandatory'] = (bool) ($element['mandatory'] ?? false);

          // A Person answer is stored as a user id; send the name with it,
          // so the app can show who even when it cannot list that person.
          if (($element['type'] ?? '') === 'user') {
            $answer['value_label'] = $this->schemaService->userLabel($answer['value'] ?? null);
          }

          return $answer;
        })
        ->values()
        ->all();

      $payload = $this->submissionPayload($entry);
      $payload['form_elements']     = $visibleAnswers;
      $payload['field_permissions'] = $permissions;
      // Attachments grouped by the field they answer (a form can have several
      // `file` fields), each group in the SAME {media, documents} shape that
      // IFE reports use - so the app can render them with the same code.
      $payload['attachments'] = $entry->documentUploads
        ->filter(fn ($doc) => ($permissions[$doc->element_id] ?? 'read') !== 'hidden')
        ->groupBy('element_id')
        ->map(fn ($docs) => Helper::media_documents_array($docs))
        ->all();
      $payload['can_act']           = $this->approvalService->canAct($entry, $user);
      $payload['can_edit']          = (int) $entry->submitted_by === (int) $user->id
                                      && $entry->status === 'pending'
                                      && $entry->isUntouched();

      // Fill phases: which stage is active and which fields the caller owns.
      $currentStage = $entry->currentStage();
      $payload['stage_type'] = $currentStage ? $currentStage->node_type : null;
      $payload['editable_element_ids'] = [];
      if ($payload['can_act'] && $currentStage && $currentStage->isFillNode()) {
        $stagePermissions = $this->schemaService->resolveFieldPermissions($schema, $currentStage->field_permissions ?: []);
        $payload['editable_element_ids'] = array_keys(array_filter($stagePermissions, fn ($level) => $level === 'edit'));
      }

      // When a process loops back to a fill phase, that phase's answers are
      // archived and BLANKED from form_elements so the next handler starts
      // clean. These two keys are the only way the app can show what earlier
      // handlers put in — they exist nowhere else in this payload.
      //
      //   previous_rounds  - every archived round, newest first: the history.
      //   previous_answers - the last answer per field the caller is filling
      //                      in again, for a hint beside the input.
      //
      // Reference only: never pre-fill an input from either. A new round is a
      // fresh answer, and a stale value must not reach a submit untouched.
      $rounds = $this->approvalService->previousRounds($entry, $schema, $permissions);
      $payload['previous_rounds']  = $rounds;
      $payload['previous_answers'] = $this->approvalService
        ->latestPreviousAnswers($rounds, $payload['editable_element_ids']);

      return $this->response_ok(['entry' => $payload], 'Entry retrieved successfully.');
    } catch (\Throwable $e) {
      Log::error('Mobile getEntry failed', ['error' => $e->getMessage(), 'entry_id' => $id]);
      return $this->response_failed('Failed to retrieve entry.', $e->getMessage());
    }
  }

  public function updateEntry(Request $request, $id)
  {
    try {
      $submission = FormSubmission::with(['form', 'approvals'])
        ->where('submitted_by', $request->user()->id)
        ->where('status', 'pending')
        ->find($id);

      if (!$submission || !$submission->isUntouched()) {
        return $this->response_failed('Submission not found or cannot be edited.');
      }

      $formData = $this->decodeFormData($request);
      if (!is_array($formData)) {
        return $this->response_failed('form_data must be an array or JSON array string.');
      }

      // Re-answering a file field replaces its attachments, same as any field.
      $uploads = app(FormUploadService::class);
      $byElement = $uploads->bundledFiles($request);
      if ($byElement) {
        $formData = $uploads->mergeIntoFormData($formData, $uploads->pendingAnswers($byElement));
      }

      $form        = $submission->form;
      $schema      = $this->schemaService->normalize(optional($form)->form_elements);
      $deferredIds = $form
          ? $this->processService->deferredFieldIds($form->process, $schema, $this->schemaService)
          : [];
      // An edit may keep a Person answer whose person has left since.
      $stored = $this->schemaService->answersById($submission->form_elements, $schema);
      $result = $this->schemaService->sanitizeAnswers($schema, $formData, $deferredIds, $stored);

      if (!empty($result['errors'])) {
        // Nothing has been written yet, so a refusal leaves nothing behind.
        return $this->response_failed('Validation failed.', $result['errors']);
      }

      try {
        DB::transaction(function () use ($submission, $form, $result, $request, $byElement, $uploads) {
          $submission->update(['form_elements' => $result['snapshot']]);

          // Files last, like IFE: the folder is named after the submission id.
          $keep    = $uploads->keptBySnapshot($byElement, $result['snapshot']);
          $answers = $uploads->storeFor($submission, $keep, $request->user()->id);
          $uploads->applyToSnapshot($submission, $answers);

          // Answers may steer branch conditions, so re-resolve the stage chain.
          $submission->approvals()->delete();
          $submission->load('approvals');
          if ($form) {
            $this->approvalService->instantiate($submission, $form, $this->assigneeIdsFrom($request));
          }
        });
      } catch (NeedsAssigneeException $e) {
        return $this->needsAssigneeResponse($e->node);
      }

      return $this->response_ok([
        'entry_id'   => $submission->id,
        'record_id'  => $submission->fresh()->id,
        'status'     => $submission->fresh()->status,
      ], 'Submission updated successfully.');
    } catch (\Illuminate\Validation\ValidationException $e) {
      return $this->response_failed('Validation failed.', $e->errors());
    } catch (\Throwable $e) {
      Log::error('Mobile updateSubmission failed', [
        'error'         => $e->getMessage(),
        'submission_id' => $id,
        'user_id'       => optional($request->user())->id,
      ]);
      return $this->response_failed('Failed to update submission.', $e->getMessage());
    }
  }

  public function cancelEntry(Request $request, $id)
  {
    try {
      $submission = FormSubmission::where('submitted_by', $request->user()->id)
        ->where('status', 'pending')
        ->find($id);

      if (!$submission) {
        return $this->response_failed('Submission not found or cannot be cancelled.');
      }

      $submission->update(['status' => 'cancelled']);

      return $this->response_ok([
        'entry_id'  => $submission->id,
        'record_id' => $submission->id,
        'status'    => $submission->status,
      ], 'Entry cancelled successfully.');
    } catch (\Throwable $e) {
      Log::error('Mobile cancelSubmission failed', [
        'error'         => $e->getMessage(),
        'submission_id' => $id,
        'user_id'       => optional($request->user())->id,
      ]);
      return $this->response_failed('Failed to cancel submission.', $e->getMessage());
    }
  }

  public function cloneEntry(Request $request, $id)
  {
    try {
      $submission = FormSubmission::with('form')
        ->where('submitted_by', $request->user()->id)
        ->find($id);

      if (!$submission) {
        return $this->response_failed('Submission not found.');
      }

      if (!$submission->form || !$submission->form->is_enabled) {
        return $this->response_failed('This form is no longer available for submission.');
      }

      return $this->response_ok([
        'form'    => $this->formPayload($submission->form),
        'prefill' => $submission->form_elements ?? [],
      ], 'Submission cloned successfully.');
    } catch (\Throwable $e) {
      Log::error('Mobile cloneSubmission failed', [
        'error'         => $e->getMessage(),
        'submission_id' => $id,
        'user_id'       => optional($request->user())->id,
      ]);
      return $this->response_failed('Failed to clone submission.', $e->getMessage());
    }
  }

  /**
   * The cases this form's next submission may follow up on.
   *
   * The picker the app shows before submitting, and the same source the web
   * select is built from, so the two cannot offer different cases. Top-level
   * cases of THIS form that the caller may see, newest first — completed and
   * closed ones included, which is the point of the feature. Cases that are
   * already follow-ups are absent: the link is one level deep.
   *
   * Optional `?search=` matches a title or a reference ("REC-0042", "0042" or
   * "42"). `?limit=` caps the page at 100; without it the newest 50 come back,
   * because a phone picker is scrolled, not read whole.
   */
  public function getParentOptions(Request $request, $id)
  {
    try {
      $form = Form::where('id', $id)->where('is_enabled', 1)->first();
      if (!$form) {
        return $this->response_failed('Form not found or unavailable.');
      }

      // Gated on submitting, not on viewing: the only use for this list is
      // choosing a parent for a case the caller is about to open.
      if (!$this->schemaService->canSubmit($form->settings, $request->user())) {
        return $this->response_failed('You are not allowed to submit this form.');
      }

      $limit = (int) $request->input('limit', 50);
      $limit = max(1, min($limit, 100));

      $cases = $this->recordService->parentOptionsFor(
        $form,
        $request->user(),
        $request->input('search'),
        $limit
      );

      $cases->loadCount('children')->load('submittedBy');

      $parents = $cases->map(fn ($case) => [
        'id'              => $case->id,
        'reference'       => $case->recordReference(),
        'title'           => $this->recordService->titleFor($case),
        // Both states matter to the person choosing: `status` is what the
        // process did, `record_status` whether an admin has since closed it.
        // Neither disqualifies a case as a parent.
        'status'          => $case->status,
        'record_status'   => $case->record_status,
        'opened_by'       => optional($case->submittedBy)->name,
        'opened_at'       => optional($case->created_at)->toDateTimeString(),
        // How many follow-ups this case already carries — the fastest way to
        // tell two visits to the same customer apart in a list.
        'follow_up_count' => $case->children_count,
      ])->values();

      return $this->response_ok([
        'parents' => $parents,
      ], 'Parent cases retrieved successfully.');
    } catch (\Throwable $e) {
      Log::error('Mobile getParentOptions failed', ['error' => $e->getMessage(), 'form_id' => $id]);
      return $this->response_failed('Failed to retrieve parent cases.', $e->getMessage());
    }
  }

  public function submitForm(Request $request, $id)
  {
    try {
      $form = Form::where('id', $id)->where('is_enabled', 1)->first();
      if (!$form) {
        return $this->response_failed('Form not found or unavailable.');
      }

      if (!$this->schemaService->canSubmit($form->settings, $request->user())) {
        return $this->response_failed('You are not allowed to submit this form.');
      }

      $formData = $this->decodeFormData($request);
      if (!is_array($formData)) {
        return $this->response_failed('form_data must be an array or JSON array string.');
      }

      // Optionally a follow-up on an earlier case of the same form. The id
      // arrives in the request, so the rules are checked here and not taken on
      // trust from whatever the app offered.
      $parentCase = null;
      if ($request->filled('parent_submission_id')) {
        $parentCase = FormSubmission::find($request->input('parent_submission_id'));

        if (!$parentCase) {
          return $this->response_failed('That case no longer exists.');
        }

        $refusal = $this->recordService->parentRefusal($form, $parentCase, $request->user());
        if ($refusal) {
          return $this->response_failed($refusal);
        }
      }

      // Attachments travel with the submission, like IFE and Task. Written to
      // disk first so a mandatory `file` field has a real value to validate.
      $uploads = app(FormUploadService::class);
      $byElement = $uploads->bundledFiles($request);
      if ($byElement) {
        // Validate against the filenames: the real values need the folder,
        // which is named after the submission id, so they cannot exist yet.
        $formData = $uploads->mergeIntoFormData($formData, $uploads->pendingAnswers($byElement));
      }

      $schema      = $form->schema;
      $deferredIds = $this->processService->deferredFieldIds($form->process, $schema, $this->schemaService);
      $result      = $this->schemaService->sanitizeAnswers($schema, $formData, $deferredIds);

      if (!empty($result['errors'])) {
        // Nothing has been written yet, so a refusal leaves nothing behind.
        return $this->response_failed('Validation failed.', $result['errors']);
      }

      $submission = null;
      try {
        DB::transaction(function () use ($form, $result, $request, $parentCase, $byElement, $uploads, &$submission) {
          $submission = FormSubmission::create([
            'form_id'              => $form->id,
            'parent_submission_id' => optional($parentCase)->id,
            'record_title'         => trim((string) $request->input('record_title')) ?: null,
            'submitted_by'         => $request->user()->id,
            'form_elements'        => $result['snapshot'],
            'status'               => 'pending',
          ]);

          // Files last, like IFE: the folder is named after the submission id.
          // Fields the answers discarded (hidden by visible_when, or owned by
          // a later stage) keep no attachments.
          $keep    = $uploads->keptBySnapshot($byElement, $result['snapshot']);
          $answers = $uploads->storeFor($submission, $keep, $request->user()->id);
          $uploads->applyToSnapshot($submission, $answers);

          $this->approvalService->instantiate($submission, $form, $this->assigneeIdsFrom($request));
        });
      } catch (NeedsAssigneeException $e) {
        return $this->needsAssigneeResponse($e->node);
      }

      return $this->response_ok([
        'entry_id'   => $submission->id,
        'record_id'  => $submission->fresh()->id,
        'status'     => $submission->fresh()->status,
      ], 'Form submitted successfully.');
    } catch (\Illuminate\Validation\ValidationException $e) {
      return $this->response_failed('Validation failed.', $e->errors());
    } catch (\Throwable $e) {
      Log::error('Mobile submitForm failed', [
        'error' => $e->getMessage(),
        'form_id' => $id,
        'user_id' => optional($request->user())->id,
      ]);
      return $this->response_failed('Failed to submit form.', $e->getMessage());
    }
  }

  /* ---------------------------------------------------------------
   *  APPROVER ENDPOINTS
   * --------------------------------------------------------------- */

  /* =====================================================================
   *  MY TASKS
   * ===================================================================== */

  /** Everything awaiting the caller's action (approvals and fill stages). */
  public function getTasks(Request $request)
  {
    try {
      $submissions = $this->approvalService->pendingFor($request->user())
        ->map(function ($submission) {
          $stage = $submission->currentStage();

          return [
            'entry_id'      => $submission->id,
            'record_id'     => $submission->id,
            'record_title'  => $this->recordService->titleFor($submission),
            'reference'     => $submission->recordReference(),
            'form_id'       => $submission->form_id,
            'form_name'     => optional($submission->form)->name,
            // Same shape as Start and My Records, so one section renderer
            // serves all three screens.
            'group'         => optional($submission->form)->group ? [
              'id'   => $submission->form->group->id,
              'name' => $submission->form->group->name,
            ] : null,
            'submitted_by'  => optional($submission->submittedBy)->name,
            'submitted_at'  => optional($submission->created_at)->toDateTimeString(),
            'stage_name'    => optional($stage)->name,
            'stage_type'    => optional($stage)->node_type,
          ];
        })->values();

      return $this->response_ok(['tasks' => $submissions], 'Tasks retrieved successfully.');
    } catch (\Throwable $e) {
      Log::error('Mobile getTasks failed', ['error' => $e->getMessage()]);
      return $this->response_failed('Failed to retrieve pending approvals.', $e->getMessage());
    }
  }

  public function approveSubmission(Request $request, $id)
  {
    try {
      $request->validate(['remark' => 'nullable|string|max:1000']);

      $submission = FormSubmission::with(['form', 'approvals'])->find($id);
      if (!$submission) {
        return $this->response_failed('Submission not found.');
      }

      $result = $this->approvalService->approve($submission, $request->user(), $request->remark, $this->assigneeIdsFrom($request));

      if (!empty($result['needs_assignee'])) {
        return $this->needsAssigneeResponse($result['needs_assignee']);
      }

      if (!$result['ok']) {
        return $this->response_failed($result['message']);
      }

      return $this->response_ok([
        'entry_id'   => $submission->id,
        'record_id'  => $submission->fresh()->id,
        'status'     => $submission->fresh()->status,
      ], $result['message']);
    } catch (\Illuminate\Validation\ValidationException $e) {
      return $this->response_failed('Validation failed.', $e->errors());
    } catch (\Throwable $e) {
      Log::error('Mobile approveSubmission failed', ['error' => $e->getMessage(), 'submission_id' => $id]);
      return $this->response_failed('Failed to approve submission.', $e->getMessage());
    }
  }

  public function completeFillStage(Request $request, $id)
  {
    try {
      $submission = FormSubmission::with(['form', 'approvals'])->find($id);
      if (!$submission) {
        return $this->response_failed('Submission not found.');
      }

      $formData = $this->decodeFormData($request);
      if (!is_array($formData)) {
        return $this->response_failed('form_data must be an array or JSON array string.');
      }

      // Accept either [{id, value}, ...] or {el_id: value, ...}, then fold in
      // any attachments posted with the stage — a handler's section can own a
      // `file` field just as a submitter's can.
      $uploads = app(FormUploadService::class);
      $byElement = $uploads->bundledFiles($request);
      // Placeholder values so a mandatory `file` field in this stage passes;
      // the real ones are written once the stage is accepted.
      $updates   = array_merge($uploads->keyAnswers($formData), $uploads->pendingAnswers($byElement));

      $result = $this->approvalService->completeFill($submission, $request->user(), $updates, $this->assigneeIdsFrom($request));

      if (!empty($result['needs_assignee'])) {
        return $this->needsAssigneeResponse($result['needs_assignee']);
      }

      if (!$result['ok']) {
        return $this->response_failed($result['message'], $result['errors'] ?? null);
      }

      // Only once the stage is accepted - a rejected update must not leave
      // attachment rows claiming the answer changed.
      $submission->refresh();
      $keep    = $uploads->keptBySnapshot($byElement, $submission->form_elements ?? []);
      $answers = $uploads->storeFor($submission, $keep, $request->user()->id);
      $uploads->applyToSnapshot($submission, $answers);

      return $this->response_ok([
        'entry_id'   => $submission->id,
        'record_id'  => $submission->fresh()->id,
        'status'     => $submission->fresh()->status,
      ], $result['message']);
    } catch (\Illuminate\Validation\ValidationException $e) {
      return $this->response_failed('Validation failed.', $e->errors());
    } catch (\Throwable $e) {
      Log::error('Mobile completeFillStage failed', ['error' => $e->getMessage(), 'submission_id' => $id]);
      return $this->response_failed('Failed to submit section.', $e->getMessage());
    }
  }

  public function rejectSubmission(Request $request, $id)
  {
    try {
      $request->validate(['remark' => 'required|string|max:1000']);

      $submission = FormSubmission::with(['form', 'approvals'])->find($id);
      if (!$submission) {
        return $this->response_failed('Submission not found.');
      }

      $result = $this->approvalService->reject($submission, $request->user(), $request->remark);

      if (!$result['ok']) {
        return $this->response_failed($result['message']);
      }

      return $this->response_ok([
        'entry_id'   => $submission->id,
        'record_id'  => $submission->fresh()->id,
        'status'     => $submission->fresh()->status,
      ], $result['message']);
    } catch (\Illuminate\Validation\ValidationException $e) {
      return $this->response_failed('Validation failed.', $e->errors());
    } catch (\Throwable $e) {
      Log::error('Mobile rejectSubmission failed', ['error' => $e->getMessage(), 'submission_id' => $id]);
      return $this->response_failed('Failed to reject submission.', $e->getMessage());
    }
  }

  /* ---------------------------------------------------------------
   *  Payload builders
   * --------------------------------------------------------------- */

  /**
   * Form definition payload: v2 schema keys plus the legacy flat
   * form_elements key so older RN builds keep working during transition.
   */
  private function formPayload(Form $form): array
  {
    $schema  = $form->schema;
    return [
      'id'                  => $form->id,
      'name'                => $form->name,
      'description'         => $form->description,
      // Legacy key (flat field list) — remove once the RN app reads the v2 keys.
      'form_elements'       => collect($schema['elements'] ?? [])
                                 ->filter(fn ($e) => ($e['kind'] ?? 'field') === 'field')
                                 ->values()
                                 ->all(),
      'schema_version'      => $schema['schema_version'],
      // The category this form is filed under (see form_groups on GET /forms).
      'group'               => $form->group ? [
        'id'   => $form->group->id,
        'name' => $form->group->name,
      ] : null,
      // Field sections within the form — unrelated to the category above.
      'groups'              => $schema['groups'],
      'elements'            => $this->withPeople($schema['elements']),
      'process'             => $this->processService->summary($form->process),
      'process_version'     => $form->process['process_version'] ?? 1,
      // Fields owned by later fill phases: hide these from the submitter.
      'deferred_element_ids' => $this->processService->deferredFieldIds($form->process, $schema, $this->schemaService),
    ];
  }

  /**
   * Each Person field carries its people, [{id, name, active}], from the
   * same rule the server checks a pick against (userOptionsFor). The app's
   * own people list leaves admins and inactive users out, so it cannot be
   * used to fill these. A deactivated person stays in with active false:
   * the app still needs their name for past answers, but does not offer
   * them in the picker.
   */
  private function withPeople(array $elements): array
  {
    $active = $this->schemaService->activeUserIds();

    return array_map(function ($element) use ($active) {
      if (($element['type'] ?? '') !== 'user') {
        return $element;
      }

      $element['people'] = collect($this->schemaService->userOptionsFor($element))
        ->map(fn ($name, $id) => ['id' => (int) $id, 'name' => $name, 'active' => isset($active[(int) $id])])
        ->values()
        ->all();

      return $element;
    }, $elements);
  }

  private function submissionPayload(FormSubmission $submission): array
  {
    $approvals = $this->approvalsPayload($submission);


    return [
      'id'                      => $submission->id,
      'form_id'                 => $submission->form_id,
      'form_name'               => optional($submission->form)->name,
      'record_id'               => $submission->id,
      'record_reference'        => $submission->recordReference(),
      'record_title'            => $this->recordService->titleFor($submission),
      'record_status'           => $submission->record_status,
      'status'                  => $submission->status,
      'submitted_at'            => optional($submission->created_at)->toDateTimeString(),
      'submitted_by'            => $submission->submitted_by,
      'submitted_by_name'       => optional($submission->submittedBy)->name,
      'rejected_by'             => $submission->rejected_by,
      'rejected_by_name'        => optional($submission->rejectedBy)->name,
      'rejected_remark'         => $submission->rejected_remark,
      'form_elements'           => $submission->form_elements ?? [],
      'approvals'               => $approvals,
      'current_stage'           => optional($submission->currentStage())->name,
      'branch_trail'            => $submission->process_snapshot['branch_trail'] ?? [],
      // False while a runtime branch / loop can still add stages; legacy
      // (pre-cursor) snapshots were always fully materialised.
      'process_complete'        => !isset($submission->process_snapshot['cursor'])
                                   || !empty($submission->process_snapshot['complete']),
    ];
  }

  private function approvalsPayload(FormSubmission $submission): array
  {
    return $submission->approvals->map(fn ($row) => [
      'sequence'         => $row->sequence,
      'iteration'        => (int) ($row->iteration ?? 1),
      'node_id'          => $row->node_id,
      'node_type'        => $row->node_type,
      'source_branch_id' => $row->source_branch_id,
      'name'             => $row->name,
      'approval_mode'    => $row->approval_mode,
      'status'           => $row->status,
      'acted_by'         => $row->acted_by,
      'acted_by_name'    => optional($row->actedBy)->name,
      'acted_at'         => optional($row->acted_at)->toDateTimeString(),
      'remark'           => $row->remark,
      'assigned_by'      => $row->assigned_by,
    ])->values()->all();
  }

  /** Handler pick for a runtime-assignee step, sent with the acting request. */
  private function assigneeIdsFrom(Request $request): array
  {
    return array_values(array_filter(array_map('intval', (array) $request->input('next_assignee_ids', []))));
  }

  /**
   * The action activated a runtime-assignee handler and no pick was sent:
   * nothing was saved — the client shows a user picker and repeats the
   * request with next_assignee_ids.
   */
  private function needsAssigneeResponse(array $node)
  {
    return $this->response_failed('Choose who should handle "' . ($node['name'] ?? 'the next step') . '".', [
      'needs_assignee' => [
        'node_id' => $node['node_id'] ?? null,
        'name'    => $node['name'] ?? 'Handler',
      ],
      'candidates' => User::orderBy('name')->get(['id', 'name'])
                        ->map(fn ($user) => ['id' => $user->id, 'name' => $user->name])
                        ->values(),
    ]);
  }

  private function decodeFormData(Request $request)
  {
    $validated = $request->validate([
      'form_data' => 'required',
    ]);

    $formData = $validated['form_data'];
    if (is_string($formData)) {
      $decoded = json_decode($formData, true);
      if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
        return null;
      }
      $formData = $decoded;
    }

    return is_array($formData) ? $formData : null;
  }
}
