<?php

namespace App\Http\Controllers\MobileApp;

use App\Helpers\Helper;
use App\Http\Controllers\Controller;
use App\Http\Requests\LeadRequest;
use App\Models\DocumentUpload;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Http\File;
use Illuminate\Http\Request;
use App\Models\Leads;
use App\Models\States;
use App\Models\Cities;
use App\Models\IFEReport;
use App\Models\OutletRecommendation;
use App\Models\Tasks;
use App\Services\TaskRisk;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use App\Jobs\FirebaseNotification;
use App\Jobs\RefreshOutletRecommendations;
use App\Services\OrderService;
use App\Services\Recommendation\RecommendationService;
use Log;
use Throwable;


class LeadController extends Controller 
{

    public function index(Request $request)
    {
        $user = $request->user();

        // 1. INPUT HANDLING 
        $input = [
            'id'            => $request->input('id'),
            'customerID'    => $request->input('customerID'),
            'leadType'      => $request->input('leadType'), 
            'leadName'      => $request->input('leadName'),
            'leadMobile'    => $request->input('leadMobile'),
            'businessName'  => $request->input('businessName'),
            'state'         => $request->input('state'),
            'city'          => $request->input('city'),
            'startDate'     => $request->input('startDate'),
            'endDate'       => $request->input('endDate'),
            'page'          => $request->input('page', 1),
        ];

        // 2. INITIALIZE THE QUERY, SCOPED TO WHAT THE USER MAY SEE
        $query = Leads::visibleTo($user);

        // 3. APPLYING FILTERS TO THE QUERY
        // The `when` method only applies the filter if the input value is not empty.

        // Lead Type filter
        $query->when($input['leadType'] === 'Y', fn($q) => $q->whereNotNull('customer_id'));
        $query->when($input['leadType'] === 'N', fn($q) => $q->whereNull('customer_id'));

        // Standard 'where' filters
        $query->when($input['id'], fn($q, $id) => $q->where('id', $id));
        $query->when($input['customerID'], fn($q, $id) => $q->where('customer_id', $id));
        $query->when($input['state'], fn($q, $id) => $q->where('state_id', $id));
        $query->when($input['city'], fn($q, $id) => $q->where('city_id', $id));

        // 'like' filters for searching
        $query->when($input['leadMobile'], fn($q, $mobile) => $q->where('mobile', 'like', "%{$mobile}%"));

        // Combined name/business name filter
        if ($input['leadName'] || $input['businessName']) {
            $query->where(function ($q) use ($input) {
                $q->when($input['leadName'], function ($subQuery, $name) {
                    $subQuery->where('name', 'like', "%{$name}%");
                });
                $q->when($input['businessName'], function ($subQuery, $bizName) {
                    // Use orWhere for the second condition
                    $subQuery->orWhere('business_name', 'like', "%{$bizName}%");
                });
            });
        }

        // Date range filter
        if ($input['startDate'] && $input['endDate']) {
            $from = Carbon::parse(substr($input['startDate'], 0, 10))->startOfDay();
            $to = Carbon::parse(substr($input['endDate'], 0, 10))->endOfDay();
            $query->whereBetween('created_at', [$from, $to]);
        }

        // If only start date is provided, filter from that date to now
        if ($input['startDate'] && !$input['endDate']) {
            $from = Carbon::parse(substr($input['startDate'], 0, 10))->startOfDay();
            $query->where('created_at', '>=', $from);
        }
        // If only end date is provided, filter from the beginning of time to that date
        if (!$input['startDate'] && $input['endDate']) {
            $to = Carbon::parse(substr($input['endDate'], 0, 10))->endOfDay();
            $query->where('created_at', '<=', $to);
        }
      
        // One search box: name, shop, mobile or customer ID.
        if ($request->filled('search')) {
            $keyword = $request->input('search');
            $query->where(fn ($q) => $q->where('name', 'like', "%{$keyword}%")
                ->orWhere('business_name', 'like', "%{$keyword}%")
                ->orWhere('mobile', 'like', "%{$keyword}%")
                ->orWhere('customer_id', 'like', "%{$keyword}%"));
        }

        // The outlet's area (the manager's area filter).
        $query->when($request->input('area'), fn ($q, $area) => $q->where('ife_area_id', $area));

        // Counts for the chips (All, Customers, Prospects, Suggestions), before
        // the kind or suggestions filter narrows the list.
        $suggestedIds = OutletRecommendation::where('estimated_monthly_value', '>', 0)->pluck('lead_id');
        $counts = [
            'all'       => (clone $query)->count(),
            'customer'  => (clone $query)->whereNotNull('customer_id')->count(),
            'prospect'  => (clone $query)->whereNull('customer_id')->count(),
            'suggested' => (clone $query)->whereIn('id', $suggestedIds)->count(),
        ];

        // Customer (has a customer ID) or prospect, and outlets with suggestions.
        $query->when($request->input('kind') === 'customer', fn ($q) => $q->whereNotNull('customer_id'));
        $query->when($request->input('kind') === 'prospect', fn ($q) => $q->whereNull('customer_id'));
        $query->when($request->boolean('suggested'), fn ($q) => $q->whereIn('id', $suggestedIds));

        // 4. EXECUTE THE QUERY AND PAGINATE
        $perPage = (int) $request->input('per_page', 10);
        $page    = max(1, (int) $request->input('page', 1));

        if ($request->input('sort') === 'open_work') {
            // Open work first: overdue, then at risk, then due today, then any
            // open task; the rest by name. Needs every match, so sort in memory.
            $all  = $query->get();
            $work = $this->openWork($request->user(), $all->pluck('id'));
            $all  = $all->sortBy(function ($lead) use ($work) {
                $w    = $work[$lead->id] ?? null;
                $rank = !$w ? 4 : ($w['overdue'] ? 0 : ($w['at_risk'] ? 1 : ($w['due_today'] ? 2 : ($w['open_tasks'] ? 3 : 4))));

                return [$rank, $w['next_due_at'] ?? '9999', mb_strtolower($lead->business_name ?: $lead->name)];
            })->values();
            $total = $all->count();
            $items = $all->slice(($page - 1) * $perPage, $perPage)->values();
            $pagination = [
                'total'        => $total,
                'per_page'     => $perPage,
                'current_page' => $page,
                'last_page'    => max(1, (int) ceil($total / max(1, $perPage))),
            ];
        } else {
            $leads = $query->orderBy('created_at', 'desc')->paginate($perPage);
            $items = collect($leads->items());
            $work  = $this->openWork($request->user(), $items->pluck('id'));
            $pagination = [
                'total'         => $leads->total(),
                'per_page'      => $leads->perPage(),
                'current_page'  => $leads->currentPage(),
                'last_page'     => $leads->lastPage(),
            ];
        }

        $extras = $this->listExtras($items->pluck('id'));

        $data = [];
        $data['leads']          = $items->map(function ($lead) use ($work, $extras) {
            return [
                'id'                    => $lead->id,
                'name'                  => $lead->name,
                'mobile'                => $lead->mobile,
                'email'                 => $lead->email,
                'creator_id'            => $lead->created_by,
                'lead_created_by'       => User::find($lead->belong_to)->name ?? null,
                'source'                => Helper::getLeadSource($lead->source),
                'lead_source_id'        => $lead->source,
                'business_category'     => Helper::getBusinessCategory($lead->business_category),
                'business_category_id'  => $lead->business_category,
                'business_name'         => $lead->business_name,
                'subscriber'            => User::find($lead->belong_to)->name ?? null,
                'subscriber_id'         => $lead->belong_to,
                'address'               => $lead->address,
                'state'                 => States::find($lead->state_id)->name ?? null,
                'state_id'              => $lead->state_id,
                'city'                  => Cities::find($lead->city_id)->name ?? null,
                'city_id'               => $lead->city_id,
                'postcode'              => $lead->postcode,
                'remarks'               => $lead->remark,
                'created_at'            => $lead->created_at->toDateString(),
                // Customer once it has a customer ID; a prospect before that.
                'kind'                  => $lead->customer_id ? 'customer' : 'prospect',
                'customer_id'           => $lead->customer_id,
                'last_visit_at'         => $extras['visits'][$lead->id] ?? null,
                'suggested_count'       => $extras['suggested'][$lead->id]['count'] ?? 0,
                'suggested_value'       => $extras['suggested'][$lead->id]['value'] ?? 0,
            ] + ($work[$lead->id] ?? self::NO_WORK) + $this->outletProfile($lead);
        });
        $data['pagination']    = $pagination;
        $data['counts']        = $counts;
        // 5. RETURN THE PAGINATED RESPONSE
        return $this->response_ok($data, 'Leads retrieved successfully.');
    }

