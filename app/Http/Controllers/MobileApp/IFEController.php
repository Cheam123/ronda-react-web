<?php

namespace App\Http\Controllers\MobileApp;

use App\Helpers\Helper;
use App\Helpers\IFEHTMLGenerator;
use App\Http\Controllers\Controller;

use App\Models\IfeArea;
use App\Models\IFENatureOfBusiness;
use App\Models\IFEReport;
use App\Models\IfeReportDocumentUpload;
use App\Models\IFEStatus;
use App\Models\TaskComment;
use App\Models\User;
use App\Models\Leads;
use App\Models\Tasks;
use App\Models\TaskUsers;
use App\Models\TaskHistory;
use App\Models\GeneralSetting;

use Illuminate\Http\File;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

use Carbon\Carbon;
use Config;

class IFEController extends Controller
{
    public function getIFEList(Request $request)
    {
        try {
            $user       = $request->user();
            $task_id    = $request->input('task_id');

            if(!$user) {
                return $this->response_failed('User not authenticated');
            }

            if(!$task_id) {
                return $this->response_failed('Task ID is required');
            }

            $IfeReports = IFEReport::with('documentUploads')->where('task_id', $task_id)->get();

            $ifeList = [];
            foreach($IfeReports as $ifeReport) {
                $ifeList[] = [
                    'id'                    => $ifeReport->id,
                    'lead_id'               => $ifeReport->lead_id,
                    'company_name'          => $ifeReport->company_name,
                    'nature_of_business'    => $ifeReport->nature_of_business,
                    'status'                => $ifeReport->status,
                    'ife_area_name'         => IfeArea::find($ifeReport->ife_area)->area ?? null,
                    'ife_area'              => (int)$ifeReport->ife_area,
                    'shop_name'             => $ifeReport->shop_name,
                    'problem_description'   => $ifeReport->problem_description,
                    'require_support'       => $ifeReport->support_required,
                    'support_description'   => $ifeReport->support_description,
                    'personal_remarks'      => $ifeReport->personal_remarks,
                    'pic_name'              => $ifeReport->pic_name,
                    'mobile_number'         => $ifeReport->mobile_number,
                    'other_mobile_numbers'  => $ifeReport->other_mobile_numbers,
                    'email'                 => $ifeReport->email,
                    'follow_up_date'        => $ifeReport->next_followup_date,
                    'follow_up_plan'        => $ifeReport->next_followup_plan,
                    'location'              => $ifeReport->location,
                    'attachments'           => Helper::media_documents_array($ifeReport->documentUploads),
                ];
            }
            return $this->response_success($ifeList, 'IFE list retrieved successfully');

        } catch (\Exception $e) {
            \Log::error('IFE List Retrieval Failed', [
                'error' => $e->getMessage(),
                'task_id' => $request->input('task_id')
            ]);
            return $this->response_failed($e->getMessage(), 500);
        } catch (\Throwable $e) {
            \Log::error('IFE List Retrieval Failed (Throwable)', ['error' => $e->getMessage()]);
            return $this->response_failed($e->getMessage(), 500);
        }
    }

    public function getIFEFields(Request $request)
    {
        $requireLeadLists = $request->input('requireLeads', true);
        $keyword = $request->input('keyword', '');

        try {
            $areas              = Helper::formatForDropdown(IfeArea::all(), 'id', 'area');
            $natureOfBusinesses = Helper::formatForDropdown(IFENatureOfBusiness::all(), 'value', 'name');
            $statuses           = Helper::formatForDropdown(IFEStatus::all(), 'value', 'name');
            

            $data                           = [];
            $data['areas']                  = $areas;
            $data['nature_of_businesses']   = $natureOfBusinesses;
            $data['statuses']               = $statuses;

            if($requireLeadLists === true || $requireLeadLists === 'true' || $requireLeadLists === 1 || $requireLeadLists === '1') {
                $leadsQuery = Leads::select('id', 'name')->orderBy('name', 'asc');
                
                // Apply search filter if keyword is provided
                if (!empty($keyword)) {
                    $leadsQuery->where('name', 'like', '%' . $keyword . '%');
                }
                              
                $leadsDropdown = $leadsQuery->get();
                $data['leads'] = Helper::formatForDropdown($leadsDropdown, 'id', 'name');
            }

            return $this->response_ok($data, 'IFE fields retrieved successfully');
        } catch (\Exception $e) {
            \Log::error('IFE Fields Retrieval Failed', ['error' => $e->getMessage()]);
            return $this->response_failed($e->getMessage(), 500);
        } catch (\Throwable $e) {
            \Log::error('IFE Fields Retrieval Failed (Throwable)', ['error' => $e->getMessage()]);
            return $this->response_failed($e->getMessage(), 500);
        }
    }

