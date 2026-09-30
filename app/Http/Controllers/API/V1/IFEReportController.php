<?php

namespace App\Http\Controllers\API\V1;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

use App\Models\User;
use App\Models\Leads;
use App\Models\Tasks;
use App\Models\TaskUsers;
use App\Models\TaskHistory;
use App\Models\TaskComment;
use App\Models\GeneralSetting;
use App\Models\IfeArea;
use App\Models\IFEReport;
use App\Models\IfeReportDocumentUpload;
use App\Exports\IFEReportExport;
use Maatwebsite\Excel\Facades\Excel;

use App\Http\Controllers\Controller;
use App\Http\Resources\IfeReports\IfeReportListResource;
use App\Http\Resources\IfeReports\IfeReportResource;
use App\Support\Options;
use Inertia\Inertia;
use App\Helpers\Helper;
use App\Support\Collection;
use App\Jobs\FirebaseNotification;

use Carbon\Carbon;
use Config;
use Throwable;

class IFEReportController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth');
    }

    public function index(Request $request)
    {
        if (!Auth::guard('web')->user()->can('ife_report')) { 
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $salesperson = new User();
        $salesperson = $salesperson::select('id','name')->orderBy('name','asc')->whereNotIn('id',[1])->get();

        $ifeareas   = IfeArea::get();
        $ifereports = IFEReport::visibleTo(Auth::guard('web')->user());

        if ($request->get('start') !== NULL) {
            $from = Carbon::parse($request->get('start'))->startOfDay()->format('Y-m-d 00:00:00');
            $to   = Carbon::parse($request->get('end'))->endOfDay()->format('Y-m-d 23:59:59');

            $ifereports = $ifereports->whereBetween('created_at', [$from, $to]);
        } else {

            $from = Carbon::parse(Carbon::now()->addDays(-30))->startOfDay()->format('Y-m-d 00:00:00');
            $to   = Carbon::parse(Carbon::now())->endOfDay()->format('Y-m-d 23:59:59');

            $request->merge(['start' => Carbon::parse($from)->format('Y-m-d')]);
            $request->merge(['end' => Carbon::parse($to)->format('Y-m-d')]);

            $ifereports = $ifereports->whereBetween('created_at', [$from, $to]);
        }

        if ($request->get('ifearea') !== NULL) {
            $keyword    = $request->get('ifearea');
            $ifereports = $ifereports->where('ife_area', $keyword);
        }

        if ($request->get('salesperson') !== NULL) {
            $keyword  = $request->get('salesperson');
            $ifereports = $ifereports->where('created_by', $keyword);
        }

        if ($request->get('mobile') !== NULL) {
            $keyword  = $request->get('mobile');
            $ifereports = $ifereports->where('mobile_number', 'like', '%'.$keyword.'%');
        }

        if ($request->get('company_name') !== NULL) {
            $keyword  = $request->get('company_name');
            $ifereports = $ifereports->where('company_name', $keyword);
        }

        if ($request->get('cafe_name') !== NULL) {
            $keyword  = $request->get('cafe_name');
            $ifereports = $ifereports->where('shop_name', $keyword);
        }

        $ifereports = $ifereports->orderBy('created_at','desc')
                                ->paginate(10)
                                ->withQueryString();

        return Inertia::render('IfeReports/Index', [
            'reports'     => $ifereports->through(fn (IFEReport $report) => IfeReportListResource::make($report)->resolve()),
            'salespeople' => Options::fromCollection($salesperson),
            'ifeAreas'    => Options::fromCollection($ifeareas, 'id', 'area'),
            'filters'     => $request->only(['start', 'end', 'ifearea', 'salesperson', 'mobile', 'company_name', 'cafe_name']),
        ]);
    }

    public function export(Request $request)
    {
        if (!Auth::guard('web')->user()->can('ife_report')) { 
            return redirect()->back();
        }

        $ifereports = IFEReport::visibleTo(Auth::guard('web')->user());

        if ($request->get('start') !== NULL) {
            $from = Carbon::parse($request->get('start'))->startOfDay()->format('Y-m-d 00:00:00');
            $to   = Carbon::parse($request->get('end'))->endOfDay()->format('Y-m-d 23:59:59');
            
            $ifereports = $ifereports->whereBetween('created_at', [$from, $to]);
        } else {
            $from = Carbon::parse(Carbon::now()->addDays(-30))->startOfDay()->format('Y-m-d 00:00:00');
            $to   = Carbon::parse(Carbon::now())->endOfDay()->format('Y-m-d 23:59:59');

            $ifereports = $ifereports->whereBetween('created_at', [$from, $to]);
        }

        if ($request->get('ifearea') !== NULL) {
            $keyword    = $request->get('ifearea');
            $ifereports = $ifereports->where('ife_area', $keyword);
        }

        if ($request->get('salesperson') !== NULL) {
            $keyword  = $request->get('salesperson');
            $ifereports = $ifereports->where('created_by', $keyword);
        }

        if ($request->get('mobile') !== NULL) {
            $keyword  = $request->get('mobile');
            $ifereports = $ifereports->where('mobile_number', 'like', '%'.$keyword.'%');
        }

        if ($request->get('company_name') !== NULL) {
            $keyword  = $request->get('company_name');
            $ifereports = $ifereports->where('company_name', $keyword);
        }

        if ($request->get('cafe_name') !== NULL) {
            $keyword  = $request->get('cafe_name');
            $ifereports = $ifereports->where('shop_name', $keyword);
        }

        $ifereports = $ifereports->orderBy('created_at','desc')->with('documentUploads')->get();

        $exportData = [];
        
        // Header Row
        $exportData[] = [
            'Created By',
            'Company Name',
            'Nature of Business',
            'Status',
            'IFE Area',
            'Shop Name',
            'Problem Description',
            'Support Required',
            'Support Description',
            'Personal Remarks',
            'PIC Name',
            'Mobile Number',
            'Other Mobile Number',
            'Email',
            'Next Follow Up Date',
            'Next Follow Up Plan',
            'Location',
            'Attachments',
            'Created At',
        ];

        foreach ($ifereports as $report) {
            $attachments = $report->documentUploads->map(function($doc) {
                return $doc->file_full_path;
            })->implode("\n\n");

            $exportData[] = [
                $report->createdBy ? $report->createdBy->name : '',
                $report->company_name,
                $report->nature_of_business,
                $report->status,
                $report->area ? $report->area->area : '',
                $report->shop_name,
                $report->problem_description,
                $report->support_required,
                $report->support_description,
                $report->personal_remarks,
                $report->pic_name,
                $report->mobile_number,
                $report->other_mobile_numbers,
                $report->email,
                $report->next_followup_date,
                $report->next_followup_plan,
                $report->location,
                $attachments,
                $report->created_at,
            ];
        }

        return Excel::download(new IFEReportExport($exportData), 'ife_reports.xlsx');
    }

    public function view(Request $request)
    {
        if (!Auth::guard('web')->user()->can('ife_report')) { 
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $param = $request->all();
        $id    = $param['id'];

        $ifeReport = IFEReport::visibleTo(Auth::guard('web')->user())->findOrFail($id);

        $tmenu_part1 = 'IFE Report';
        $tmenu_part2 = trans('translation.view') . ' (' . trans('translation.id').':'.$ifeReport->id . ')';

        unset($param['id']);

        return Inertia::render('IfeReports/Show', [
            'report'      => IfeReportResource::make($ifeReport)->resolve(),
            // The list's filters, so Back returns to the same page of results.
            'filters'     => $param,
            'tmenu_part1' => $tmenu_part1,
            'tmenu_part2' => $tmenu_part2,
        ]);
    }

    public function convet_to_task(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_ife_report')) {
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        try {
            DB::beginTransaction();

            // The manager converting the report checks and owns the new task
            // (this used to be one hard-coded account, which crashed any
            // database that did not have it).
            $manager   = Auth::guard('web')->user();
            $ifeReport = IFEReport::findOrFail($request->get('id'));

            // A visit already linked to an outlet becomes a task on that
            // outlet; only an unlinked visit creates a new lead.
            $lead = $ifeReport->lead_id ? Leads::find($ifeReport->lead_id) : null;

            if (!$lead) {
                $lead = new Leads();
                $lead->business_name     = $ifeReport->shop_name;
                $lead->receiving_date    = $ifeReport->created_at;
                $lead->belong_to         = $manager->id;
                $lead->assign_to         = $ifeReport->created_by;
                $lead->hq_checker        = $manager->id;
                $lead->name              = $ifeReport->company_name;
                $lead->business_category = null;
                $lead->source            = null;
                $lead->email             = $ifeReport->email;
                $lead->mobile            = $ifeReport->mobile_number;
                $lead->address           = $ifeReport->location;
                $lead->city_id           = null;
                $lead->state_id          = null;
                $lead->postcode          = null;
                $lead->ife_area_id       = $ifeReport->ife_area;
                $lead->remark            = $ifeReport->other_mobile_numbers;
                $lead->save();
            }

            $task = new Tasks();
            $task->alert                = 0;
            $task->title                = 'IFE Route : ' . ($ifeReport->company_name ? $ifeReport->company_name : $ifeReport->shop_name);
            $task->invoice_no           = null;
            $task->sales                = null;
            $task->due_notify           = 0;
            $task->status               = 2;
            $task->lead_id              = $lead->id;
            $task->task_reference       = Tasks::nextReference();
            $task->appointment_date     = null;
            $task->start_date           = Carbon::parse($ifeReport->created_at)->format('Y-m-d');
            $task->start_time           = Carbon::parse($ifeReport->created_at)->format('H:i:s');
            $task->due_date             = Carbon::parse($ifeReport->created_at)->format('Y-m-d');
            $task->due_time             = Carbon::parse($ifeReport->created_at)->format('H:i:s');
            $task->remark               = null;
            $task->creation_date        = $ifeReport->created_at;
            $task->inprogress_date      = null;
            $task->done_date            = null;
            $task->verify_date          = null;
            $task->complete_date        = null;
            $task->reject_date          = null;
            $task->kiv_date             = null;
            $task->save();

            // Task Users
            // subscriber
            $taskUser = new TaskUsers();
            $taskUser->task_id = $task->id;
            $taskUser->user_id = $ifeReport->created_by;
            $taskUser->role    = 2;
            $taskUser->save();

            // checker
            $taskUser = new TaskUsers();
            $taskUser->task_id  = $task->id;
            $taskUser->user_id  = $manager->id;
            $taskUser->role     = 3;
            $taskUser->save();

            // owner
            $taskUser = new TaskUsers();
            $taskUser->task_id  = $task->id;
            $taskUser->user_id  = $manager->id;
            $taskUser->role     = 4;
            $taskUser->save();

            // Task History
            $param_b = new Tasks();
            $param_a = Tasks::with('lead')->findOrFail($task->id);
            $data    = Helper::prepareDataForSerialize($param_b, $param_a);

            $history = new TaskHistory();
            $history->task_id           = $task->id;
            $history->updated_by        = $ifeReport->created_by;
            $history->before_status     = 0;
            $history->after_status      = 2;
            $history->content_before    = serialize($data['before']);
            $history->content_after     = serialize($data['after']);
            $history->remark            = NULL;
            $history->save();

            $ifeReport->task_id = $task->id;
            $ifeReport->lead_id = $lead->id;
            $ifeReport->save();

            $html = Helper::generateIfeReportHTML($ifeReport);

            // Create a task comment with the IFE report HTML
            $comment = new TaskComment();
            $comment->task_id       = $task->id;
            $comment->submit_by     = $ifeReport->created_by;
            $comment->submit_date   = now();
            $comment->message       = $html;
            $comment->ife_report_id = $ifeReport->id;
            $comment->save();
            
            DB::commit();

            alert()->success(trans('translation.success'), trans('translation.successfully_update'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
            return redirect()->route('ifereport.index',$request->all());
            
        } catch (Throwable $e) {

            DB::rollBack();
            alert()->error($e->getMessage())->showConfirmButton()->focusConfirm(true);
            return redirect()->back()->withInput();
            
        } catch (\Exception $f) {

            DB::rollBack();
            alert()->error($f->getMessage())->showConfirmButton()->focusConfirm(true);
            return redirect()->back()->withInput();
        }

    }

    public function delete(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_ife_report')) { 
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $id = $request->id;
        TaskComment::where('ife_report_id',$id)->delete();
        IfeReportDocumentUpload::where('ife_report_id',$id)->delete();
        IFEReport::where('id',$id)->delete();
        DB::commit();

        return redirect()->route('ifereport.index')->with('success', trans('translation.delete_success'));

    }

    public function freeze(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_ife_report')) { 
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $id = $request->id;
        $report = IFEReport::where('id',$id)->first();
        $report->freeze = 'Y';
        $report->save();
        DB::commit();

        return redirect()->route('ifereport.index')->with('success', trans('translation.delete_success'));

    }

    public function unfreeze(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_ife_report')) { 
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $id = $request->id;
        $report = IFEReport::where('id',$id)->first();
        $report->freeze = 'N';
        $report->save();
        DB::commit();

        return redirect()->route('ifereport.index')->with('success', trans('translation.delete_success'));

    }
}