    public function getLeadByID(Request $request)
    {
        try {
            $leadId = $request->input('leadID');
            if (!$leadId) {
                return $this->response_failed('Lead ID is required.');
            }

            $lead = Leads::with(['documentUploads', 'tasks'])->visibleTo($request->user())->find($leadId);
            if (!$lead) {
                return $this->response_failed('We could not find this outlet.');
            }

            $data = $this->outletProfile($lead) + [
                'id'                    => $lead->id,
                'name'                  => $lead->name,
                'mobile'                => $lead->mobile,
                'email'                 => $lead->email,
                'creator_id'            => $lead->created_by,
                'lead_created_by'       => User::find($lead->belong_to)->name ?? null,
                'source'                => Helper::getLeadSource($lead->source),
                'lead_source_id'        => $lead->source,
                'business_category'     => Helper::getBusinessCategory($lead->business_category),
                'business_category_id'  => $lead->business_category,
                'business_name'         => $lead->business_name,
                'subscriber'            => User::find($lead->belong_to)->name ?? null,
                'subscriber_id'         => $lead->belong_to,
                'address'               => $lead->address,
                'state'                 => States::find($lead->state_id)->name ?? null,
                'state_id'              => $lead->state_id,
                'city'                  => Cities::find($lead->city_id)->name ?? null,
                'city_id'               => $lead->city_id,
                'postcode'              => $lead->postcode,
                'remarks'               => $lead->remark,
                'attachments'           => Helper::map_document_uploads($lead->documentUploads),
                'created_at'            => $lead->created_at->toDateString(),
                // Customer once it has a customer ID; a prospect before that.
                'customer_id'           => $lead->customer_id,
                'kind'                  => $lead->customer_id ? 'customer' : 'prospect',
            ];

            return $this->response_success($data, 'Lead retrieved successfully.');
        } catch (Throwable $e) {
            return $this->response_failed('Failed to retrieve lead: ' . $e->getMessage());
        } catch (\Exception $f) {
            return $this->response_failed('Failed to retrieve lead: ' . $f->getMessage());
        }
    }