    public function searchIFELeadsList(Request $request)
    {
        $query = $request->input('query', '');

        try {
            if (empty($query)) {
                return $this->response_ok([], 'No search query provided');
            }

            $leads = Leads::select('id as value', 'name as label')
                ->where('name', 'like', '%' . $query . '%')
                ->orWhere('business_name', 'like', '%' . $query . '%')
                ->orderBy('name', 'asc')
                ->limit(10)
                ->get();

            return $this->response_ok($leads, 'Leads search results retrieved successfully');
        } catch (\Exception $e) {
            \Log::error('IFE Leads Search Failed', ['error' => $e->getMessage(), 'query' => $request->input('query')]);
            return $this->response_failed($e->getMessage(), 500);
        } catch (\Throwable $e) {
            \Log::error('IFE Leads Search Failed (Throwable)', ['error' => $e->getMessage()]);
            return $this->response_failed($e->getMessage(), 500);
        }
    }

    public function addIFEAdhocReport(Request $request)
    {
        $user = $request->user();
        $validated = $request->validate([
            'task_id'               => 'nullable|exists:tasks,id',
            'company_name'          => 'nullable|string',
            'existing_lead_id'      => 'nullable|string',
            'nature_of_business'    => 'nullable|string|max:255',
            'status'                => $request->has('task_id') ? 'nullable|string|max:255' : ($request->has('existing_lead_id') ? 'nullable|string|max:255' : 'required|string|max:255'),
            'ife_area'              => $request->has('task_id') ? 'nullable|string|max:255' : ($request->has('existing_lead_id') ? 'nullable|string|max:255' : 'required|string|max:255'),
            'shop_name'             => 'nullable|string|max:255',
            'problem_description'   => 'required|string',
            'support_required'      => 'required|string',
            'support_description'   => 'nullable|string',
            'personal_remarks'      => 'nullable|string',
            // The person met is optional: the mobile form does not ask for it.
            'pic_name'              => 'nullable|string|max:255',
            'mobile_number'         => 'nullable|string|max:20',
            'other_mobile_numbers'  => 'nullable|string|max:255',
            'email'                 => 'nullable|email|max:255',
            'next_followup_date'    => 'required|date',
            'next_followup_plan'    => 'required|string',
            'location'              => 'required|string|max:255',
        ]);

        // A visit logged from a task belongs to that task, which the caller
        // must be able to see; it is linked to the task's outlet too.
        $task = !empty($validated['task_id']) ? Tasks::visibleTo($user)->find($validated['task_id']) : null;
        if (!empty($validated['task_id']) && !$task) {
            return $this->response_failed('We could not find this task.');
        }

        try {
            $report = DB::transaction(function () use ($validated, $request, $user, $task) {
                // A visit to a known outlet is linked to it, so it shows up in
                // that outlet's visit history.
                $existingLead = $request->has('existing_lead_id')
                    ? Leads::findOrFail($validated['existing_lead_id'])
                    : ($task ? Leads::find($task->lead_id) : null);

                $IfeReport = new IFEReport();
                $IfeReport->created_by            = $user->id;
                $IfeReport->task_id               = optional($task)->id;
                $IfeReport->lead_id               = optional($existingLead)->id;
                $IfeReport->company_name          = $existingLead ? ($existingLead->name ?? null) : $validated['company_name'];
                $IfeReport->nature_of_business    = $existingLead ? ($existingLead->business_category ?? null) : $validated['nature_of_business'];
                $IfeReport->status                = $existingLead ? ($existingLead->customer_id ? 'Existing Customer' : "New Customer") : $validated['status'];
                $IfeReport->ife_area              = $existingLead ? ($existingLead->ife_area_id ?? null) : $validated['ife_area'];
                $IfeReport->shop_name             = $existingLead ? ($existingLead->business_name ?? null) : $validated['shop_name'];
                $IfeReport->problem_description   = $validated['problem_description'] ?? null;
                $IfeReport->support_required      = $validated['support_required'] ?? null;
                $IfeReport->support_description   = $validated['support_description'] ?? null;
                $IfeReport->personal_remarks      = $validated['personal_remarks'] ?? null;
                $IfeReport->pic_name              = $validated['pic_name'] ?? null; 
                $IfeReport->mobile_number         = $validated['mobile_number'] ?? null;
                $IfeReport->other_mobile_numbers  = $validated['other_mobile_numbers'] ?? null;
                $IfeReport->email                 = $validated['email'] ?? null;
                $IfeReport->next_followup_date    = $validated['next_followup_date'] ?? null;
                $IfeReport->next_followup_plan    = $validated['next_followup_plan'] ?? null;
                $IfeReport->location              = $validated['location'] ?? null;
                $IfeReport->save();

                if ($request->hasFile('files')) {
                    Log::info("Request input: " . json_encode($request->all()));
                    $files = $request->file('files');

                    if (!is_array($files)) {
                        $files = [$files];
                    }
                    
                    foreach ($files as $i=>$file) {
                        if(!$file->isValid()) {
                            continue; // Skip invalid files
                        }

                        $originalName   = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
                        $sanitizedName  = str_replace(' ', '_', $originalName);
                        $extension      = $file->getClientOriginalExtension();
                        
                        $filename       = "{$sanitizedName}_{$IfeReport->id}-".($i + 1)."-".time().".{$extension}";
                        $path           = "ife/{$IfeReport->id}";

                        Storage::putFileAs($path, new File($file), $filename);

                        // Create the database record for the upload.
                        $documentUpload = new IfeReportDocumentUpload();
                        $documentUpload->ife_report_id   = $IfeReport->id;
                        $documentUpload->upload_by       = $user->id;
                        $documentUpload->filename        = $filename;
                        $documentUpload->size            = $file->getSize();
                        $documentUpload->mime_type       = $file->getMimeType();
                        $documentUpload->save();
                    }
                }

                return $IfeReport;
            });

            return $this->response_ok(['id' => $report->id], 'IFE report created successfully');

        } catch (\Exception $e) {
            \Log::error('IFE Report Creation Failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_id' => $request->user()->id ?? null,
                'request_data' => $request->except(['files'])
            ]);
            return $this->response_failed($e->getMessage(), 500);

        } catch (\Throwable $e) {
            \Log::error('IFE Report Creation Failed (Throwable)', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            return $this->response_failed($e->getMessage(), 500);
        }
    }

