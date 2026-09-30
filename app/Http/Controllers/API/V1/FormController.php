<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreFormRequest;
use App\Http\Requests\UpdateFormRequest;
use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Form;
use App\Models\FormGroup;
use App\Models\FormSubmission;
use App\Exports\FormSubmissionsExport;
use App\Services\FormApprovalService;
use App\Services\FormProcessService;
use App\Services\FormRecordService;
use App\Services\FormSchemaService;
use App\Services\FormUploadService;
use App\Services\NeedsAssigneeException;
use App\Http\Resources\Forms\ApprovalStageResource;
use App\Http\Resources\Forms\CaseLinkResource;
use App\Http\Resources\Forms\FormSummaryResource;
use App\Http\Resources\Forms\RecordRowResource;
use App\Http\Resources\Forms\ResponseSectionResource;
use App\Support\Options;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Maatwebsite\Excel\Facades\Excel;

class FormController extends Controller
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

    public function index(Request $request) {
        abort_unless($this->canManageForms(), 403);

        $query = Form::with('group');

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Grouped, not paginated: a page break through the middle of a group
        // hides the very structure the grouping exists to show.
        $forms  = $query->arranged()->get();
        $groups = FormGroup::ordered()->get();

        $grouped = $forms->groupBy('form_group_id');

        return Inertia::render('Forms/Index', [
            'groups'    => $groups->map(fn (FormGroup $group) => [
                'id'    => $group->id,
                'name'  => $group->name,
                'forms' => FormSummaryResource::collection($grouped[$group->id] ?? collect())->resolve(),
            ])->values(),
            'ungrouped' => FormSummaryResource::collection($forms->whereNull('form_group_id')->values())->resolve(),
            'search'    => (string) $request->input('search', ''),
            'formCount' => $forms->count(),
        ]);
    }

    /* ---------------------------------------------------------------
     *  FORM GROUPS  – organising the form list
     * --------------------------------------------------------------- */

    /**
     * Group names must be unique — two groups called "Reports" are impossible
     * to tell apart in the form list or the builder's group picker.
     * Case-insensitive, so "Reports" and "reports" collide.
     */
    private function duplicateGroupName(string $name, ?int $exceptId = null): bool
    {
        return FormGroup::whereRaw('LOWER(name) = ?', [mb_strtolower(trim($name))])
            ->when($exceptId, fn ($q) => $q->where('id', '!=', $exceptId))
            ->exists();
    }

    public function storeGroup(Request $request) {
        abort_unless($this->canManageForms(), 403);

        $request->validate(['name' => 'required|string|max:120']);
        $name = trim($request->name);

        if ($this->duplicateGroupName($name)) {
            $message = "A group named \"{$name}\" already exists.";

            if ($request->wantsJson() || $request->ajax()) {
                return response()->json(['status' => 'error', 'message' => $message], 422);
            }

            return back()->withInput()->withErrors(['name' => $message]);
        }

        $group = FormGroup::create([
            'name'     => $name,
            'position' => (int) FormGroup::max('position') + 1,
        ]);

        // The builder creates groups inline while a form is being written, so
        // it needs the new row back rather than a redirect.
        if ($request->wantsJson() || $request->ajax()) {
            return response()->json([
                'status'  => 'ok',
                'group'   => ['id' => $group->id, 'name' => $group->name],
                'message' => "Group \"{$group->name}\" created.",
            ]);
        }

        alert()->success('Group created', 'Drag forms into it to organise the list.')->showConfirmButton();

        return redirect()->route('form.index');
    }

    public function updateGroup(Request $request, $id) {
        abort_unless($this->canManageForms(), 403);

        $request->validate(['name' => 'required|string|max:120']);

        $group = FormGroup::findOrFail($id);
        $name  = trim($request->name);

        if ($this->duplicateGroupName($name, (int) $group->id)) {
            $message = "A group named \"{$name}\" already exists.";

            if ($request->wantsJson() || $request->ajax()) {
                return response()->json(['status' => 'error', 'message' => $message], 422);
            }

            return back()->withInput()->withErrors(['name' => $message]);
        }

        $group->update(['name' => $name]);

        if ($request->wantsJson() || $request->ajax()) {
            return response()->json(['status' => 'ok', 'message' => "Group renamed to \"{$name}\"."]);
        }

        alert()->success('Group renamed', 'The group name has been updated.')->showConfirmButton();

        return redirect()->route('form.index');
    }

    /**
     * Deleting a group never deletes the forms inside it — they fall back to
     * ungrouped. Losing a form because a container was tidied away would be a
     * disastrous outcome for a one-click action.
     */
    public function destroyGroup($id) {
        abort_unless($this->canManageForms(), 403);

        $group = FormGroup::findOrFail($id);
        $moved = Form::where('form_group_id', $group->id)->count();

        DB::transaction(function () use ($group) {
            Form::where('form_group_id', $group->id)->update(['form_group_id' => null]);
            $group->delete();
        });

        alert()->success('Group deleted', $moved === 0
            ? 'The empty group has been removed.'
            : trans_choice('{1} 1 form moved to Ungrouped.|[2,*] :count forms moved to Ungrouped.', $moved, ['count' => $moved])
        )->showConfirmButton();

        return redirect()->route('form.index');
    }

    /**
     * Persist a drag-and-drop rearrangement: which group each form now sits
     * in and in what order, plus the order of the groups themselves.
     */
    public function reorderForms(Request $request) {
        abort_unless($this->canManageForms(), 403);

        $request->validate([
            'forms'            => 'present|array',
            'forms.*.id'       => 'required|integer|exists:forms,id',
            'forms.*.group_id' => 'nullable|integer|exists:form_groups,id',
            'forms.*.position' => 'required|integer|min:0',
            'groups'           => 'sometimes|array',
            'groups.*.id'      => 'required|integer|exists:form_groups,id',
            'groups.*.position'=> 'required|integer|min:0',
        ]);

        DB::transaction(function () use ($request) {
            foreach ($request->input('forms', []) as $row) {
                Form::where('id', $row['id'])->update([
                    'form_group_id' => $row['group_id'] ?: null,
                    'position'      => $row['position'],
                ]);
            }
            foreach ($request->input('groups', []) as $row) {
                FormGroup::where('id', $row['id'])->update(['position' => $row['position']]);
            }
        });

        return response()->json(['status' => 'ok']);
    }

    /** Who may build and organise forms. */
    private function canManageForms(): bool
    {
        $user = auth()->user();

        return $user && ($user->can('form_admin') || $user->can('form_creation'));
    }

    public function entry() {
        $forms = Form::where('is_enabled', 1)
            ->arranged()
            ->get()
            ->filter(fn ($form) => $this->schemaService->canSubmit($form->settings, auth()->user()))
            ->values();

        // Group headings only appear where a group has forms this user may
        // submit — an empty heading tells them nothing and hints at forms
        // they cannot see. With no groups at all it collapses to one unnamed
        // section, so a small deployment sees the plain list it had before.
        $byGroup  = $forms->groupBy('form_group_id');
        $sections = FormGroup::ordered()->get()
            ->map(fn ($group) => ['name' => $group->name, 'forms' => $byGroup[$group->id] ?? collect()])
            ->filter(fn ($section) => $section['forms']->isNotEmpty())
            ->values();

        $ungrouped = $byGroup[null] ?? collect();
        if ($ungrouped->isNotEmpty()) {
            $sections->push([
                // Don't label the leftovers "Ungrouped" for end users — that is
                // an admin's filing concern, not something they can act on.
                'name'  => $sections->isEmpty() ? null : 'Other',
                'forms' => $ungrouped,
            ]);
        }

        return Inertia::render('Forms/Entry', [
            'sections' => $sections->map(fn ($section) => [
                'name'  => $section['name'],
                'forms' => FormSummaryResource::collection($section['forms'])->resolve(),
            ])->values(),
        ]);
    }

    public function create() {
        abort_unless($this->canManageForms(), 403);

        return Inertia::render('Forms/Builder', $this->builderProps(null, [
            'schema'   => ['schema_version' => 2, 'groups' => [], 'elements' => []],
            'process'  => ['process_version' => 1, 'nodes' => []],
            'settings' => ['access' => ['submit_scope' => 'everyone', 'user_ids' => [], 'user_types' => []]],
        ]));
    }

    public function store(StoreFormRequest $request) {
        abort_unless($this->canManageForms(), 403);

        $data = $request->only(['name', 'description', 'is_enabled', 'form_group_id']);

        $data['form_elements']      = $request->schemaData();
        $data['process_definition'] = $request->processData();
        $data['settings']           = $request->settingsData();
        // New forms go to the end of their group rather than jumping the
        // arrangement an admin has already made.
        $data['position']           = (int) Form::where('form_group_id', $data['form_group_id'])->max('position') + 1;

        Form::create($data);

        alert()->success(trans('translation.success'), trans('translation.successfully_update'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
        return redirect()->route('form.index')->with('success', 'Form created successfully.');
    }

    public function edit($id) {
        abort_unless($this->canManageForms(), 403);

        $form = Form::findOrFail($id);

        return Inertia::render('Forms/Builder', $this->builderProps($form, [
            'schema'   => $form->schema,
            'process'  => $form->process,
            'settings' => $form->settings ?: ['access' => ['submit_scope' => 'everyone', 'user_ids' => [], 'user_types' => []]],
        ]));
    }

    /**
     * What the builder needs besides the definition itself: the form's basic
     * info, and the people, user types and groups its pickers offer.
     */
    private function builderProps(?Form $form, array $definition): array
    {
        return array_merge($definition, [
            'form'   => $form ? [
                'id'            => $form->id,
                'name'          => $form->name,
                'description'   => $form->description,
                'is_enabled'    => (bool) $form->is_enabled,
                'form_group_id' => $form->form_group_id,
            ] : null,
            'users'  => User::orderBy('name')->get(['id', 'name']),
            'types'  => $this->userTypeOptions(),
            'groups' => FormGroup::ordered()->get(['id', 'name']),
        ]);
    }

    /**
     * User types offered in "Who can submit", shaped for the builder's picker.
     */
    private function userTypeOptions()
    {
        return collect(User::getUserTypeListing())
                ->map(fn ($name, $id) => ['id' => $id, 'name' => $name])
                ->values();
    }

    public function update(UpdateFormRequest $request, $id) {
        abort_unless($this->canManageForms(), 403);

        $form = Form::findOrFail($id);

        $data = $request->only(['name', 'description', 'is_enabled', 'form_group_id']);

        $data['form_elements']      = $request->schemaData();
        $data['process_definition'] = $request->processData();
        $data['settings']           = $request->settingsData();

        if ((int) $data['form_group_id'] !== (int) $form->form_group_id) {
            $data['position'] = (int) Form::where('form_group_id', $data['form_group_id'])->max('position') + 1;
        }

        $form->update($data);

        alert()->success(trans('translation.success'), trans('translation.successfully_update'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
        return redirect()->route('form.index')->with('success', 'Form updated successfully.');
    }

    public function destroy(Request $request) {
        abort_unless($this->canManageForms(), 403);

        $form = Form::find($request->id);
        if ($form) {
            $form->delete();
            return response()->json(['success' => true]);
        }
        return response()->json(['success' => false], 404);
    }

    public function toggle(Request $request) {
        abort_unless($this->canManageForms(), 403);

        $form = Form::find($request->id);
        if ($form) {
            $form->is_enabled = !$form->is_enabled;
            $form->save();
            return response()->json(['success' => true]);
        }
        return response()->json(['success' => false], 404);
    }

    public function preview($id) {
        abort_unless($this->canManageForms(), 403);

        $form = Form::findOrFail($id);

        $process = $form->process;

        return Inertia::render('Forms/Preview', [
            'form'          => ['id' => $form->id, 'name' => $form->name, 'description' => $form->description],
            'schema'        => $form->schema,
            'process'       => $process,
            'approverNames' => (object) $this->userNamesInProcess($process),
            'people'        => User::orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function fill(Request $request, $id) {
        $form = Form::where('id', $id)->where('is_enabled', 1)->firstOrFail();
        abort_unless($this->schemaService->canSubmit($form->settings, auth()->user()), 403, 'You are not allowed to submit this form.');

        $schema  = $form->schema;
        $answers = $this->schemaService->answersById(session('clone_prefill', []), $schema);

        // This case may follow up on an earlier case of the same form — the
        // emergency callout that came out of a finished job. Optional, and
        // deliberately offered for completed and closed cases too.
        $parentOptions = $this->recordService->parentOptionsFor($form, auth()->user());
        $parentCase    = null;

        if ($request->filled('parent')) {
            $parentCase = $parentOptions->firstWhere('id', (int) $request->input('parent'));
            abort_unless($parentCase, 403, 'That case cannot be followed up on.');
        }

        return Inertia::render('Forms/Fill', [
            'form'          => ['id' => $form->id, 'name' => $form->name, 'description' => $form->description],
            'schema'        => $schema,
            'answers'       => (object) $answers,
            'deferredIds'   => $this->processService->deferredFieldIds($form->process, $schema, $this->schemaService),
            'people'        => User::orderBy('name')->get(['id', 'name']),
            'parentOptions' => CaseLinkResource::collection($parentOptions)->resolve(),
            'parentId'      => optional($parentCase)->id,
        ]);
    }

    public function submit(Request $request) {
        $request->validate([
            'form_id' => 'required|exists:forms,id',
            'form_data' => 'required|json',
            'parent_submission_id' => 'nullable|exists:form_submissions,id',
        ]);

        $form = Form::where('id', $request->form_id)->where('is_enabled', 1)->firstOrFail();
        abort_unless($this->schemaService->canSubmit($form->settings, auth()->user()), 403);

        // Attachments arrive with the form, the same way the IFE and Task
        // pages post theirs. Written after the insert, because the folder is
        // named after the entry id.
        $uploads   = app(FormUploadService::class);
        $byElement = $uploads->bundledFiles($request);

        // Following up on an earlier case? Validated here and not only in the
        // picker: the id arrives in the POST and must never be taken on trust.
        $parentCase = null;
        if ($request->filled('parent_submission_id')) {
            $parentCase = FormSubmission::find($request->input('parent_submission_id'));
            $refusal    = $parentCase
                ? $this->recordService->parentRefusal($form, $parentCase, auth()->user())
                : 'That case no longer exists.';

            if ($refusal) {
                session()->flash('clone_prefill', json_decode($request->form_data, true) ?: []);

                return redirect()->route('form.fill', $form->id)
                    ->withInput()
                    ->withErrors(['parent_submission_id' => $refusal]);
            }
        }

        $schema      = $form->schema;
        $deferredIds = $this->processService->deferredFieldIds($form->process, $schema, $this->schemaService);
        // Placeholder answers so a mandatory `file` field validates; the real
        // values need the entry id and are written after the insert.
        $formData    = $uploads->mergeIntoFormData(
            json_decode($request->form_data, true) ?: [],
            $uploads->pendingAnswers($byElement)
        );
        $result      = $this->schemaService->sanitizeAnswers($schema, $formData, $deferredIds);

        if (!empty($result['errors'])) {
            // Nothing has been written yet, so a refusal leaves nothing behind.
            return redirect()->route('form.fill', $form->id)
                ->withErrors($result['errors'])
                ->with('error', 'Please complete all required fields.');
        }


        $entry = null;

        try {
            DB::transaction(function () use ($form, $result, $request, $parentCase, $byElement, $uploads, &$entry) {
                $entry = FormSubmission::create([
                    'form_id' => $form->id,
                    'parent_submission_id' => optional($parentCase)->id,
                    'record_title' => trim((string) $request->input('record_title')) ?: null,
                    'submitted_by' => auth()->id(),
                    'form_elements' => $result['snapshot'],
                    'status' => 'pending',
                ]);

                // Now there is an id to hang the attachment rows on.
                // Files last, like IFE: the folder is named after the entry id.
                $keep    = $uploads->keptBySnapshot($byElement, $result['snapshot']);
                $answers = $uploads->storeFor($entry, $keep, auth()->id());
                $uploads->applyToSnapshot($entry, $answers);

                $this->approvalService->instantiate($entry, $form, $this->assigneeIdsFrom($request));
            });
        } catch (NeedsAssigneeException $e) {
            // First activating step is a runtime-assignee handler: nothing was
            // saved — restore the entered answers and ask who handles it.
            session()->flash('clone_prefill', $result['snapshot']);
            session()->flash('needs_assignee', [
                'name'   => $e->node['name'] ?? 'Handler',
                'action' => route('form.submit'),
                'fields' => [
                    'form_id'              => (string) $form->id,
                    'form_data'            => (string) $request->form_data,
                    'parent_submission_id' => (string) $request->input('parent_submission_id'),
                    'record_title'         => (string) $request->input('record_title'),
                ],
            ]);

            return redirect()->route('form.fill', $form->id);
        }

        alert()->success('Success', 'Form submitted successfully!')->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);

        return redirect()->route('form.records.show', $entry->id);
    }

    /* ---------------------------------------------------------------
     *  RECORDS  – the one object every form produces
     * --------------------------------------------------------------- */

    /** Records I opened or took part in. */
    public function records(Request $request) {
        return $this->recordList($request, auth()->user(), 'Forms/Records', false);
    }

    /** Every record (form_admin only) — the oversight/export console. */
    public function allRecords(Request $request) {
        abort_unless(auth()->user()->can('form_admin'), 403);

        return $this->recordList($request, null, 'Forms/Records', true);
    }

    /**
     * Shared Records list. `$scopeUser` null = admin scope (everything).
     * The only difference between the two screens is the scope and the title.
     */
    private function recordList(Request $request, ?User $scopeUser, string $view, bool $isAdmin) {
        $query = $this->recordService->visibleFor($scopeUser)
            ->with(['form', 'submittedBy', 'approvals']);

        if ($request->filled('form_id')) {
            $query->where('form_id', $request->form_id);
        }
        if ($request->filled('submitted_by')) {
            $query->where('submitted_by', $request->submitted_by);
        }
        if ($request->filled('date_start')) {
            $query->whereDate('created_at', '>=', $request->date_start);
        }
        if ($request->filled('date_end')) {
            $query->whereDate('created_at', '<=', $request->date_end);
        }
        if ($request->filled('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('record_title', 'like', "%{$search}%")
                  ->orWhereHas('form', fn ($f) => $f->where('name', 'like', "%{$search}%"));
            });
        }

        // Counts behind the status pills. Taken BEFORE the status filter, so
        // choosing one pill does not blank out the others — the row keeps
        // saying how much sits under every status.
        $statusCounts = (clone $query)
            ->selectRaw("CASE WHEN record_status = 'closed' THEN 'closed' ELSE status END AS pill_status, COUNT(*) AS cnt")
            ->groupBy('pill_status')
            ->pluck('cnt', 'pill_status');

        if ($request->filled('status')) {
            // "Closed" is a property of the record, not of its latest entry —
            // and a closed record must not also show up under that entry's
            // status, or one record appears in two filters.
            if ($request->status === 'closed') {
                $query->where('record_status', 'closed');
            } else {
                $query->where('status', $request->status)
                      ->where(fn ($q) => $q->where('record_status', '!=', 'closed')
                                            ->orWhereNull('record_status'));
            }
        }

        // Whitelisted — the sort arrives straight off the query string.
        $sortable = ['created_at', 'updated_at', 'record_title'];
        $sortBy   = in_array($request->sortby, $sortable, true) ? $request->sortby : 'created_at';
        $sortMode = $request->sortmode === 'asc' ? 'asc' : 'desc';

        $records = $query->with('parent')->orderBy($sortBy, $sortMode)->paginate(15)->withQueryString();

        // Submitters for the advanced filter row — the same list the Task
        // screen filters by: active users, minus the system account.
        $users = User::where('status', 1)->whereNotIn('id', [1])->orderBy('name')->get(['id', 'name']);

        return Inertia::render($view, [
            'records'      => $records->through(fn (FormSubmission $case) => RecordRowResource::make($case)->resolve()),
            'forms'        => Options::fromCollection(Form::orderBy('name')->get(['id', 'name'])),
            'users'        => Options::fromCollection($users),
            'statusCounts' => $statusCounts,
            'isAdmin'      => $isAdmin,
            'filters'      => $request->query(),
        ]);
    }

    /** One case: its header, its answers, and how it relates to other cases. */
    public function recordView(Request $request, $id) {
        $case = FormSubmission::findOrFail($id);

        abort_unless($this->recordService->canView($case, auth()->user()), 403);

        return $this->renderEntry($case);
    }

    /**
     * Close a case: it is done, and anything still in flight on it is
     * cancelled. Cancelling is the point — a closed case must not leave
     * handlers holding live tasks against it, so the two happen together or
     * not at all.
     *
     * A closed case can still be followed up on: that is what a parent link is
     * for, and why closing no longer blocks anything.
     */
    public function closeRecord(Request $request, $id) {
        $case = FormSubmission::findOrFail($id);

        abort_unless($this->recordService->canClose($case, auth()->user()), 403,
            'Only the person who opened this case, or a form admin, can close it.');

        $request->validate(
            ['remark' => 'required|string|max:1000'],
            ['remark.required' => 'A reason is required to close a record.']
        );

        if (!$case->isRecordOpen()) {
            alert()->info('Already closed', 'This record is already closed.')->showConfirmButton();

            return redirect()->route('form.records.show', $case->id);
        }

        $wasPending = $case->status === 'pending';

        DB::transaction(function () use ($case, $request, $wasPending) {
            if ($wasPending) {
                $case->update([
                    'status'          => 'cancelled',
                    'rejected_remark' => 'Record closed: ' . $request->remark,
                    'rejected_by'     => auth()->id(),
                ]);
            }

            $case->update([
                'record_status'        => 'closed',
                'record_closed_remark' => $request->remark,
                'record_closed_by'     => auth()->id(),
                'record_closed_at'     => now(),
            ]);
        });

        // Whoever was holding this is no longer; the task badge is cached per
        // user, so it has to be busted for each of them.
        if ($wasPending) {
            $this->approvalService->bustTaskCaches($case->load('approvals'));
        }

        alert()->success('Record closed', $wasPending
            ? 'The case was in progress and has been cancelled.'
            : 'The case is closed.'
        )->showConfirmButton();

        return redirect()->route('form.records.show', $case->id);
    }

    /** Reopen a closed case. */
    public function reopenRecord($id) {
        $case = FormSubmission::findOrFail($id);

        abort_unless($this->recordService->canClose($case, auth()->user()), 403,
            'Only the person who opened this case, or a form admin, can reopen it.');

        // The close remark is kept — it explains a cancellation that still
        // stands, since reopening does not resurrect the cancelled process.
        $case->update(['record_status' => 'open']);

        alert()->success('Record reopened', 'This record is open again.')->showConfirmButton();

        return redirect()->route('form.records.show', $case->id);
    }

    /**
     * Superseded by the record page — kept as a redirect so old links and
     * bookmarks still land somewhere sensible.
     */
    public function viewSubmission($id) {
        $submission = FormSubmission::findOrFail($id);

        return redirect()->route('form.records.show', ['id' => $submission->id]);
    }

    public function cloneSubmission($id) {
        $submission = FormSubmission::with('form')
            ->where('submitted_by', auth()->id())
            ->findOrFail($id);

        abort_unless($submission->form && $submission->form->is_enabled, 403, 'This form is no longer available for submission.');

        // A GPS stamp records where *that* submission was made, so the copy
        // starts without one and captures afresh.
        $prefill = collect($submission->form_elements ?? [])
            ->map(fn ($entry) => is_array($entry) && ($entry['type'] ?? '') === 'gps'
                ? array_merge($entry, ['value' => null])
                : $entry)
            ->all();

        session()->flash('clone_prefill', $prefill);

        return redirect()->route('form.fill', $submission->form_id);
    }

    public function editSubmission($id) {
        $submission = FormSubmission::with(['form', 'approvals'])
            ->where('submitted_by', auth()->id())
            ->where('status', 'pending')
            ->findOrFail($id);

        abort_unless($submission->isUntouched(), 403, 'This submission is already being reviewed and can no longer be edited.');

        $form   = $submission->form;
        $schema = $form->schema;

        return Inertia::render('Forms/SubmissionEdit', [
            'submission'  => ['id' => $submission->id, 'record_title' => $submission->record_title],
            'form'        => ['id' => $form->id, 'name' => $form->name, 'description' => $form->description],
            'schema'      => $schema,
            'answers'     => (object) $this->schemaService->answersById($submission->form_elements, $schema),
            'deferredIds' => $this->processService->deferredFieldIds($form->process, $schema, $this->schemaService),
            'people'      => User::orderBy('name')->get(['id', 'name']),
            // Editing answers never changes which case this follows up on — that
            // link is set once, when the case is opened.
            'parentCase'  => $submission->parent ? CaseLinkResource::make($submission->parent)->resolve() : null,
        ]);
    }

    public function updateSubmission(Request $request, $id) {
        $submission = FormSubmission::with(['form', 'approvals'])
            ->where('submitted_by', auth()->id())
            ->where('status', 'pending')
            ->findOrFail($id);

        abort_unless($submission->isUntouched(), 403, 'This submission is already being reviewed and can no longer be edited.');

        $request->validate([
            'form_data' => 'required|json',
        ]);

        $uploads   = app(FormUploadService::class);
        $byElement = $uploads->bundledFiles($request);

        $form        = $submission->form;
        $schema      = $form->schema;
        $deferredIds = $this->processService->deferredFieldIds($form->process, $schema, $this->schemaService);
        $formData    = $uploads->mergeIntoFormData(
            json_decode($request->form_data, true) ?: [],
            $uploads->pendingAnswers($byElement)
        );
        $result      = $this->schemaService->sanitizeAnswers($schema, $formData, $deferredIds);

        if (!empty($result['errors'])) {
            // Nothing has been written yet, so a refusal leaves nothing behind.
            return redirect()->route('form.submission.edit', $submission->id)
                ->withErrors($result['errors'])
                ->with('error', 'Please complete all required fields.');
        }

        try {
            DB::transaction(function () use ($submission, $form, $result, $request, $byElement, $uploads) {

                $data = ['form_elements' => $result['snapshot']];

                $title = trim((string) $request->input('record_title'));
                if ($title !== '') {
                    $data['record_title'] = $title;
                }

                $submission->update($data);

                // Files last, like IFE, and after the update above: writing
                // them earlier would be undone by it.
                $keep    = $uploads->keptBySnapshot($byElement, $result['snapshot']);
                $answers = $uploads->storeFor($submission, $keep, auth()->id());
                $uploads->applyToSnapshot($submission, $answers);

                // Answers may steer branch conditions, so re-resolve the chain
                // (safe: nothing has been acted on yet).
                $submission->approvals()->delete();
                $submission->load('approvals');
                $this->approvalService->instantiate($submission, $form, $this->assigneeIdsFrom($request));
            });
        } catch (NeedsAssigneeException $e) {
            session()->flash('needs_assignee', [
                'name'   => $e->node['name'] ?? 'Handler',
                'action' => route('form.submission.update', $submission->id),
                'fields' => [
                    'form_data'    => (string) $request->form_data,
                    'record_title' => (string) $request->input('record_title'),
                ],
            ]);

            return redirect()->route('form.submission.edit', $submission->id);
        }

        alert()->success('Updated', 'Your submission has been updated successfully.')->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
        return redirect()->route('form.records.show', $submission->id);
    }

    public function cancelSubmission(Request $request, $id) {
        $submission = FormSubmission::where('submitted_by', auth()->id())
            ->where('status', 'pending')
            ->findOrFail($id);

        $submission->update(['status' => 'cancelled']);

        alert()->success('Cancelled', 'Your submission has been cancelled.')->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
        return redirect()->route('form.records.index');
    }

    /* ---------------------------------------------------------------
     *  FORM TASKS  – everything awaiting the current user's action
     * --------------------------------------------------------------- */

    public function myTasks() {
        $tasks = $this->approvalService->pendingFor(auth()->user())
            ->map(function ($submission) {
                $stage = $submission->currentStage();

                return [
                    'submission_id' => $submission->id,
                    'form_name'     => optional($submission->form)->name ?? 'N/A',
                    'submitted_by'  => optional($submission->submittedBy)->name ?? 'Unknown',
                    'submitted_at'  => optional($submission->created_at)->format('d M Y, h:i A'),
                    'submitted_ago' => optional($submission->created_at)->diffForHumans(),
                    'stage_name'    => optional($stage)->name,
                    'stage_type'    => optional($stage)->node_type,
                    'record_id'     => $submission->id,
                    'record_title'  => $this->recordService->titleFor($submission),
                    'record_ref'    => $submission->recordReference(),
                ];
            });

        return Inertia::render('Forms/Tasks', ['tasks' => $tasks->values()]);
    }

    /* ---------------------------------------------------------------
     *  RECORD ENTRY  – the review/act page for one entry of a record
     * --------------------------------------------------------------- */

    /**
     * Land on a single case — kept so notification deep links and the RN app
     * keep working now that a submission and its case are the same object.
     */
    public function adminViewSubmission($id) {
        $submission = FormSubmission::findOrFail($id);

        return redirect()->route('form.records.show', ['id' => $submission->id]);
    }

    /**
     * Renders one case: its header, answers, timeline, fill card and actions,
     * plus how it relates to other cases — the case it follows up on, and the
     * cases opened from it.
     */
    private function renderEntry(FormSubmission $submission) {
        $user = auth()->user();

        $submission->load(['form', 'submittedBy', 'rejectedBy', 'approvals.actedBy']);

        $schema      = $this->schemaService->normalize(optional($submission->form)->form_elements);
        $permissions = $this->schemaService->fieldPermissionsForViewer($submission, $user);

        $canApprove = $this->approvalService->canAct($submission, $user);
        $waitingFor = collect();

        if (!$canApprove && $submission->status === 'pending') {
            $waitingIds = $this->approvalService->waitingOn($submission);
            if (!empty($waitingIds)) {
                $waitingFor = User::whereIn('id', $waitingIds)->get();
            }
        }

        // Only fields the viewer may see, in schema order for v2 snapshots.
        $visibleAnswers = collect($submission->form_elements ?? [])
            ->filter(function ($entry) use ($permissions) {
                $id = is_array($entry) ? ($entry['id'] ?? null) : null;
                return $id === null || (($permissions[$id] ?? 'read') !== 'hidden');
            })
            ->values()
            ->all();

        // Grouped, ordered "Responses" view — mirrors the live form's section
        // layout instead of a flat list.
        [$responseSections, $responseFieldCount, $responseSectionCount] = $this->buildResponseSections($schema, $visibleAnswers);

        // Answers from earlier rounds of a looped process. They were blanked
        // out of form_elements when the round restarted, so this is the only
        // way a later handler can see what the previous one filled in.
        // The mobile entry payload reads the same method — see previousRounds().
        $rounds         = $this->approvalService->previousRounds($submission, $schema, $permissions);
        $previousRounds = $this->buildRoundSections($schema, $rounds);

        // When the current stage is a fill phase this viewer can act on,
        // render their editable section on the review page.
        $fillStage    = null;
        $fillElements = [];
        $fillAnswers  = [];
        $fillTree     = [];
        $fillPrevious = [];
        $currentStage = $submission->currentStage();

        if ($canApprove && $currentStage && $currentStage->isFillNode()) {
            $stagePermissions = $this->schemaService->resolveFieldPermissions($schema, $currentStage->field_permissions ?: []);
            $editableIds      = array_keys(array_filter($stagePermissions, fn ($level) => $level === 'edit'));
            $fillAnswers      = $this->schemaService->answersById($submission->form_elements, $schema);
            $fillElements     = collect($schema['elements'] ?? [])
                ->filter(fn ($e) => ($e['kind'] ?? 'field') === 'field' && in_array($e['id'], $editableIds, true))
                ->values()
                ->all();

            // Render tree trimmed to the editable fields, keeping the form's
            // group structure so the section looks like the real form.
            // Description blocks are instructions, not inputs: they ride
            // along whenever their group has at least one editable field
            // (and aren't explicitly hidden from this stage).
            foreach ($this->schemaService->renderTree($schema) as $item) {
                if ($item['kind'] === 'group') {
                    $members = array_values(array_filter(
                        $item['elements'],
                        function ($e) use ($editableIds, $stagePermissions) {
                            $kind = $e['kind'] ?? 'field';
                            if ($kind === 'field') {
                                return in_array($e['id'], $editableIds, true);
                            }
                            return $kind === 'description'
                                && ($stagePermissions[$e['id']] ?? 'read') !== 'hidden';
                        }
                    ));
                    $hasEditableField = collect($members)->contains(fn ($e) => ($e['kind'] ?? 'field') === 'field');
                    if ($hasEditableField) {
                        $item['elements'] = $members;
                        $fillTree[] = $item;
                    }
                } else {
                    $element = $item['element'];
                    $kind    = $element['kind'] ?? 'field';
                    if ($kind === 'field' && in_array($element['id'], $editableIds, true)) {
                        $fillTree[] = $item;
                    } elseif ($kind === 'description'
                              && ($stagePermissions[$element['id']] ?? 'read') === 'edit') {
                        // Ungrouped description explicitly assigned to this stage.
                        $fillTree[] = $item;
                    }
                }
            }

            // What the last round put in these same boxes. Rendered as a hint
            // under each input; reference only, never written into the form.
            $fillPrevious = $this->approvalService->latestPreviousAnswers($rounds, $editableIds);

            $fillStage = $currentStage;
        }

        // Case framing: title, reference, status, and the case links.
        // Closing and reopening belong to whoever opened the case — see
        // FormRecordService::canClose(). form_admin no longer grants it, so the
        // page needs no admin flag at all.
        $canClose = $this->recordService->canClose($submission, $user);

        // The case this one followed up on, and the ones opened from it. Both
        // are filtered to what the viewer may see: a link must not become a
        // side channel onto work they have no part in.
        $parentCase = $submission->parent && $this->recordService->canView($submission->parent, $user)
            ? $submission->parent
            : null;
        $childCases = $submission->children()->with(['form', 'submittedBy'])->get()
            ->filter(fn ($child) => $this->recordService->canView($child, $user))
            ->values();

        // Starting a follow-up is offered from any case that can be a parent —
        // including a completed or closed one, which is the whole point.
        $canFollowUp = $submission->canBeParent()
            && $this->schemaService->canSubmit(optional($submission->form)->settings, $user);

        // The progress timeline: the blocking steps, and whether a runtime
        // branch or loop may still add more.
        $blockingStages = $submission->approvals->filter(fn ($row) => $row->isBlockingNode())->values();
        $currentIndex   = $currentStage ? $blockingStages->search(fn ($row) => $row->id === $currentStage->id) : false;
        $nextStage      = $currentIndex !== false ? $blockingStages->get($currentIndex + 1) : null;
        $hasRejectedRow = $blockingStages->contains(fn ($row) => $row->status === 'rejected');

        // The submitter's own controls over this entry.
        $isMine = (int) $submission->submitted_by === (int) $user->id;

        return Inertia::render('Forms/Record', [
            'record'         => [
                'id'           => $submission->id,
                'reference'    => $submission->recordReference(),
                'title'        => $this->recordService->titleFor($submission),
                'status'       => $submission->status,
                'open'         => $submission->isRecordOpen(),
                'form'         => [
                    'id'          => $submission->form_id,
                    'name'        => optional($submission->form)->name ?? 'N/A',
                    'description' => optional($submission->form)->description,
                ],
                'submitted_by' => optional($submission->submittedBy)->name ?? 'Unknown',
                'submitted_at' => $submission->created_at->format('d M Y, h:i A'),
                'closed'       => $submission->isRecordOpen() ? null : [
                    'remark' => $submission->record_closed_remark,
                    'by'     => optional($submission->recordClosedBy)->name ?? 'an administrator',
                    'at'     => optional($submission->record_closed_at)->format('d M Y, h:i A'),
                ],
            ],
            'parentCase'     => $parentCase ? CaseLinkResource::make($parentCase)->resolve() : null,
            'childCases'     => CaseLinkResource::collection($childCases)->resolve(),
            'canFollowUp'    => $canFollowUp,
            'canClose'       => $canClose,
            'responses'      => [
                'sections'     => ResponseSectionResource::collection($responseSections)->resolve(),
                'fieldCount'   => $responseFieldCount,
                'sectionCount' => $responseSectionCount,
            ],
            'previousRounds' => collect($previousRounds)->map(fn ($round) => [
                'iteration'   => $round['iteration'],
                'closed_at'   => $round['closed_at'] ? \Carbon\Carbon::parse($round['closed_at'])->format('d M Y H:i') : null,
                'actors'      => $round['actors'],
                'field_count' => $round['field_count'],
                'sections'    => ResponseSectionResource::collection($round['sections'])->resolve(),
            ])->values(),
            'timeline'       => [
                'submitted_on'   => $submission->created_at->format('d M'),
                'stages'         => ApprovalStageResource::collection($blockingStages)->resolve(),
                // Nothing further down the chain is "in progress" once the case
                // is no longer pending.
                'current_id'     => $submission->status === 'pending' ? optional($currentStage)->id : null,
                'legacy_reject'  => $submission->rejected_by && !$hasRejectedRow ? [
                    'by'     => optional($submission->rejectedBy)->name,
                    'remark' => $submission->rejected_remark,
                ] : null,
                // A runtime branch / loop may still add stages.
                'process_open'   => $submission->status === 'pending'
                    && isset($submission->process_snapshot['cursor'])
                    && empty($submission->process_snapshot['complete']),
            ],
            'review'         => [
                'canApprove' => $canApprove && !$fillStage,
                'waitingFor' => $waitingFor->pluck('name')->values(),
                'stageName'  => optional($currentStage)->name,
                'nextStage'  => optional($nextStage)->name,
            ],
            'fillStage'      => $fillStage ? [
                'name'     => $fillStage->name,
                'elements' => $fillElements,
                'tree'     => $fillTree,
                'answers'  => (object) $fillAnswers,
                // Last round's answers, shown as a hint under each input.
                'previous' => (object) $fillPrevious,
            ] : null,
            'schema'         => $schema,
            'entry'          => [
                'canEdit'   => $isMine && $submission->status === 'pending' && $submission->isUntouched(),
                // Cancelling withdraws your own case while it is still pending.
                // Admins have Close, which does the same but demands a reason.
                'canCancel' => $isMine && $submission->status === 'pending',
                'canClone'  => $isMine && (bool) optional($submission->form)->is_enabled,
            ],
            'people'         => User::orderBy('name')->get(['id', 'name']),
        ]);
    }

    public function completeFillStage(Request $request, $id) {
        $request->validate(['form_data' => 'required|json']);

        $submission = FormSubmission::with(['form', 'approvals'])->findOrFail($id);

        $uploads   = app(FormUploadService::class);
        $byElement = $uploads->bundledFiles($request);

        // Placeholder values so a mandatory `file` field in this stage passes;
        // the real ones are written once the stage is accepted.
        $updates = array_merge(
            $uploads->keyAnswers(json_decode($request->form_data, true) ?: []),
            $uploads->pendingAnswers($byElement)
        );

        $result = $this->approvalService->completeFill($submission, auth()->user(), $updates, $this->assigneeIdsFrom($request));

        if (!empty($result['needs_assignee'])) {
            session()->flash('needs_assignee', [
                'name'   => $result['needs_assignee']['name'] ?? 'Handler',
                'action' => route('form.admin.fill', $id),
                'fields' => ['form_data' => (string) $request->form_data],
            ]);

            // Straight to the record page, not form.admin.view: that redirects
            // again, and flashed data only survives a single redirect.
            return redirect()->route('form.records.show', $id);
        }

        // Files last, like IFE, and only once the stage is accepted.
        $submission->refresh();
        $keep    = $uploads->keptBySnapshot($byElement, $submission->form_elements ?? []);
        $answers = $uploads->storeFor($submission, $keep, auth()->id());
        $uploads->applyToSnapshot($submission, $answers);

        if ($result['ok']) {
            alert()->success('Section submitted', $result['message'])->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
        } else {
            alert()->error('Not saved', $result['message'])->showConfirmButton();
            if (!empty($result['errors'])) {
                return redirect()->route('form.records.show', $id)->withErrors($result['errors']);
            }
        }

        return redirect()->route('form.records.show', $id);
    }

    public function approveSubmission(Request $request, $id) {
        $request->validate(['remark' => 'nullable|string|max:1000']);

        $submission = FormSubmission::with(['form', 'approvals'])->findOrFail($id);

        $result = $this->approvalService->approve($submission, auth()->user(), $request->remark, $this->assigneeIdsFrom($request));

        if (!empty($result['needs_assignee'])) {
            session()->flash('needs_assignee', [
                'name'   => $result['needs_assignee']['name'] ?? 'Handler',
                'action' => route('form.admin.approve', $id),
                'fields' => ['remark' => (string) $request->remark],
            ]);

            return redirect()->route('form.records.show', $id);
        }

        if ($result['ok']) {
            alert()->success('Approved', $result['message'])->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
        } else {
            alert()->error('Not allowed', $result['message'])->showConfirmButton();
        }

        return redirect()->route('form.records.show', $id);
    }

    public function rejectSubmission(Request $request, $id) {
        $request->validate(['remark' => 'required|string|max:1000']);

        $submission = FormSubmission::with(['form', 'approvals'])->findOrFail($id);

        if (in_array($submission->status, ['rejected', 'cancelled'])) {
            return redirect()->route('form.records.show', $id);
        }

        $result = $this->approvalService->reject($submission, auth()->user(), $request->remark);

        if ($result['ok']) {
            alert()->success('Rejected', $result['message'])->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
        } else {
            alert()->error('Not allowed', $result['message'])->showConfirmButton();
        }

        return redirect()->route('form.records.show', $id);
    }

    /**
     * Handler pick sent along with an action that activates a
     * runtime-assignee step ("choose who handles this next").
     */
    private function assigneeIdsFrom(Request $request): array
    {
        return array_values(array_filter(array_map('intval', (array) $request->input('next_assignee_ids', []))));
    }

    /* ---------------------------------------------------------------
     *  SUBMISSION HISTORY (shown on the fill page when enabled)
     * --------------------------------------------------------------- */

    public function exportSubmissions(Request $request) {
        abort_unless(auth()->user()->can('form_admin'), 403);

        $dateFrom = $request->filled('date_from') ? $request->date_from : now()->startOfYear()->toDateString();
        $dateTo   = $request->filled('date_to')   ? $request->date_to   : now()->toDateString();

        $applyFilters = function ($q) use ($request, $dateFrom, $dateTo) {
            $q->whereBetween('created_at', [$dateFrom . ' 00:00:00', $dateTo . ' 23:59:59']);
            if ($request->filled('form_id')) {
                $q->where('form_id', $request->form_id);
            }
            if ($request->filled('search')) {
                $search = $request->search;
                $q->where(function ($sq) use ($search) {
                    $sq->whereHas('submittedBy', fn($x) => $x->where('name', 'like', "%{$search}%"))
                       ->orWhereHas('form', fn($x) => $x->where('name', 'like', "%{$search}%"));
                });
            }
        };

        $query = FormSubmission::with(['form', 'submittedBy', 'rejectedBy', 'approvals.actedBy']);
        $applyFilters($query);
        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }
        $submissions = $query->orderBy('created_at', 'desc')->get();

        // Build title description
        $filterDesc = 'Date: ' . $dateFrom . ' to ' . $dateTo;
        if ($request->filled('status')) {
            $filterDesc .= '  |  Status: ' . ucfirst($request->status);
        }
        if ($request->filled('search')) {
            $filterDesc .= '  |  Search: "' . $request->search . '"';
        }
        if ($request->filled('form_id')) {
            $formName = Form::find($request->form_id)?->name;
            if ($formName) {
                $filterDesc .= '  |  Form: ' . $formName;
            }
        }

        $rows = [];

        // Row 1 – title
        $rows[] = ['Form Submissions Export  –  ' . $filterDesc];

        // Row 2 – headers
        $rows[] = [
            '#', 'Form Name', 'Record', 'Record Title', 'Submitted By', 'Submitted At', 'Status',
            'Approvals',
            'Rejected By', 'Rejected Remark',
            'Form Responses',
        ];

        // Data rows
        foreach ($submissions as $i => $submission) {
            // Build formatted responses string for the single cell
            $responseLines = [];
            foreach (($submission->form_elements ?? []) as $idx => $el) {
                if (!empty($el['hidden'])) {
                    continue;
                }
                $label = $el['label'] ?? ('Field ' . ($idx + 1));
                $value = $el['value'] ?? null;
                $type  = $el['type']  ?? '';
                $displayValue = '';
                if ($type === 'gps') {
                    $displayValue = is_array($value) && isset($value['lat'], $value['lng'])
                        ? $value['lat'] . ', ' . $value['lng']
                          . (isset($value['accuracy']) ? ' (±' . round((float) $value['accuracy']) . ' m)' : '')
                          . (!empty($value['captured_at']) ? ' @ ' . $value['captured_at'] : '')
                        : '(not provided)';
                } elseif (is_array($value)) {
                    if ($type === 'file') {
                        $names = array_filter(array_map(fn($f) => is_array($f) ? ($f['name'] ?? null) : (string) $f, $value), fn($n) => $n !== null && $n !== '');
                        $displayValue = count($names) ? implode(', ', $names) : '(not provided)';
                    } else {
                        $filtered = array_filter($value, fn($v) => $v !== null && $v !== '');
                        $displayValue = count($filtered) ? implode(', ', $filtered) : '(not provided)';
                    }
                } elseif ($type === 'user') {
                    $displayValue = $this->schemaService->userLabel($value) ?: '(not provided)';
                } else {
                    $displayValue = ($value !== null && $value !== '') ? $value : '(not provided)';
                }
                $num = $idx + 1;
                $responseLines[] = "[{$num}] {$label}";
                $responseLines[] = "      {$displayValue}";
                $responseLines[] = ''; // blank separator line
            }
            // Trim trailing blank line
            while (count($responseLines) && end($responseLines) === '') {
                array_pop($responseLines);
            }
            $formResponses = implode("\n", $responseLines);

            // One line per stage: "[1] Manager Approval – Approved by X (12 Jul 2026) "remark""
            $approvalLines = [];
            foreach ($submission->approvals as $stage) {
                if (!$stage->isBlockingNode()) {
                    continue;
                }
                $line = '[' . $stage->sequence . '] ' . $stage->name
                    . ((int) $stage->iteration >= 2 ? ' (Round ' . $stage->iteration . ')' : '')
                    . ' – ' . ucfirst($stage->status);
                if ($stage->acted_by) {
                    $line .= ' by ' . (optional($stage->actedBy)->name ?? ('User #' . $stage->acted_by));
                }
                if ($stage->acted_at) {
                    $line .= ' (' . $stage->acted_at->format('d M Y H:i') . ')';
                }
                if ($stage->remark) {
                    $line .= ' "' . $stage->remark . '"';
                }
                $approvalLines[] = $line;
            }

            $rows[] = [
                $i + 1,
                $submission->form->name ?? 'N/A',
                $submission->recordReference(),
                $submission->record_title ?? '',
                $submission->submittedBy->name ?? 'Unknown',
                $submission->created_at->format('d M Y H:i'),
                ucfirst($submission->status),
                implode("\n", $approvalLines),
                $submission->rejectedBy->name ?? '',
                $submission->rejected_remark ?? '',
                $formResponses,
            ];
        }

        $filename = 'form-submissions-' . $dateFrom . '-to-' . $dateTo . '.xlsx';
        return Excel::download(new FormSubmissionsExport($rows), $filename);
    }

    /* ---------------------------------------------------------------
     *  Helpers
     * --------------------------------------------------------------- */

    /**
     * Groups a submission's visible answers into the form's own section
     * (group) layout, in schema order, for the review page's "Responses"
     * card — instead of a flat field list.
     *
     * Answers whose id no longer matches a schema element (legacy
     * snapshots, or fields removed from the form since) are collected into
     * a trailing unlabeled section so nothing is silently dropped.
     *
     * @return array{0: array, 1: int, 2: int} [sections, fieldCount, sectionCount]
     */
    private function buildResponseSections(array $schema, array $visibleAnswers): array
    {
        $answersById = collect($visibleAnswers)
            ->filter(fn ($e) => is_array($e) && !empty($e['id']))
            ->keyBy('id');
        $legacy = collect($visibleAnswers)
            ->filter(fn ($e) => !is_array($e) || empty($e['id']))
            ->values();

        $sections = [];
        $pending  = [];
        $fieldCount   = 0;
        $sectionCount = 0;

        $flushPending = function () use (&$pending, &$sections) {
            if (!empty($pending)) {
                $sections[] = ['label' => null, 'fields' => $pending];
                $pending = [];
            }
        };

        foreach ($this->schemaService->renderTree($schema) as $item) {
            if ($item['kind'] === 'group') {
                $fields = [];
                foreach ($item['elements'] as $element) {
                    if (($element['kind'] ?? 'field') !== 'field' || !$answersById->has($element['id'])) {
                        continue;
                    }
                    $fields[] = ['element' => $element, 'answer' => $answersById->get($element['id'])];
                }
                if (!empty($fields)) {
                    $flushPending();
                    $sections[] = ['label' => $item['group']['label'] ?? null, 'fields' => $fields];
                    $fieldCount   += count($fields);
                    $sectionCount++;
                }
            } else {
                $element = $item['element'];
                if (($element['kind'] ?? 'field') !== 'field' || !$answersById->has($element['id'])) {
                    continue;
                }
                $pending[] = ['element' => $element, 'answer' => $answersById->get($element['id'])];
                $fieldCount++;
            }
        }
        $flushPending();

        if ($legacy->isNotEmpty()) {
            $sections[] = [
                'label'  => null,
                'fields' => $legacy->map(fn ($answer) => ['element' => null, 'answer' => $answer])->all(),
            ];
            $fieldCount += $legacy->count();
        }

        return [$sections, $fieldCount, $sectionCount];
    }

    /**
     * Lays the archived rounds out for the entry page, reusing the form's own
     * section structure so history looks exactly like the Responses card.
     *
     * The values come from FormApprovalService::previousRounds(); this only
     * turns each round's answers back into the {id,type,label,value} rows that
     * `form_elements` holds, so buildResponseSections() can group them and
     * _response-field can render them — no second renderer.
     *
     * @param  array  $rounds  output of FormApprovalService::previousRounds()
     * @return array  [['iteration','closed_at','actors','sections','field_count'], ...]
     */
    private function buildRoundSections(array $schema, array $rounds): array
    {
        return collect($rounds)->map(function ($round) use ($schema) {
            $rows = collect($round['answers'])
                ->map(fn ($answer) => [
                    'id'     => $answer['id'],
                    'type'   => $answer['type'],
                    'label'  => $answer['label'],
                    'value'  => $answer['value'],
                    'hidden' => false,
                ])
                ->all();

            [$sections, $fieldCount] = $this->buildResponseSections($schema, $rows);

            return [
                'iteration'   => $round['round'],
                'closed_at'   => $round['closed_at'],
                'actors'      => collect($round['handled_by'])->pluck('name')->implode(', '),
                'sections'    => $sections,
                'field_count' => $fieldCount,
            ];
        })->all();
    }

    /**
     * user id => name map for every approver/recipient referenced anywhere
     * in a process definition (used by the preview page).
     */
    private function userNamesInProcess(array $process): array
    {
        $ids = [];

        $collect = function ($nodes) use (&$collect, &$ids) {
            foreach ($nodes as $node) {
                foreach (($node['approver_ids'] ?? []) as $id) {
                    $ids[] = (int) $id;
                }
                foreach (($node['user_ids'] ?? []) as $id) {
                    $ids[] = (int) $id;
                }
                foreach (($node['branches'] ?? []) as $branch) {
                    $collect($branch['nodes'] ?? []);
                }
            }
        };

        $collect($process['nodes'] ?? []);

        if (empty($ids)) {
            return [];
        }

        return User::whereIn('id', array_unique($ids))->pluck('name', 'id')->all();
    }
}