    public function getLeadMedia(Request $request)
    {
        $leadId = $request->input('leadID');

        if (!$leadId) {
            return $this->response_failed('Lead ID is required.');
        }

        $lead = Leads::with('documentUploads')->visibleTo($request->user())->find($leadId);

        if (!$lead) {
            return $this->response_failed('We could not find this outlet.');
        }

        $data = Helper::media_documents_array($lead->documentUploads);

        return $this->response_success($data, 'Lead media retrieved successfully.');
    }

    public function getLeadTasks(Request $request) {
        $leadId = $request->input('leadID');
        if (!$leadId) {
            return $this->response_failed('Lead ID is required.');
        }

        $lead = Leads::with('tasks')->visibleTo($request->user())->find($leadId);
        if (!$lead) {
            return $this->response_failed('We could not find this outlet.');
        }

        $data = [];
        $data['tasks']              = $lead->tasks->map(function ($task) {
            return [
                'id'                    => $task->id,
                'title'                 => $task->title,
                'subscriber'            => $task->users->where('role', 2)->first()->user->name ?? null,
                'due_date'              => $task->due_date ?? null,
                'unread_notification'   => count($task->has_unread_notification ?? []),
                'status'                => $task->status,
                'sub_subscribers'       => $task->users->where('role', 6)->pluck('user.name')->toArray(),
                'owners'                => $task->users->where('role', 4)->pluck('user.name')->toArray(),
                'viewers'               => $task->users->where('role', 5)->pluck('user.name')->toArray(),
                'task_start_date'       => $task->start_date ?? null,
                'task_due_date'         => $task->due_date ?? null,
                'task_start_time'       => $task->start_time ?? null,
                'task_due_time'         => $task->due_time ?? null,
            ];
        });

        return $this->response_success($data, 'Lead tasks retrieved successfully.');
    }