    public function updateIFEReport(Request $request)
    {
        $user = $request->user();
        $validated = $request->validate([
            'id'                    => 'required|integer',
            'problem_description'   => 'required|string',
            'support_required'      => 'required|string',
            'support_description'   => 'nullable|string',
            'personal_remarks'      => 'nullable|string',
            'pic_name'              => 'required|string|max:255',
            'mobile_number'         => 'nullable|string|max:20',
            'other_mobile_numbers'  => 'nullable|string|max:255',
            'email'                 => 'nullable|email|max:255',
            'next_followup_date'    => 'required|date',
            'next_followup_plan'    => 'required|string',
        ]);

        try {
            DB::transaction(function () use ($validated, $request, $user) {
                $ifeReport = IFEReport::findOrFail($validated['id']);

                $ifeReport->problem_description   = $validated['problem_description'] ?? null;
                $ifeReport->support_required      = $validated['support_required'] ?? null;
                $ifeReport->support_description   = $validated['support_description'] ?? null;
                $ifeReport->personal_remarks      = $validated['personal_remarks'] ?? null;
                $ifeReport->pic_name              = $validated['pic_name'] ?? null;
                $ifeReport->mobile_number         = $validated['mobile_number'] ?? null;
                $ifeReport->other_mobile_numbers  = $validated['other_mobile_numbers'] ?? null;
                $ifeReport->email                 = $validated['email'] ?? null;
                $ifeReport->next_followup_date    = $validated['next_followup_date'] ?? null;
                $ifeReport->next_followup_plan    = $validated['next_followup_plan'] ?? null;
                $ifeReport->save();
                
                if ($request->has('deleted_attachment_ids')) {
                    $idsToDelete = $request->input('deleted_attachment_ids');

                    if (is_array($idsToDelete) && !empty($idsToDelete)) {
                        $documents = IfeReportDocumentUpload::whereIn('id', $idsToDelete)
                            ->where('ife_report_id', $ifeReport->id)
                            ->get();

                        foreach ($documents as $doc) {
                            if (file_exists($doc->getFileFullPathAttribute())) {
                                unlink($doc->getFileFullPathAttribute());
                            }
                            $doc->delete();
                        }
                    }
                }

                // Handle file uploads if any
                if ($request->hasFile('files')) {
                    $files = $request->file('files');

                    if (!is_array($files)) {
                        $files = [$files];
                    }
                    
                    foreach ($files as $i => $file) {
                        if(!$file->isValid()) {
                            continue; // Skip invalid files
                        }

                        $originalName   = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
                        $sanitizedName  = str_replace(' ', '_', $originalName);
                        $extension      = $file->getClientOriginalExtension();
                        
                        $filename       = "{$sanitizedName}_{$ifeReport->id}-" . ($i + 1) . "-" . time() . ".{$extension}";
                        $path           = "ife/{$ifeReport->id}";

                        Storage::putFileAs($path, new File($file), $filename);

                        // Create the database record for the upload
                        $documentUpload = new IfeReportDocumentUpload();
                        $documentUpload->ife_report_id   = $ifeReport->id;
                        $documentUpload->upload_by       = $user->id;
                        $documentUpload->filename        = $filename;
                        $documentUpload->size            = $file->getSize();
                        $documentUpload->mime_type       = $file->getMimeType();
                        $documentUpload->save();
                    }
                }

                return $ifeReport;
            });

            return $this->response_ok([], 'IFE report updated successfully');

        } catch (\Exception $e) {
            \Log::error('IFE Report Update Failed', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'ife_report_id' => $request->input('id')
            ]);
            return $this->response_failed($e->getMessage(), 500);
        }
    }

    /**
     * One visit report in full, for the app's visit screen. Whoever filed it,
     * anyone who can see its outlet, and managers (manage_ife_report) may read it.
     */
    public function getIFEReport(Request $request)
    {
        $user   = $request->user();
        $report = IFEReport::with(['documentUploads', 'createdBy:id,name,mobile'])->find($request->input('id'));

        $mayView = $report && (
            $user->can('manage_ife_report')
            || (int) $report->created_by === (int) $user->id
            || ($report->lead_id && Leads::visibleTo($user)->whereKey($report->lead_id)->exists())
        );

        if (!$mayView) {
            return $this->response_failed('We could not find this visit report.');
        }

        return $this->response_success($this->reportPayload($report), 'IFE report retrieved successfully');
    }

    /**
     * Recent visit reports, newest first. A manager's Review tab lists the
     * team's reports that are not a task yet (`open=1`); `mine=1` lists the
     * caller's own, for anyone.
     */
    public function getRecentReports(Request $request)
    {
        $user = $request->user();
        $mine = $request->boolean('mine');

        if (!$mine && !$user->can('manage_ife_report')) {
            return $this->response_failed('Only managers can see the team\'s visit reports.');
        }

        $days  = max(1, min((int) $request->input('days', 14), 90));
        $limit = max(1, min((int) $request->input('per_page', 50), 100));

        $reports = ($mine ? IFEReport::where('created_by', $user->id) : IFEReport::visibleTo($user))
            ->with(['documentUploads', 'createdBy:id,name,mobile'])
            ->where('created_at', '>=', Carbon::now()->subDays($days)->startOfDay())
            ->when($request->boolean('open'), fn ($q) => $q->whereNull('task_id'))
            // One person's visits (the manager's view of a rep).
            ->when(!$mine && $request->filled('created_by'), fn ($q) => $q->where('created_by', $request->input('created_by')))
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get();

        return $this->response_success(
            $reports->map(fn (IFEReport $report) => $this->reportPayload($report))->values(),
            'IFE reports retrieved successfully'
        );
    }

    /** The fields the app shows for a visit report. */
    private function reportPayload(IFEReport $report): array
    {
        return [
            'id'                  => $report->id,
            'lead_id'             => $report->lead_id,
            'task_id'             => $report->task_id,
            'outlet'              => $report->shop_name ?: $report->company_name,
            'company_name'        => $report->company_name,
            'customer_status'     => $report->status,
            'created_at'          => optional($report->created_at)->toDateTimeString(),
            'created_by'          => optional($report->createdBy)->name,
            'created_by_id'       => $report->created_by,
            'created_by_mobile'   => optional($report->createdBy)->mobile,
            'problem_description' => $report->problem_description,
            'support_required'    => $report->support_required,
            'support_description' => $report->support_description,
            'personal_remarks'    => $report->personal_remarks,
            'pic_name'            => $report->pic_name,
            'next_followup_date'  => $report->next_followup_date,
            'next_followup_plan'  => $report->next_followup_plan,
            'location'            => $report->location,
            'attachments'         => Helper::media_documents_array($report->documentUploads),
        ];
    }

    public function deleteIFEReport(Request $request)
    {
        try {
            if(!request('id')) {
                return $this->response_failed('IFE report ID is required', 400);
            }

            $validated = $request->validate([
                'id' => 'required|integer|exists:ife_report,id',
            ]);

            $ifeReport = IFEReport::find($validated['id']);
            if (!$ifeReport) {
                return $this->response_failed('IFE report not found', 404);
            }

            DB::transaction(function () use ($ifeReport) {
                $ifeReportDocuments = IfeReportDocumentUpload::where('ife_report_id', $ifeReport->id)->get();
                foreach ($ifeReportDocuments as $document) {
                    Storage::delete("ife/{$document->ife_report_id}/{$document->filename}");
                    $document->delete();
                }

                $ifeReport->delete();
            });

            return $this->response_ok([], 'IFE report deleted successfully');

        } catch (\Exception $e) {
            return $this->response_failed($e->getMessage(), 500);
        }
    }

    function getStatusStyle($status)
    {
        $status = strtolower(trim($status));

        // Handle specific IFE Report customer statuses with iOS-style colors
        switch ($status) {
            case 'new customer':
                return 'background-color: #34C759; color: white; border: 1px solid #34C759;';
            case 'existing customer':
                return 'background-color: #007AFF; color: white; border: 1px solid #007AFF;';
            case 'previous yes, now no':
                return 'background-color: #FF3B30; color: white; border: 1px solid #FF3B30;';
            case 'new inquiry':
                return 'background-color: #FF9500; color: white; border: 1px solid #FF9500;';
        }

        // Fallback for other potential statuses
        if (strpos($status, 'active') !== false || strpos($status, 'open') !== false || strpos($status, 'ongoing') !== false) {
            return 'background-color: #34C759; color: white; border: 1px solid #34C759;';
        } elseif (strpos($status, 'pending') !== false || strpos($status, 'waiting') !== false || strpos($status, 'review') !== false) {
            return 'background-color: #FF9500; color: white; border: 1px solid #FF9500;';
        } elseif (strpos($status, 'completed') !== false || strpos($status, 'closed') !== false || strpos($status, 'resolved') !== false) {
            return 'background-color: #007AFF; color: white; border: 1px solid #007AFF;';
        } elseif (strpos($status, 'urgent') !== false || strpos($status, 'critical') !== false || strpos($status, 'high') !== false) {
            return 'background-color: #FF3B30; color: white; border: 1px solid #FF3B30;';
        }

        return 'background-color: #8E8E93; color: white; border: 1px solid #8E8E93;';
    }

    function getStatusInlineStyle($status)
    {
        $status = strtolower(trim($status));
        
        // Base badge styles with iOS design
        $baseStyle = 'display: inline-block; padding: 8px 16px; border-radius: 20px; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;';
        
        // Handle specific IFE Report customer statuses with iOS-style colors
        switch ($status) {
            case 'new customer':
                return $baseStyle . ' background: #34C759; color: white;';
            case 'existing customer':
                return $baseStyle . ' background: #007AFF; color: white;';
            case 'previous yes, now no':
                return $baseStyle . ' background: #FF3B30; color: white;';
            case 'new inquiry':
                return $baseStyle . ' background: #FF9500; color: white;';
        }

        return $baseStyle . ' background: #8E8E93; color: white;';
    }
}