    public function getFilterOptions(Request $request)
    {
        $data = [
            'business_category' => Helper::getBusinessCategoryListingForMobile(),
            'lead_source'       => Helper::getLeadSourceListingForMobile(),

            'states'            => Helper::formatForDropdown(
                States::select('id', 'name')->get(),
                'id',
                'name'
            ),
            'cities'            => Helper::formatForDropdown(
                Cities::select('id', 'name', 'state_id')->get(),
                'id',
                'name'
            ),
            // Outlet profile pickers.
            'size_bands'        => collect(Leads::SIZE_BANDS)->map(fn ($label, $value) => ['value' => $value, 'label' => $label])->values()->all(),
            'segments'          => collect(Leads::SEGMENTS)->map(fn ($label, $value) => ['value' => $value, 'label' => $label])->values()->all(),
        ];

        return $this->response_success($data, 'Filter options retrieved successfully.');
    }

    public function addLead(LeadRequest $request)
    {

        $user = $request->user();

        if (!$user->can('create_lead')) {
            return $this->response_failed('You do not have permission to create a lead.');
        }

        $validatedData = $request->validated();

        DB::beginTransaction();
        try {
            $lead = new Leads([
                'receiving_date'    => $validatedData['receive_date'],
                'name'              => $validatedData['name'],
                'mobile'            => $validatedData['mobile'],
                'belong_to'         => $user->id,
                'assign_to'         => null,
                'hq_checker'        => $user->seesAllRecords() ? $user->id : null,
                'business_name'     => $validatedData['business_name'] ?? null,
                'customer_id'       => $validatedData['customer_id'] ?? null,
                'source'            => $validatedData['leadsource'] ?? null,
                'business_category' => $validatedData['businesscat'] ?? null,
                'email'             => $validatedData['email'] ?? null,
                'address'           => $validatedData['address'] ?? null,
                'state_id'          => $validatedData['state_id'] ?? null,
                'city_id'           => $validatedData['city_id'] ?? null,
                'postcode'          => $validatedData['postcode'] ?? null,
                'remark'            => $validatedData['remark'] ?? null,
                'size_band'         => $validatedData['size_band'] ?? null,
                'seats'             => $validatedData['seats'] ?? null,
                'segment'           => $validatedData['segment'] ?? null,
            ]);

            if ($request->has('gps') && ($error = $lead->applyLocationStamp($request->input('gps')))) {
                DB::rollBack();
                return $this->response_failed('Validation failed.', ['gps' => $error]);
            }

            $lead->save();

            if ($request->hasFile('file')) {
                $this->upload($request, $lead->id);
            }
    
            DB::commit();

            $runJobFirebase = (new FirebaseNotification($lead->id, 'lead', '0'));
            dispatch($runJobFirebase);

            // Reload the lead to include the newly created document uploads
            return $this->response_success(['lead' => $lead], 'Lead created successfully.');

        } catch (Throwable $e) {

            DB::rollBack();
            return $this->response_failed('Failed to create lead: ' . $e->getMessage());

        } catch (\Exception $f) {

            DB::rollBack();
            return $this->response_failed('Failed to create lead: ' . $f->getMessage());
        }        
    }

    public function editLead(LeadRequest $request)
    {
        $user = $request->user();

        if (!$user->can('edit_lead')) {
            return $this->response_failed('You do not have permission to edit a lead.');
        }

        $validatedData = $request->validated();

        DB::beginTransaction();
        try {
            // belong_to (creator) and assign_to (latest subscriber) are not
            // the editor's to change: resetting them used to hide the lead
            // from the rep it belongs to.
            $lead = Leads::visibleTo($user)->findOrFail($validatedData['id']);
            $lead->fill([
                'receiving_date'    => $validatedData['receive_date'],
                'name'              => $validatedData['name'],
                'mobile'            => $validatedData['mobile'],
                'business_name'     => $validatedData['business_name'] ?? null,
                'customer_id'       => $validatedData['customer_id'] ?? null,
                'source'            => $validatedData['leadsource'] ?? null,
                'business_category' => $validatedData['businesscat'] ?? null,
                'email'             => $validatedData['email'] ?? null,
                'address'           => $validatedData['address'] ?? null,
                'state_id'          => $validatedData['state_id'] ?? null,
                'city_id'           => $validatedData['city_id'] ?? null,
                'postcode'          => $validatedData['postcode'] ?? null,
                'remark'            => $validatedData['remark'] ?? null,
                'size_band'         => $validatedData['size_band'] ?? null,
                'seats'             => $validatedData['seats'] ?? null,
                'segment'           => $validatedData['segment'] ?? null,
            ]);

            // Absent: keep the saved location. Present (even empty): replace it.
            if ($request->has('gps') && ($error = $lead->applyLocationStamp($request->input('gps')))) {
                DB::rollBack();
                return $this->response_failed('Validation failed.', ['gps' => $error]);
            }

            $lead->save();

            if ($request->has('deleted_attachment_ids')) {
                $idsToDelete = $request->input('deleted_attachment_ids');

                if (is_array($idsToDelete) && !empty($idsToDelete)) {
                    $documents = DocumentUpload::whereIn('id', $idsToDelete)
                        ->where('lead_id', $lead->id)
                        ->get();

                    foreach ($documents as $doc) {
                        if (file_exists($doc->getFileFullPathAttribute())) {
                            unlink($doc->getFileFullPathAttribute());
                        }
                        $doc->delete();
                    }
                }
            }

            // --- 2. Handle NEWLY ADDED files ---
            if ($request->hasFile('file')) {
                $this->upload($request, $lead->id);
            }

            DB::commit();

            if ($lead->wasChanged(['size_band', 'seats', 'segment', 'business_category'])) {
                RefreshOutletRecommendations::dispatch([$lead->id]);
            }

            return $this->response_success(['lead' => $lead], 'Lead updated successfully.');

        } catch (Throwable $e) {

            DB::rollBack();
            return $this->response_failed('Failed to update lead: ' . $e->getMessage());
        } catch (\Exception $f) {
            DB::rollBack();
            return $this->response_failed('Failed to update lead: ' . $f->getMessage());
        }

    }

    /**
     * Visits (IFE reports) made at this outlet, newest first. Everyone who
     * can see the outlet sees all of its visits, the same as its tasks.
     */
    public function getLeadVisits(Request $request)
    {
        $lead = $this->visibleLead($request);
        if (!$lead) {
            return $this->response_failed('We could not find this outlet.');
        }

        $visits = $lead->visits()->with('createdBy:id,name')->limit(100)->get();

        return $this->response_success([
            'visits' => $visits->map(fn (IFEReport $visit) => [
                'id'                  => $visit->id,
                'visited_at'          => $visit->created_at->toDateTimeString(),
                'visited_by'          => optional($visit->createdBy)->name,
                'status'              => $visit->status,
                'problem_description' => $visit->problem_description,
                'support_required'    => $visit->support_required,
                'pic_name'            => $visit->pic_name,
                'next_followup_date'  => $visit->next_followup_date,
                'next_followup_plan'  => $visit->next_followup_plan,
                'task_id'             => $visit->task_id,
                // The location stamp as written by the app, or the place typed.
                'location'            => $visit->location,
            ])->values(),
        ], 'Lead visits retrieved successfully.');
    }

    /** Orders this outlet placed, newest first (cancelled ones included, flagged). */
    public function getLeadOrders(Request $request)
    {
        $lead = $this->visibleLead($request);
        if (!$lead) {
            return $this->response_failed('We could not find this outlet.');
        }

        $orders = $lead->orders()->with(['lines.product', 'createdBy:id,name'])->limit(100)->get();

        return $this->response_success([
            'currency' => config('ife.currency', 'RM'),
            'orders'   => $orders->map->toSummary()->values(),
        ], 'Lead orders retrieved successfully.');
    }

    /**
     * Records an order for the outlet.
     * Body: lead_id, lines [{product_id, quantity}] (array or JSON string),
     *       order_date (Y-m-d, optional, not in the future), remark (optional)
     */
    public function addLeadOrder(Request $request, OrderService $orders)
    {
        $user = $request->user();
        if (!$user->can('record_order')) {
            return $this->response_failed('Only your manager can record orders. Check with them.')->setStatusCode(403);
        }

        $lead = $this->visibleLead($request);
        if (!$lead) {
            return $this->response_failed('We could not find this outlet.');
        }

        $lines = $request->input('lines', []);
        if (is_string($lines)) {
            $lines = json_decode($lines, true);
        }
        if (!is_array($lines)) {
            return $this->response_failed('Validation failed.', ['lines' => ['lines must be an array or a JSON array string.']]);
        }

        try {
            $order = $orders->record($lead, $user, $lines, $request->input('order_date'), $request->input('remark'));
        } catch (ValidationException $e) {
            return $this->response_failed('Validation failed.', $e->errors());
        }

        return $this->response_success(['order' => $order->toSummary()], 'Order recorded successfully.');
    }

    /**
     * The outlet's "Recommended" tab: ranked products with suggested monthly
     * quantity, the gap list, estimated monthly value, and the "Why these?"
     * explanation with an opening line (written on first open, then cached).
     */
    public function getLeadRecommendations(Request $request, RecommendationService $recommendations)
    {
        $lead = $this->visibleLead($request);
        if (!$lead) {
            return $this->response_failed('We could not find this outlet.');
        }

        try {
            return $this->response_success($recommendations->forLead($lead), 'Recommendations retrieved successfully.');
        } catch (Throwable $e) {
            Log::error('Mobile recommendations failed', ['lead_id' => $lead->id, 'error' => $e->getMessage()]);
            return $this->response_failed('Failed to retrieve recommendations.');
        }
    }

    /** The lead named by lead_id (or leadID), if the caller may see it. */
    private function visibleLead(Request $request): ?Leads
    {
        $leadId = $request->input('lead_id', $request->input('leadID'));
        if (!$leadId) {
            return null;
        }

        return Leads::visibleTo($request->user())->find($leadId);
    }

    private const NO_WORK = ['open_tasks' => 0, 'overdue' => 0, 'at_risk' => 0, 'due_today' => 0, 'next_due_at' => null];

    /**
     * Open work per outlet: the tasks the caller can see that are New or In
     * Progress, with the same risk check the dashboard uses.
     *
     * @return array<int, array{open_tasks: int, overdue: int, at_risk: int, due_today: int, next_due_at: ?string}>
     */
    private function openWork(User $user, $leadIds): array
    {
        if (collect($leadIds)->isEmpty()) {
            return [];
        }

        $risk  = TaskRisk::fromConfig();
        $now   = now();
        $today = $now->toDateString();

        return Tasks::visibleTo($user)
            ->whereIn('lead_id', $leadIds)
            ->whereIn('status', TaskRisk::OPEN_STATUSES)
            ->get(['id', 'lead_id', 'status', 'start_date', 'start_time', 'due_date', 'due_time', 'creation_date'])
            ->groupBy('lead_id')
            ->map(function ($tasks) use ($risk, $now, $today) {
                $levels = $tasks->map(fn (Tasks $t) => $risk->assessTask($t, $now));
                $next   = $levels->pluck('due_at')->filter()->sort()->first();

                return [
                    'open_tasks'  => $tasks->count(),
                    'overdue'     => $levels->where('level', TaskRisk::OVERDUE)->count(),
                    'at_risk'     => $levels->where('level', TaskRisk::AT_RISK)->count(),
                    'due_today'   => $tasks->filter(fn (Tasks $t) => $t->due_date && Carbon::parse($t->due_date)->toDateString() === $today)->count(),
                    'next_due_at' => optional($next)->toDateTimeString(),
                ];
            })
            ->all();
    }

    /** Last visit and suggested products per outlet, for the list rows. */
    private function listExtras($leadIds): array
    {
        $visits = IFEReport::whereIn('lead_id', $leadIds)
            ->selectRaw('lead_id, MAX(created_at) as last_visit_at')
            ->groupBy('lead_id')
            ->pluck('last_visit_at', 'lead_id')
            ->map(fn ($at) => $at ? Carbon::parse($at)->toDateTimeString() : null)
            ->all();

        $suggested = OutletRecommendation::whereIn('lead_id', $leadIds)
            ->where('estimated_monthly_value', '>', 0)
            ->get(['lead_id', 'items', 'estimated_monthly_value'])
            ->mapWithKeys(fn ($row) => [$row->lead_id => [
                'count' => count($row->items ?? []),
                'value' => (float) $row->estimated_monthly_value,
            ]])
            ->all();

        return ['visits' => $visits, 'suggested' => $suggested];
    }

    /** Outlet profile fields shared by the list and detail responses. */
    private function outletProfile(Leads $lead): array
    {
        return [
            'size_band'       => $lead->size_band,
            'size_band_label' => Leads::sizeBandLabel($lead->size_band),
            'seats'           => $lead->seats,
            'segment'         => $lead->segment,
            'segment_label'   => Leads::segmentLabel($lead->segment),
            // Same shape as a GPS Stamp answer; null when never captured.
            'location'        => $lead->locationStamp(),
        ];
    }

    private function upload(Request $request, $lead_id)
    {
        $user = $request->user();

        if (!$request->hasFile('file')) {
            return; 
        }

        $files = $request->file('file');

        // Handle both single file and multiple files
        if (!is_array($files)) {
            $files = [$files]; // Convert single file to array for uniform processing
        }

        foreach ($files as $file) {
            // Validate the uploaded file
            if (!$file->isValid()) {
                continue; // Skip invalid files
            }

            // Get original filename and clean it
            $oriname = str_replace(' ', '_', pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME));

            $lead           = Leads::findOrFail($lead_id);
            $filename       = "{$oriname}_{$lead->id}_" . time() . "_" . uniqid() . ".{$file->extension()}";
            $path           = "lead/{$lead->id}";

            // $storedPath = $file->storeAs($path, $filename);
            Storage::putFileAs($path, new File($file), $filename);


            // Create document upload record
            $documentUpload                     = new DocumentUpload();
            $documentUpload->lead_id            = $lead_id;
            $documentUpload->task_id            = NULL;
            $documentUpload->task_comment_id    = NULL;
            $documentUpload->upload_by          = $user->id;
            $documentUpload->filename           = $filename;
            $documentUpload->size               = $file->getSize();
            $documentUpload->mime_type          = $file->getMimeType();
            $documentUpload->save();
        }
    }

    // private function map_document_uploads($uploads)
    // {
    //     return $uploads->map(function ($upload) {
    //         return [
    //             'id'            => $upload->id,
    //             'name'          => $upload->filename,
    //             'size'          => $upload->size,
    //             'file_path'     => $upload->getFileFullPathAttribute(),
    //             'uploaded_by'   => User::find($upload->upload_by)->name ?? 'Unknown',
    //             'created_at'    => $upload->created_at->toDateTimeString(),
    //             'file_type'     => strtolower(pathinfo($upload->filename, PATHINFO_EXTENSION)),
    //             'mime_type'     => $upload->mime_type,
    //         ];
    //     })->toArray();
    // }


    
}


