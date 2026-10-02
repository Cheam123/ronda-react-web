<?php

namespace App\Http\Controllers\API\V1;

use Illuminate\Http\File;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Storage;

use App\Models\User;
use App\Models\Leads;
use App\Models\Tasks;
use App\Models\States;
use App\Models\Cities;
use App\Models\TaskUsers;
use App\Models\TaskHistory;
use App\Models\TaskComment;
use App\Models\DocumentUpload;
use App\Models\Notification;
use App\Models\IfeArea;
use App\Models\IFEReport;
use App\Models\IfeReportDocumentUpload;

use App\Jobs\TelegramNotification;
use App\Jobs\FirebaseNotification;
use App\Http\Controllers\Controller;
use App\Http\Requests\TaskSaveRequest;
use App\Http\Requests\TaskCreateRequest;
use App\Http\Requests\TaskSubmitRequest;
use App\Helpers\Helper;
use App\Http\Resources\DocumentResource;
use App\Http\Resources\Tasks\TaskCommentResource;
use App\Http\Resources\Tasks\TaskLeadResource;
use App\Http\Resources\Tasks\TaskListItemResource;
use App\Http\Resources\Tasks\TaskResource;
use App\Repositories\S3ClientRepo;
use App\Support\Options;
use Inertia\Inertia;

use Barryvdh\DomPDF\Facade\Pdf;
use Elegant\Sanitizer\Sanitizer;
use Carbon\Carbon;
use Maatwebsite\Excel\Facades\Excel;
use ZipArchive;
use Config;
use Throwable;


class TaskController extends Controller
{
    /*
        status 1: New Task
        status 2: In Progress
        status 3: Done
        status 4: Verified
        status 5: Completed
        status 6: KIV
        status 7: Rejected Up
    */

    public function __construct()
    {
        $this->middleware('auth');
    }

    public function index(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_task')) {
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $user     = Auth::guard('web')->user();
        $all      = Tasks::with('comments','lead','users.user')->visibleTo($user);
        $tasks    = Tasks::with('comments','lead','users.user')->visibleTo($user)->where('status',$request->get('status', 1));
        $ifeareas = IfeArea::orderBy('area','asc')->get();

        $queryString = $request->getQueryString();

        if (null == $request->get('status')) {
            $request->merge(['status'=> 1]);

            if (null == $request->get('sortby')) {
                $request->merge(['sortby'=>'last_follow_up']);
            }

        } else {
            if ($request->get('status') == 1) {
                if (null == $request->get('sortby')) {
                    $request->merge(['sortby'=>'last_follow_up']);
                }
            } else {
                if (null == $request->get('sortby')) {
                    $request->merge(['sortby'=>'due_date']);
                }
            }
        }
        
        if (null != $request->get('filter_name') || null != $request->get('filter_businessname')) {

            $tasks = $tasks->whereHas('lead', function ($query) use ($request) {
                $query->where(function ($q) use ($request) {
                    if (null != $request->get('filter_name')) {
                        $keyword = $request->get('filter_name');
                        if (count($keyword) > 0) {
                            $q->whereIn('name', $keyword);
                        }
                        if (null != $request->get('filter_businessname')) {
                            $keyword2 = $request->get('filter_businessname');
                            $q->orWhereIn('business_name', $keyword2);
                        }
                    } else {
                        if (null != $request->get('filter_businessname')) {
                            $keyword2 = $request->get('filter_businessname');
                            $q->whereIn('business_name', $keyword2);
                        }
                    }
                });
            });

            $all = $all->whereHas('lead', function ($query) use ($request) {
                $query->where(function ($q) use ($request) {
                    if (null != $request->get('filter_name')) {
                        $keyword = $request->get('filter_name');
                        if (count($keyword) > 0) {
                            $q->whereIn('name', $keyword);
                        }
                        if (null != $request->get('filter_businessname')) {
                            $keyword2 = $request->get('filter_businessname');
                            $q->orWhereIn('business_name', $keyword2);
                        }
                    } else {
                        if (null != $request->get('filter_businessname')) {
                            $keyword2 = $request->get('filter_businessname');
                            $q->whereIn('business_name', $keyword2);
                        }
                    }
                });
            });

        }

        // 2 is flagged. Anything else is not, including the 0 an IFE report's task starts with.
        if (null !== $request->get('filter_alert')) {
            $flagged = fn ($query) => $request->get('filter_alert') == 2
                ? $query->where('alert', 2)
                : $query->where(fn ($q) => $q->where('alert', '!=', 2)->orWhereNull('alert'));
            $tasks = $tasks->where($flagged);
            $all   = $all->where($flagged);
        }

        // The list's search box: the title or the reference.
        if (null !== $request->get('search')) {
            $keyword = '%' . $request->get('search') . '%';
            $match   = fn ($query) => $query->where('title', 'like', $keyword)->orWhere('task_reference', 'like', $keyword);
            $tasks   = $tasks->where($match);
            $all     = $all->where($match);
        }

        if (null !== $request->get('filter_title')) {
            $keyword = $request->get('filter_title');
            $tasks   = $tasks->where('title', 'like' ,'%'.$keyword.'%');
            $all     = $all->where('title', 'like' ,'%'.$keyword.'%');
        }

        // Y: tasks with a sales amount; N: tasks without one.
        if (null !== $request->get('filter_withsales')) {
            $withSales = fn ($query) => $request->get('filter_withsales') === 'N'
                ? $query->where(fn ($q) => $q->whereNull('sales')->orWhere('sales', '<=', 0))
                : $query->where('sales', '>', 0);
            $tasks = $tasks->where($withSales);
            $all   = $all->where($withSales);
        }

        if (null != $request->get('filter_cid')) {
            $keyword = $request->get('filter_cid');

            $tasks = $tasks->whereHas('lead', function ($query) use ($keyword) {
                $query->where('customer_id', $keyword);
            });

            $all = $all->whereHas('lead', function ($query) use ($keyword) {
                $query->where('customer_id', $keyword);
            });
        }

        if (null != $request->get('filter_ifearea')) {
            $keyword = $request->get('filter_ifearea');

            $tasks = $tasks->whereHas('lead', function ($query) use ($keyword) {
                $query->where('ife_area_id', $keyword);
            });

            $all = $all->whereHas('lead', function ($query) use ($keyword) {
                $query->where('ife_area_id', $keyword);
            });
        }

        if (null !== $request->get('filter_source')) {
            $keyword = $request->get('filter_source');

            $tasks = $tasks->whereHas('lead', function ($query) use ($keyword) {
                $query->where('source', $keyword);
            });

            $all = $all->whereHas('lead', function ($query) use ($keyword) {
                $query->where('source', $keyword);
            });
        }

        if (null !== $request->get('filter_business_category')) {
            $keyword = $request->get('filter_business_category');
            
            $tasks = $tasks->whereHas('lead', function ($query) use ($keyword) {
                $query->where('business_category', $keyword);
            });

            $all = $all->whereHas('lead', function ($query) use ($keyword) {
                $query->where('business_category', $keyword);
            });
        }

        if (null !== $request->get('filter_reference_no')) {
            $keyword = $request->get('filter_reference_no');
            $tasks   = $tasks->where('task_reference', 'like' ,'%'.$keyword.'%');
            $all     = $all->where('task_reference', 'like' ,'%'.$keyword.'%');
        }

        if (null !== $request->get('start')) {
            $from  = Carbon::parse($request->get('start'))->startOfDay();
            $to    = Carbon::parse($request->get('end'))->copy()->endOfDay();
            $tasks = $tasks->whereBetween('creation_date', [$from, $to]);
            $all   = $all->whereBetween('creation_date', [$from, $to]);
        }

        if (null !== $request->get('complete_date_start')) {
            $from  = Carbon::parse($request->get('complete_date_start'))->startOfDay();
            $to    = Carbon::parse($request->get('complete_date_end'))->copy()->endOfDay();
            $tasks = $tasks->whereBetween('complete_date', [$from, $to]);
            $all   = $all->whereBetween('complete_date', [$from, $to]);
        }

        if (null !== $request->get('inprogress_date_start')) {
            $from  = Carbon::parse($request->get('inprogress_date_start'))->startOfDay();
            $to    = Carbon::parse($request->get('inprogress_date_end'))->copy()->endOfDay();
            $tasks = $tasks->whereBetween('inprogress_date', [$from, $to]);
            $all   = $all->whereBetween('inprogress_date', [$from, $to]);
        }

        if (null !== $request->get('done_date_start')) {
            $from  = Carbon::parse($request->get('done_date_start'))->startOfDay();
            $to    = Carbon::parse($request->get('done_date_end'))->copy()->endOfDay();
            $tasks = $tasks->whereBetween('done_date', [$from, $to]);
            $all   = $all->whereBetween('done_date', [$from, $to]);
        }

        if (null !== $request->get('verify_date_start')) {
            $from  = Carbon::parse($request->get('verify_date_start'))->startOfDay();
            $to    = Carbon::parse($request->get('verify_date_end'))->copy()->endOfDay();
            $tasks = $tasks->whereBetween('verify_date', [$from, $to]);
            $all   = $all->whereBetween('verify_date', [$from, $to]);
        }

        if (null !== $request->get('reject_date_start')) {
            $from  = Carbon::parse($request->get('reject_date_start'))->startOfDay();
            $to    = Carbon::parse($request->get('reject_date_end'))->copy()->endOfDay();
            $tasks = $tasks->whereBetween('reject_date', [$from, $to]);
            $all   = $all->whereBetween('reject_date', [$from, $to]);
        }

        if (null !== $request->get('kiv_date_start')) {
            $from  = Carbon::parse($request->get('kiv_date_start'))->startOfDay();
            $to    = Carbon::parse($request->get('kiv_date_end'))->copy()->endOfDay();
            $tasks = $tasks->whereBetween('kiv_date', [$from, $to]);
            $all   = $all->whereBetween('kiv_date', [$from, $to]);
        }
        
        if (null !== $request->get('onhold_date_start')) {
            $from  = Carbon::parse($request->get('onhold_date_start'))->startOfDay();
            $to    = Carbon::parse($request->get('onhold_date_end'))->copy()->endOfDay();
            $tasks = $tasks->whereBetween('onhold_date', [$from, $to]);
            $all   = $all->whereBetween('onhold_date', [$from, $to]);
        }

        if (null !== $request->get('updated_date_start')) {
            $from  = Carbon::parse($request->get('updated_date_start'))->startOfDay();
            $to    = Carbon::parse($request->get('updated_date_end'))->copy()->endOfDay();

            $tasks = $tasks->whereHas('comments', function($query) use($from,$to) {
                                $query->whereBetween('created_at', [$from, $to]);
                            });

            $all   = $all->whereHas('comments', function($query) use($from,$to) {
                            $query->whereBetween('created_at', [$from, $to]);
                        });
        }

        if (null !== $request->get('appointment_date_start')) {
            $from  = Carbon::parse($request->get('appointment_date_start'))->startOfDay();
            $to    = Carbon::parse($request->get('appointment_date_end'))->copy()->endOfDay();
            $tasks = $tasks->whereBetween('appointment_date', [$from, $to]);
            $all   = $all->whereBetween('appointment_date', [$from, $to]);
        }

        $userFilterList = [];
        if (null !== $request->get('filter_subscriber') || null !== $request->get('filter_subsubscriber') || null !== $request->get('filter_creator') || null !== $request->get('filter_checker') || null !== $request->get('filter_owner') || null !== $request->get('filter_viewer')) {
            if (null !== $request->get('filter_subscriber')) {
                array_push($userFilterList, ['role'=>2, 'id'=>$request->get('filter_subscriber')]);
            }
            if (null !== $request->get('filter_subsubscriber')) {
                array_push($userFilterList, ['role'=>6, 'id'=>$request->get('filter_subsubscriber')]);
            }
            if (null !== $request->get('filter_creator')) {
                array_push($userFilterList, ['role'=>1, 'id'=>$request->get('filter_creator')]);
            }
            if (null !== $request->get('filter_checker')) {
                array_push($userFilterList, ['role'=>3, 'id'=>$request->get('filter_checker')]);
            }
            if (null !== $request->get('filter_owner')) {
                array_push($userFilterList, ['role'=>4, 'id'=>$request->get('filter_owner')]);
            }
            if (null !== $request->get('filter_viewer')) {
                array_push($userFilterList, ['role'=>5, 'id'=>$request->get('filter_viewer')]);
            }

            if (count($userFilterList) > 0) {
                $tasks = $tasks->whereHas('users', function ($query) use ($userFilterList) {
                                        $first = true;
                                        foreach($userFilterList as $item) {
                                            if ($first == true) {
                                                $query->where(function ($q) use ($item) {
                                                    $q->where('user_id',$item['id'])
                                                      ->where('role',$item['role']);
                                                });
                                                $first = false;
                                            } else {
                                                $query->orWhere(function ($q) use ($item) {
                                                    $q->where('user_id',$item['id'])
                                                      ->where('role',$item['role']);
                                                });
                                            }
                                        }
                                    });
                $all = $all->whereHas('users', function ($query) use ($userFilterList) {
                                        $first = true;
                                        foreach($userFilterList as $item) {
                                            if ($first == true) {
                                                $query->where(function ($q) use ($item) {
                                                    $q->where('user_id',$item['id'])
                                                    ->where('role',$item['role']);
                                                });
                                                $first = false;
                                            } else {
                                                $query->orWhere(function ($q) use ($item) {
                                                    $q->where('user_id',$item['id'])
                                                    ->where('role',$item['role']);
                                                });
                                            }
                                        }
                                    });
            }
        }

        $users = User::where('status',1)->whereNotIn('id',[1])->orderBy('name','asc')->get();

        $all = $all->select('status', DB::raw('COUNT( id ) as cnt'))
                   ->groupBy('status')
                   ->get();

        if ($request->get('sortby') == 'last_follow_up') {
            if (null == $request->get('sortmode')) {
                $request->merge(['sortmode'=>'desc']);
            }
        } else if ($request->get('sortby') == 'reminder_date') {
            if (null == $request->get('sortmode')) {
                $request->merge(['sortmode'=>'desc']);
            }
        } else if ($request->get('sortby') == 'due_date') {
            if (null == $request->get('sortmode')) {
                $request->merge(['sortmode'=>'asc']);
            }
        } else if ($request->get('sortby') == 'reject_date') {
            if (null == $request->get('sortmode')) {
                $request->merge(['sortmode'=>'desc']);
            }
        } else if ($request->get('sortby') == 'inprogress_date') {
            if (null == $request->get('sortmode')) {
                $request->merge(['sortmode'=>'desc']);
            }
        } else if ($request->get('sortby') == 'kiv_date') {
            if (null == $request->get('sortmode')) {
                $request->merge(['sortmode'=>'desc']);
            }
        } else if ($request->get('sortby') == 'onhold_date') {
            if (null == $request->get('sortmode')) {
                $request->merge(['sortmode'=>'desc']);
            }
        } else {
            if (null == $request->get('sortmode')) {
                $request->merge(['sortmode'=>'desc']);
            }
        }
        
        if($request->get('status') < 5) {
            if ($request->get('sortmode') == 'asc') {
                $sortBy = $request->get('sortby');
                $tasks = $tasks->get()
                                ->sortBy(function($t) use($sortBy){                                    
                                    switch($sortBy) {
                                        case 'reminder_date':
                                            return [$t->reminder_date_time, $t->last_follow_up];
                                        case 'last_follow_up':
                                            return [$t->last_follow_up, $t->created_at];
                                        case 'due_date':
                                            return [$t->due_date, $t->due_time];
                                        case 'created_at':
                                            return [$t->created_at];
                                        case 'inprogress_date':
                                            return [$t->inprogress_date, $t->last_follow_up, $t->created_at];
                                        case 'complete_date':
                                            return [$t->complete_date];
                                        case 'kiv_date':
                                            return [$t->kiv_datee, $t->last_follow_up, $t->created_at];
                                        case 'reject_date':
                                            return [$t->reject_datee, $t->last_follow_up, $t->created_at];
                                    }
                                })
                                ->paginate(10);
            } else {
                $sortBy = $request->get('sortby');
                $tasks = $tasks->get()
                                ->sortByDesc(function($t) use($sortBy){
                                    switch($sortBy) {
                                        case 'reminder_date':
                                            return [$t->reminder_date_time, $t->last_follow_up];
                                        case 'last_follow_up':
                                            return [$t->last_follow_up, $t->created_at];
                                        case 'due_date':
                                            return [$t->due_date, $t->due_time];
                                        case 'created_at':
                                            return [$t->created_at];
                                        case 'inprogress_date':
                                            return [$t->inprogress_date, $t->last_follow_up, $t->created_at];
                                        case 'complete_date':
                                            return [$t->complete_date];
                                        case 'kiv_date':
                                            return [$t->kiv_date, $t->last_follow_up, $t->created_at];
                                        case 'reject_date':
                                            return [$t->reject_dat, $t->last_follow_up, $t->created_at];
                                    }
                                })
                                ->paginate(10);
            }
        } else {
            if ($request->get('sortby') == 'last_follow_up') {
                $tasks = $tasks->orderBy('complete_date','desc')->orderBy('kiv_date','desc')->orderBy('reject_date','desc')->paginate(10);
            } else {
                $tasks = $tasks->orderBy($request->get('sortby'),$request->get('sortmode'))->paginate(10);
            }
        }

        $leadNameOptions = new Leads();
        $leadNameOptions = array_unique($leadNameOptions::whereHas('tasks')->orderBy('name','asc')->pluck('name')->toArray());
        $leadNameOptions = array_filter($leadNameOptions, fn($value) => !is_null($value) && $value !== '');

        // The in-memory sort above keeps each task's original key; the page
        // needs a plain list, with what every row and its dialogs show.
        $tasks->withQueryString();
        $tasks->setCollection($tasks->getCollection()->values()->loadMissing([
            'reminder', 'rating', 'lead.ifearea', 'comments.submitBy', 'comments.documentUploads', 'comments.ifeReport.documentUploads',
        ]));

        return Inertia::render('Tasks/Index', [
            'tasks'              => $tasks->through(fn (Tasks $task) => TaskListItemResource::make($task)->resolve()),
            'statusCounts'       => $all->pluck('cnt', 'status'),
            'users'              => Options::fromCollection($users),
            'leadNames'          => array_values($leadNameOptions),
            'ifeAreas'           => $this->areaOptions($ifeareas),
            'sources'            => Options::fromMap(Helper::getLeadSourceListing()),
            // The old filter listed four categories by hand, two of them stale.
            'businessCategories' => Options::fromMap(Helper::getBusinessCategoryListing()),
            'filters'            => $request->query(),
        ]);
    }

    /**
     * The task list has one design now; this older route renders it too.
     */
    public function index2(Request $request)
    {
        return $this->index($request);
    }

    public function create(Request $request)
    {
        $user = Auth::guard('web')->user();

        if (!$user->can('add_task')) {
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        // Without create_task the view hides the people pickers (the task is
        // the user's own), and only leads they can already see are offered.
        $lead = Leads::visibleTo($user)->findOrFail($request->input('id'));

        return Inertia::render('Tasks/Create', [
            'lead'      => TaskLeadResource::make($lead)->resolve(),
            'documents' => DocumentResource::collection($lead->documentUploads)->resolve(),
            'people'    => Options::fromCollection(User::assignable()->get()),
            'canAssign' => $user->can('create_task'),
            'today'     => now()->toDateString(),
        ]);
    }

    public function store(TaskCreateRequest $request)
    {
        $user = Auth::guard('web')->user();

        if (!$user->can('add_task')) {
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        // create_task means "create and assign to others". Without it the task
        // is the user's own: they are its subscriber, checker and owner, and
        // it may only go on a lead they can already see.
        $assigns = $user->can('create_task');
        Leads::visibleTo($user)->findOrFail($request->input('lead_id'));

        $retryCount = 0;
        $maxRetries = 3;

        while ($retryCount < $maxRetries) {
            try {
                DB::beginTransaction();

                $validatedData  = $request->validated();
                $subscriber     = $assigns ? User::where('id',$validatedData['subscriber'])->first() : $user;
                $subSubscribers = $assigns ? ($validatedData['sub_subscriber'] ?? []) : [];
                $owners         = $assigns ? ($validatedData['owner'] ?? []) : [$user->id];
                $viewers        = $assigns ? ($validatedData['viewer'] ?? []) : [];

                $lead            = Leads::where('id',$validatedData['lead_id'])->lockForUpdate()->first();
                $lead->assign_to = $subscriber->id;
                // hq_checker is the overseeing manager; a rep's own task keeps it.
                if ($assigns) {
                    $lead->hq_checker = $user->id;
                }
                $lead->save();

                $task = new Tasks();
                $task->status               = 1;
                $task->lead_id              = $lead->id;
                $task->task_reference       = Tasks::nextReference();
                $task->title                = $validatedData['title'];
                $task->start_date           = $validatedData['task_start_date'];
                $task->start_time           = $validatedData['task_start_time'];
                $task->due_date             = $validatedData['task_due_date'];
                $task->due_time             = $validatedData['task_due_time'];

                if ($validatedData['task_appointment_date']) {
                    if ($validatedData['task_appointment_time']) {
                        $task->appointment_date = Carbon::parse($validatedData['task_appointment_date'])->format('Y-m-d '. $validatedData['task_appointment_time']);
                    } else {
                        $task->appointment_date = Carbon::parse($validatedData['task_appointment_date'])->format('Y-m-d 00:00:00');
                    }
                } else {
                    $task->appointment_date = NULL;
                }

                $task->remark               = $validatedData['remark'];
                $task->creation_date        = now();
                $task->inprogress_date      = NULL;
                $task->done_date            = NULL;
                $task->verify_date          = NULL;
                $task->complete_date        = NULL;
                $task->reject_date          = NULL;
                $task->kiv_date             = NULL;
                $task->save();

                /**
                 * ROLE:
                 *  1:creator
                 *  2:subscriber
                 *  3:checker
                 *  4:owner
                 *  5:viewer
                 *  6:sub-subscriber
                 */

                 // creator
                $taskUser = new TaskUsers();
                $taskUser->task_id  = $task->id;
                $taskUser->user_id  = Auth::guard('web')->user()->id;
                $taskUser->role     = 1;
                $taskUser->save();

                // subscriber
                $taskUser = new TaskUsers();
                $taskUser->task_id = $task->id;
                $taskUser->user_id = $subscriber->id;
                $taskUser->role    = 2;
                $taskUser->save();

                // checker
                $taskUser = new TaskUsers();
                $taskUser->task_id  = $task->id;
                $taskUser->user_id  = Auth::guard('web')->user()->id;
                $taskUser->role     = 3;
                $taskUser->save();

                // sub-subscriber
                foreach($subSubscribers as $o) {
                    $taskUser           = new TaskUsers();
                    $taskUser->task_id  = $task->id;
                    $taskUser->user_id  = $o;
                    $taskUser->role     = 6;
                    $taskUser->save();
                }

                // owner
                foreach($owners as $o) {
                    $taskUser           = new TaskUsers();
                    $taskUser->task_id  = $task->id;
                    $taskUser->user_id  = $o;
                    $taskUser->role     = 4;
                    $taskUser->save();
                }

                // viewer
                foreach($viewers as $v) {
                    $taskUser           = new TaskUsers();
                    $taskUser->task_id  = $task->id;
                    $taskUser->user_id  = $v;
                    $taskUser->role     = 5;
                    $taskUser->save();
                }

                if (null !== $request->file('file')) {
                    $this->upload($request, $task->id);
                }

                $param_b = new Tasks();
                $param_a = Tasks::with('lead')->findOrFail($task->id);
                $data    = Helper::prepareDataForSerialize($param_b, $param_a);

                $history = new TaskHistory();
                $history->task_id           = $task->id;
                $history->updated_by        = Auth::guard('web')->user()->id;
                $history->before_status     = 0;
                $history->after_status      = 1;
                $history->content_before    = serialize($data['before']);
                $history->content_after     = serialize($data['after']);
                $history->remark            = NULL;
                $history->save();

                // $runJob = (new TelegramNotification($task->id, 'task', '1'));
                // dispatch($runJob);

                $runJobFirebase = (new FirebaseNotification($task->id, 'task', '1'));
                dispatch($runJobFirebase);

                DB::commit();

                alert()->success(trans('translation.success'), trans('translation.successfully_create'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
                return redirect()->route('lead.index');
                
            } catch (Throwable $e) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task creation process fail due to exceptional throwable : '. $e->getMessage());
                    alert()->error('Task creation process fail due to exceptional throwable : ', $e->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);

            } catch (\Exception $f) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task creation fail due to exceptional : '. $f->getMessage());
                    alert()->error('Task creation fail due to exceptional : ', $f->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);
            }
        }
    }

    public function view(Request $request, $id)
    {
        if (!Auth::guard('web')->user()->can('manage_task')) {
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $task = Tasks::with(
            'lead.documentUploads.uploadBy', 'documentUploads.uploadBy', 'users.user',
            'comments.submitBy', 'comments.documentUploads', 'comments.ifeReport.documentUploads',
        )->findOrFail($id);

        return Inertia::render('Tasks/Show', [
            'task'       => TaskResource::make($task)->resolve(),
            'activities' => TaskCommentResource::collection($task->comments->sortByDesc('created_at')->values())->resolve(),
            'actions'    => $task->actionFlagsFor(Auth::guard('web')->user()),
            'people'     => Options::fromCollection(User::assignable()->get()),
            // "comment" opens the Activity tab.
            'mode'       => $request->input('mode') ?? '',
            'filters'    => $request->except('mode'),
        ]);
    }

    public function edit(Request $request, $id)
    {
        if (!Auth::guard('web')->user()->can('manage_task')) {
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $task = Tasks::with('lead.documentUploads.uploadBy', 'documentUploads.uploadBy', 'users.user')->findOrFail($id);
        $user = Auth::guard('web')->user();

        return Inertia::render('Tasks/Edit', [
            'task'                => TaskResource::make($task)->resolve(),
            'actions'             => $this->editActionFlags($task, $user),
            'people'              => Options::fromCollection(User::assignable()->get()),
            // Only an owner (or an Admin) moves the task to another subscriber.
            'canChangeSubscriber' => $task->users->where('role', 4)->where('user_id', $user->id)->isNotEmpty() || $user->type == User::TYPE_ADMIN,
            'filters'             => $request->query(),
        ]);
    }

    public function update(TaskSaveRequest $request)
    {
        if (!Auth::guard('web')->user()->can('manage_task')) {
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $retryCount = 0;
        $maxRetries = 3;

        while ($retryCount < $maxRetries) {
            try {
                DB::beginTransaction();
            
                $validatedData = $request->validated();   

                $task    = Tasks::where('id',$validatedData['task_id'])->lockForUpdate()->first();
                $param_b = Tasks::with('lead','users.user')->findOrFail($task->id);

                $subscriber       = User::where('id',$validatedData['subscriber'])->first();
                $lead             = Leads::where('id',$task->lead_id)->lockForUpdate()->first();
                $lead->assign_to  = $subscriber->id;
                $lead->save();

                $task->title            = $validatedData['title'];
                $task->alert            = empty($validatedData['alertind']) ? 1 : $validatedData['alertind'];
                $task->start_date       = $validatedData['task_start_date'];
                $task->start_time       = $validatedData['task_start_time'];
                $task->due_date         = $validatedData['task_due_date'];
                $task->due_time         = $validatedData['task_due_time'];
                $task->invoice_no       = $validatedData['invoice_no'] ?? null;
                $task->sales            = $validatedData['sales'] ?? null;

                $today = strtotime(Carbon::now()->format('Y-m-d H:i:s'));
                $due   = strtotime(Carbon::parse($validatedData['task_due_date'] . ' ' . $validatedData['task_due_time'])->format('Y-m-d H:i:s'));

                if ($today < $due) {
                    $task->due_notify = 0;
                }

                if ($validatedData['task_appointment_date']) {
                    if ($validatedData['task_appointment_time']) {
                        $task->appointment_date = Carbon::parse($validatedData['task_appointment_date'])->format('Y-m-d '. $validatedData['task_appointment_time']);
                    } else {
                        $task->appointment_date = Carbon::parse($validatedData['task_appointment_date'])->format('Y-m-d 00:00:00');
                    }
                } else {
                    $task->appointment_date = NULL;
                }
                
                $task->remark           = $validatedData['remark'];
                $task->save();

                $isRecycle = false;
                if ($task->status == 5 || $task->status == 6 || $task->status == 7) {
                    $task->status = 1;
                    $task->save();
                    $isRecycle = true;
                }

                /**
                 * ROLE:
                 *  1:creator
                 *  2:subscriber
                 *  3:checker
                 *  4:owner
                 *  5:viewer
                 */

                // subscriber
                $keep = [];
                $changerUser = false;
                $find = TaskUsers::where('task_id',$task->id)
                                ->where('user_id',$subscriber->id)
                                ->where('role',2)
                                ->first();
                array_push($keep, $subscriber->id);
                if (!isset($find)) {
                    // this is the scenario where subscriber has been changed
                    $changerUser = true;
                    TaskUsers::where('task_id',$task->id)
                            ->where('role',2)
                            ->whereNotIn('user_id',$keep)
                            ->delete();

                    $taskUser = new TaskUsers();
                    $taskUser->task_id = $task->id;
                    $taskUser->user_id = $subscriber->id;
                    $taskUser->role    = 2;
                    $taskUser->save();
                }

                // sub-subscriber
                if (isset($validatedData['sub_subscriber'])) {
                    $keep = [];
                    foreach($validatedData['sub_subscriber'] as $o) {

                        $find = TaskUsers::where('task_id',$task->id)
                                        ->where('user_id',$o)
                                        ->where('role',6)
                                        ->first();
                        array_push($keep, $o);
                        if (!isset($find)) {
                            // this is the scenario where this sub-subscriber newly added
                            $changerUser = true;

                            $taskUser = new TaskUsers();
                            $taskUser->task_id  = $task->id;
                            $taskUser->user_id  = $o;
                            $taskUser->role     = 6;
                            $taskUser->save();
                        }
                    }

                    $cnt = TaskUsers::where('task_id',$task->id)
                                    ->where('role',6)
                                    ->whereNotIn('user_id',$keep)
                                    ->count();
                    if ($cnt > 0) {
                        // this is the scenario where this some sub-subscriber has been removed
                        $changerUser = true;
                        TaskUsers::where('task_id',$task->id)
                                ->where('role',6)
                                ->whereNotIn('user_id',$keep)
                                ->delete();
                    }

                } else {
                    $find = TaskUsers::where('task_id',$task->id)
                                    ->where('role',6)
                                    ->first();
                    
                    if (isset($find)) {
                        // this is the scenario where sub-subscriber being removed all
                        $changerUser = true;
                        TaskUsers::where('task_id',$task->id)
                                ->where('role',6)
                                ->delete();
                    }
                }
                
                // owner
                if (isset($validatedData['owner'])) {
                    $keep = [];
                    foreach($validatedData['owner'] as $o) {

                        $find = TaskUsers::where('task_id',$task->id)
                                        ->where('user_id',$o)
                                        ->where('role',4)
                                        ->first();
                        array_push($keep, $o);
                        if (!isset($find)) {
                            // this is the scenario where this owner newly added
                            $changerUser = true;

                            $taskUser = new TaskUsers();
                            $taskUser->task_id  = $task->id;
                            $taskUser->user_id  = $o;
                            $taskUser->role     = 4;
                            $taskUser->save();
                        }
                    }

                    $cnt = TaskUsers::where('task_id',$task->id)
                                            ->where('role',4)
                                            ->whereNotIn('user_id',$keep)
                                            ->count();
                    if ($cnt > 0) {
                        // this is the scenario where this some owner has been removed
                        $changerUser = true;
                        TaskUsers::where('task_id',$task->id)
                                ->where('role',4)
                                ->whereNotIn('user_id',$keep)
                                ->delete();
                    }

                } else {
                    $find = TaskUsers::where('task_id',$task->id)
                                    ->where('role',4)
                                    ->first();
                    
                    if (isset($find)) {
                        // this is the scenario where owner being removed all
                        $changerUser = true;
                        TaskUsers::where('task_id',$task->id)
                                ->where('role',4)
                                ->delete();
                    }
                }

                // viewer
                if (isset($validatedData['viewer'])) {
                    $keep = [];
                    foreach($validatedData['viewer'] as $o) {

                        $find = TaskUsers::where('task_id',$task->id)
                                                ->where('user_id',$o)
                                                ->where('role',5)
                                                ->first();
                        array_push($keep, $o);
                        if (!isset($find)) {
                            // this is the scenario where this viewer newly added
                            $changerUser = true;

                            $taskUser = new TaskUsers();
                            $taskUser->task_id  = $task->id;
                            $taskUser->user_id  = $o;
                            $taskUser->role     = 5;
                            $taskUser->save();
                        }
                    }

                    $cnt = TaskUsers::where('task_id',$task->id)
                                            ->where('role',5)
                                            ->whereNotIn('user_id',$keep)
                                            ->count();
                    if ($cnt > 0) {
                        // this is the scenario where this some viewer has been removed
                        $changerUser = true;
                        TaskUsers::where('task_id',$task->id)
                                ->where('role',5)
                                ->whereNotIn('user_id',$keep)
                                ->delete();
                    }

                } else {
                    $find = TaskUsers::where('task_id',$task->id)
                                    ->where('role',5)
                                    ->first();
                    
                    if (isset($find)) {
                        // this is the scenario where viewer being removed all
                        $changerUser = true;
                        TaskUsers::where('task_id',$task->id)
                                        ->where('role',5)
                                        ->delete();
                    }
                }

                $param_a = Tasks::with('lead','users.user')->findOrFail($task->id);
                $data    = Helper::prepareDataForSerialize($param_b, $param_a);

                $history = new TaskHistory();
                $history->task_id           = $task->id;
                $history->updated_by        = Auth::guard('web')->user()->id;
                $history->before_status     = $param_b->status;
                $history->after_status      = $param_a->status;
                $history->content_before    = serialize($data['before']);
                $history->content_after     = serialize($data['after']);
                $history->remark            = $validatedData['special_remark'];
                $history->save();

                if ($isRecycle == true) {
                    // $runJob = (new TelegramNotification($task->id, 'task', '1'));
                    // dispatch($runJob);

                    $runJobFirebase = (new FirebaseNotification($task->id, 'task', '1'));
                    dispatch($runJobFirebase);
                } else {
                    // $runJob = (new TelegramNotification($task->id, 'task', '9', $history->remark, $changerUser));
                    // dispatch($runJob);
                }

                DB::commit();

                alert()->success(trans('translation.success'), trans('translation.successfully_update'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
                return redirect()->route('tasks.index2',$request->all());
                
            } catch (Throwable $e) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task update process fail due to exceptional throwable : '. $e->getMessage());
                    alert()->error('Task update process fail due to exceptional throwable : ', $e->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);

            } catch (\Exception $f) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task update fail due to exceptional : '. $f->getMessage());
                    alert()->error('Task update fail due to exceptional : ', $f->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);
            }
        }
    }

    public function delete(Request $request)
    {
        if (!Auth::guard('web')->user()->can('create_task')) { 
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        try {
            $id     = $request->id;
            $task   = Tasks::where('id',$id)->first();

            if ($task->status == 1 || $task->status == 2) {

                // $runJob = (new TelegramNotification($id, 'task', '10', '', false));
                // dispatch($runJob);

                $runJobFirebase = (new FirebaseNotification($id, 'task', '10', '', false));
                dispatch($runJobFirebase);

                $ifeReport = IFEReport::where('task_id',$id)->get();
                foreach ($ifeReport as $ife) {
                    $ifeReportDocuments = IfeReportDocumentUpload::where('ife_report_id', $ife->id)->get();
                    foreach ($ifeReportDocuments as $document) {
                        Storage::delete("ife/{$document->ife_report_id}/{$document->filename}");
                        $document->delete();
                    }   
                }
                
                IFEReport::where('task_id',$id)->delete();
                DocumentUpload::where('task_id',$id)->delete();
                TaskHistory::where('task_id',$id)->delete();
                TaskComment::where('task_id',$id)->delete();
                TaskUsers::where('task_id',$id)->delete();
                Tasks::where('id',$id)->delete();

            } else {

                $param_b = Tasks::with('users.user')->findOrFail($task->id);

                // $runJob = (new TelegramNotification($id, 'task', '10', '', false));
                // dispatch($runJob);

                $runJobFirebase = (new FirebaseNotification($id, 'task', '10', '', false));
                dispatch($runJobFirebase);

                $task->status = 7;
                $task->save();

                $param_a = Tasks::with('users.user')->findOrFail($task->id);
                $data    = Helper::prepareDataForSerialize($param_b, $param_a);

                $history = new TaskHistory();
                $history->task_id = $task->id;
                $history->updated_by        = Auth::guard('web')->user()->id;
                $history->before_status     = $param_b->status;
                $history->after_status      = $param_a->status;
                $history->content_before    = serialize($data['before']);
                $history->content_after     = serialize($data['after']);
                $history->remark            = 'Task deleted';
                $history->save();
            }
            
            alert()->success(trans('translation.success'), trans('translation.successfully_delete'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
            return redirect()->route('tasks.index2',['status' => 1]);
            
        } catch (Throwable $e) {

            Log::info('Task delete process fail due to exceptional throwable : '. $e->getMessage());
            alert()->error('Task delete process fail due to exceptional throwable : ', $e->getMessage())->showConfirmButton()->focusConfirm(true);
            return redirect()->back()->withInput();

        } catch (\Exception $f) {

            Log::info('Task delete fail due to exceptional : '. $f->getMessage());
            alert()->error('Task delete fail due to exceptional : ', $f->getMessage())->showConfirmButton()->focusConfirm(true);
            return redirect()->back()->withInput();

        }
    }

    public function marked_as_inprogress(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_task')) {
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $retryCount = 0;
        $maxRetries = 3;

        while ($retryCount < $maxRetries) {
            try {
                DB::beginTransaction();
                
                $validatedData = $request->all();   

                $task    = Tasks::where('id',$validatedData['task_id'])->lockForUpdate()->first();
                $param_b = Tasks::with('lead','users.user')->findOrFail($task->id);

                $task->status = 2;
                $task->inprogress_date = now();
                $task->save();

                /**
                 * ROLE:
                 *  1:creator
                 *  2:subscriber
                 *  3:checker
                 *  4:owner
                 *  5:viewer
                 */

                $param_a = Tasks::with('lead','users.user')->findOrFail($task->id);
                $data    = Helper::prepareDataForSerialize($param_b, $param_a);

                $history = new TaskHistory();
                $history->task_id           = $task->id;
                $history->updated_by        = Auth::guard('web')->user()->id;
                $history->before_status     = $param_b->status;
                $history->after_status      = $param_a->status;
                $history->content_before    = serialize($data['before']);
                $history->content_after     = serialize($data['after']);
                $history->remark            = NULL;
                $history->save();

                // $runJob = (new TelegramNotification($task->id, 'task', '2'));
                // dispatch($runJob);

                $runJobFirebase = (new FirebaseNotification($task->id, 'task', '2'));
                dispatch($runJobFirebase);

                DB::commit();

                alert()->success(trans('translation.success'), trans('translation.successfully_update'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
                return redirect()->route('tasks.index2',$request->all());
                
            } catch (Throwable $e) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task accept process fail due to exceptional throwable : '. $e->getMessage());
                    alert()->error('Task accept process fail due to exceptional throwable : ', $e->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);

            } catch (\Exception $f) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task accept fail due to exceptional : '. $f->getMessage());
                    alert()->error('Task accept fail due to exceptional : ', $f->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);
            }
        }
    }

    public function marked_as_done(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_task')) {
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $retryCount = 0;
        $maxRetries = 3;

        while ($retryCount < $maxRetries) {
            try {
                DB::beginTransaction();
                
                $validatedData = $request->all();   

                $task    = Tasks::where('id',$validatedData['task_id'])->lockForUpdate()->first();
                $param_b = Tasks::with('lead','users.user')->findOrFail($task->id);

                $task->status = 3;

                if ($validatedData['invoice_no'] !== null && !empty($validatedData['invoice_no'])) {
                    $task->invoice_no = $validatedData['invoice_no'];
                }

                if ($validatedData['sales_amt'] !== null && is_numeric($validatedData['sales_amt'])) {
                   $task->sales = str_replace(',','',$validatedData['sales_amt']);
                }
                
                $task->done_date = now();
                $task->save();

                /**
                 * ROLE:
                 *  1:creator
                 *  2:subscriber
                 *  3:checker
                 *  4:owner
                 *  5:viewer
                 */

                $param_a = Tasks::with('lead','users.user')->findOrFail($task->id);
                $data    = Helper::prepareDataForSerialize($param_b, $param_a);

                $history = new TaskHistory();
                $history->task_id           = $task->id;
                $history->updated_by        = Auth::guard('web')->user()->id;
                $history->before_status     = $param_b->status;
                $history->after_status      = $param_a->status;
                $history->content_before    = serialize($data['before']);
                $history->content_after     = serialize($data['after']);
                $history->remark            = $validatedData['special_remark'];
                $history->save();

                // $runJob = (new TelegramNotification($task->id, 'task', '3'));
                // dispatch($runJob);

                $runJobFirebase = (new FirebaseNotification($task->id, 'task', '3'));
                dispatch($runJobFirebase);

                DB::commit();

                alert()->success(trans('translation.success'), trans('translation.successfully_update'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
                return redirect()->route('tasks.index2',$request->all());
                
            } catch (Throwable $e) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task done process fail due to exceptional throwable : '. $e->getMessage());
                    alert()->error('Task done process fail due to exceptional throwable : ', $e->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);

            } catch (\Exception $f) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task done fail due to exceptional : '. $f->getMessage());
                    alert()->error('Task done fail due to exceptional : ', $f->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);
            }
        }
    }

    public function marked_as_fallback(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_task')) {
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $retryCount = 0;
        $maxRetries = 3;

        while ($retryCount < $maxRetries) {
            try {
                DB::beginTransaction();
                
                $validatedData = $request->all();   

                $task    = Tasks::where('id',$validatedData['task_id'])->lockForUpdate()->first();
                $param_b = Tasks::with('lead','users.user')->findOrFail($task->id);

                $task->status = 2;
                $task->done_date = NULL;
                $task->onhold_date = NULL;
                $task->save();

                /**
                 * ROLE:
                 *  1:creator
                 *  2:subscriber
                 *  3:checker
                 *  4:owner
                 *  5:viewer
                 */

                $param_a = Tasks::with('lead','users.user')->findOrFail($task->id);
                $data    = Helper::prepareDataForSerialize($param_b, $param_a);

                $history = new TaskHistory();
                $history->task_id           = $task->id;
                $history->updated_by        = Auth::guard('web')->user()->id;
                $history->before_status     = $param_b->status;
                $history->after_status      = $param_a->status;
                $history->content_before    = serialize($data['before']);
                $history->content_after     = serialize($data['after']);
                $history->remark            = $validatedData['special_remark'];
                $history->save();

                // $runJob = (new TelegramNotification($task->id, 'task', '8'));
                // dispatch($runJob);

                $runJobFirebase = (new FirebaseNotification($task->id, 'task', '8'));
                dispatch($runJobFirebase);

                DB::commit();

                alert()->success(trans('translation.success'), trans('translation.successfully_update'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
                return redirect()->route('tasks.index2',$request->all());
                
            } catch (Throwable $e) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task fallback process fail due to exceptional throwable : '. $e->getMessage());
                    alert()->error('Task fallback process fail due to exceptional throwable : ', $e->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);

            } catch (\Exception $f) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task fallback fail due to exceptional : '. $f->getMessage());
                    alert()->error('Task fallback fail due to exceptional : ', $f->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);
            }
        }
    }

    public function marked_as_inprogess(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_task')) {
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        try {
            DB::beginTransaction();
            
            $validatedData = $request->all();   

            $task    = Tasks::where('id',$validatedData['id'])->lockForUpdate()->first();
            $param_b = Tasks::with('lead','users.user')->findOrFail($task->id);

            $task->status = 2;
            $task->done_date = NULL;
            $task->onhold_date = NULL;
            $task->save();

            $param_a = Tasks::with('lead','users.user')->findOrFail($task->id);
            $data    = Helper::prepareDataForSerialize($param_b, $param_a);

            $history = new TaskHistory();
            $history->task_id           = $task->id;
            $history->updated_by        = Auth::guard('web')->user()->id;
            $history->before_status     = $param_b->status;
            $history->after_status      = $param_a->status;
            $history->content_before    = serialize($data['before']);
            $history->content_after     = serialize($data['after']);
            $history->remark            = 'Reactivated the task';
            $history->save();
            DB::commit();

            alert()->success(trans('translation.success'), trans('translation.successfully_update'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
            return redirect()->route('tasks.index2',$request->all());
            
        } catch (Throwable $e) {
            DB::rollBack();
            Log::info('Task fallback process fail due to exceptional throwable : '. $e->getMessage());
            alert()->error('Task fallback process fail due to exceptional throwable : ', $e->getMessage())->showConfirmButton()->focusConfirm(true);
            return redirect()->back()->withInput();

        } catch (\Exception $f) {
            DB::rollBack();
            Log::info('Task fallback fail due to exceptional : '. $f->getMessage());
            alert()->error('Task fallback fail due to exceptional : ', $f->getMessage())->showConfirmButton()->focusConfirm(true);
            return redirect()->back()->withInput();
        }
    }

    public function marked_as_verified(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_task')) {
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $retryCount = 0;
        $maxRetries = 3;

        while ($retryCount < $maxRetries) {
            try {
                DB::beginTransaction();
                
                $validatedData = $request->all();   

                $task    = Tasks::where('id',$validatedData['task_id'])->lockForUpdate()->first();
                $param_b = Tasks::with('lead','users.user')->findOrFail($task->id);

                $task->status = 4;
                $task->verify_date = now();
                $task->save();

                /**
                 * ROLE:
                 *  1:creator
                 *  2:subscriber
                 *  3:checker
                 *  4:owner
                 *  5:viewer
                 */

                $param_a = Tasks::with('lead','users.user')->findOrFail($task->id);
                $data    = Helper::prepareDataForSerialize($param_b, $param_a);

                $history = new TaskHistory();
                $history->task_id           = $task->id;
                $history->updated_by        = Auth::guard('web')->user()->id;
                $history->before_status     = $param_b->status;
                $history->after_status      = $param_a->status;
                $history->content_before    = serialize($data['before']);
                $history->content_after     = serialize($data['after']);
                $history->remark            = $validatedData['special_remark'];
                $history->save();

                // $runJob = (new TelegramNotification($task->id, 'task', '4'));
                // dispatch($runJob);

                $runJobFirebase = (new FirebaseNotification($task->id, 'task', '4'));
                dispatch($runJobFirebase);

                DB::commit();

                alert()->success(trans('translation.success'), trans('translation.successfully_update'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
                return redirect()->route('tasks.index2',$request->all());
                
            } catch (Throwable $e) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task verified process fail due to exceptional throwable : '. $e->getMessage());
                    alert()->error('Task verified process fail due to exceptional throwable : ', $e->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);

            } catch (\Exception $f) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task verified fail due to exceptional : '. $f->getMessage());
                    alert()->error('Task verified fail due to exceptional : ', $f->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);
            }
        }
    }

    public function marked_as_completed(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_task')) {
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $retryCount = 0;
        $maxRetries = 3;

        while ($retryCount < $maxRetries) {
            try {
                DB::beginTransaction();
                
                $validatedData = $request->all();   

                $task    = Tasks::where('id',$validatedData['task_id'])->lockForUpdate()->first();
                $param_b = Tasks::with('lead','users.user')->findOrFail($task->id);

                $task->status = 5;
                $task->complete_date = now();
                $task->save();

                /**
                 * ROLE:
                 *  1:creator
                 *  2:subscriber
                 *  3:checker
                 *  4:owner
                 *  5:viewer
                 */

                $param_a = Tasks::with('lead','users.user')->findOrFail($task->id);
                $data    = Helper::prepareDataForSerialize($param_b, $param_a);

                $history = new TaskHistory();
                $history->task_id           = $task->id;
                $history->updated_by        = Auth::guard('web')->user()->id;
                $history->before_status     = $param_b->status;
                $history->after_status      = $param_a->status;
                $history->content_before    = serialize($data['before']);
                $history->content_after     = serialize($data['after']);
                $history->remark            = $validatedData['special_remark'];
                $history->save();

                // $runJob = (new TelegramNotification($task->id, 'task', '5'));
                // dispatch($runJob);

                $runJobFirebase = (new FirebaseNotification($task->id, 'task', '5'));
                dispatch($runJobFirebase);

                DB::commit();

                alert()->success(trans('translation.success'), trans('translation.successfully_update'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
                return redirect()->route('tasks.index2',$request->all());
                
            } catch (Throwable $e) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task complete process fail due to exceptional throwable : '. $e->getMessage());
                    alert()->error('Task complete process fail due to exceptional throwable : ', $e->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);

            } catch (\Exception $f) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task complete fail due to exceptional : '. $f->getMessage());
                    alert()->error('Task complete fail due to exceptional : ', $f->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);
            }
        }
    }

    public function marked_as_kiv(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_task')) {
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $retryCount = 0;
        $maxRetries = 3;

        while ($retryCount < $maxRetries) {
            try {
                DB::beginTransaction();
                
                $validatedData = $request->all();   

                $task    = Tasks::where('id',$validatedData['task_id'])->lockForUpdate()->first();
                $param_b = Tasks::with('lead','users.user')->findOrFail($task->id);

                $task->status = 6;
                $task->kiv_date = now();
                $task->save();

                /**
                 * ROLE:
                 *  1:creator
                 *  2:subscriber
                 *  3:checker
                 *  4:owner
                 *  5:viewer
                 */

                $param_a = Tasks::with('lead','users.user')->findOrFail($task->id);
                $data    = Helper::prepareDataForSerialize($param_b, $param_a);

                $history = new TaskHistory();
                $history->task_id           = $task->id;
                $history->updated_by        = Auth::guard('web')->user()->id;
                $history->before_status     = $param_b->status;
                $history->after_status      = $param_a->status;
                $history->content_before    = serialize($data['before']);
                $history->content_after     = serialize($data['after']);
                $history->remark            = $validatedData['special_remark'];
                $history->save();

                // $runJob = (new TelegramNotification($task->id, 'task', '6'));
                // dispatch($runJob);

                $runJobFirebase = (new FirebaseNotification($task->id, 'task', '6'));
                dispatch($runJobFirebase);

                DB::commit();

                alert()->success(trans('translation.success'), trans('translation.successfully_update'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
                return redirect()->route('tasks.index2',$request->all());
                
            } catch (Throwable $e) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task kiv process fail due to exceptional throwable : '. $e->getMessage());
                    alert()->error('Task kiv process fail due to exceptional throwable : ', $e->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);

            } catch (\Exception $f) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task kiv fail due to exceptional : '. $f->getMessage());
                    alert()->error('Task kiv fail due to exceptional : ', $f->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);
            }
        }
    }

    public function marked_as_onhold(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_task')) {
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $retryCount = 0;
        $maxRetries = 3;

        while ($retryCount < $maxRetries) {
            try {
                DB::beginTransaction();
                
                $validatedData = $request->all();   

                $task    = Tasks::where('id',$validatedData['task_id'])->lockForUpdate()->first();
                $param_b = Tasks::with('lead','users.user')->findOrFail($task->id);

                $task->status = 8;
                $task->onhold_date = now();
                $task->save();

                /**
                 * ROLE:
                 *  1:creator
                 *  2:subscriber
                 *  3:checker
                 *  4:owner
                 *  5:viewer
                 */

                $param_a = Tasks::with('lead','users.user')->findOrFail($task->id);
                $data    = Helper::prepareDataForSerialize($param_b, $param_a);

                $history = new TaskHistory();
                $history->task_id           = $task->id;
                $history->updated_by        = Auth::guard('web')->user()->id;
                $history->before_status     = $param_b->status;
                $history->after_status      = $param_a->status;
                $history->content_before    = serialize($data['before']);
                $history->content_after     = serialize($data['after']);
                $history->remark            = $validatedData['special_remark'];
                $history->save();

                // $runJob = (new TelegramNotification($task->id, 'task', '6'));
                // dispatch($runJob);

                $runJobFirebase = (new FirebaseNotification($task->id, 'task', '6'));
                dispatch($runJobFirebase);

                DB::commit();

                alert()->success(trans('translation.success'), trans('translation.successfully_update'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
                return redirect()->route('tasks.index2',$request->all());
                
            } catch (Throwable $e) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task kiv process fail due to exceptional throwable : '. $e->getMessage());
                    alert()->error('Task kiv process fail due to exceptional throwable : ', $e->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);

            } catch (\Exception $f) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task kiv fail due to exceptional : '. $f->getMessage());
                    alert()->error('Task kiv fail due to exceptional : ', $f->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);
            }
        }
    }

    public function marked_as_rejected(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_task')) {
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $retryCount = 0;
        $maxRetries = 3;

        while ($retryCount < $maxRetries) {
            try {
                DB::beginTransaction();
                
                $validatedData = $request->all();   

                $task    = Tasks::where('id',$validatedData['task_id'])->lockForUpdate()->first();
                $param_b = Tasks::with('lead','users.user')->findOrFail($task->id);

                $task->status = 7;
                $task->reject_date = now();
                $task->save();

                /**
                 * ROLE:
                 *  1:creator
                 *  2:subscriber
                 *  3:checker
                 *  4:owner
                 *  5:viewer
                 */

                $param_a = Tasks::with('lead','users.user')->findOrFail($task->id);
                $data    = Helper::prepareDataForSerialize($param_b, $param_a);

                $history = new TaskHistory();
                $history->task_id           = $task->id;
                $history->updated_by        = Auth::guard('web')->user()->id;
                $history->before_status     = $param_b->status;
                $history->after_status      = $param_a->status;
                $history->content_before    = serialize($data['before']);
                $history->content_after     = serialize($data['after']);
                $history->remark            = $validatedData['special_remark'];
                $history->save();

                // $runJob = (new TelegramNotification($task->id, 'task', '7'));
                // dispatch($runJob);

                $runJobFirebase = (new FirebaseNotification($task->id, 'task', '7'));
                dispatch($runJobFirebase);

                DB::commit();

                alert()->success(trans('translation.success'), trans('translation.successfully_update'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
                return redirect()->route('tasks.index2',$request->all());
                
            } catch (Throwable $e) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task reject process fail due to exceptional throwable : '. $e->getMessage());
                    alert()->error('Task reject process fail due to exceptional throwable : ', $e->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);

            } catch (\Exception $f) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task reject fail due to exceptional : '. $f->getMessage());
                    alert()->error('Task reject fail due to exceptional : ', $f->getMessage())->showConfirmButton()->focusConfirm(true);
                    return redirect()->back()->withInput();
                }
                sleep(1);
            }
        }
    }

    public function chat_store(Request $request)
    {
        DB::beginTransaction();
        try {
            $message = collect([
                'type'    => 'error',
                'message' => '',
                'data'    => ''
            ]);
            
            $filters    = ['chat_message' => 'trim'];
            $sanitizer  = new Sanitizer($request->all(), $filters);
            $clean_data = [];
            $clean_data = $sanitizer->sanitize();

            $new = new TaskComment();
            
            $new->task_id       = $clean_data['task_id'];
            $new->message       = $clean_data['chat_message'] ? $clean_data['chat_message'] : '';
            $new->submit_date   = Carbon::now()->format('Y-m-d');
            $new->submit_by     = Auth::guard('web')->user()->id;
            $new->save();

            $task  = Tasks::where('id',$clean_data['task_id'])->lockForUpdate()->first();
            
            if ($task->status == 2) {
                if (isset($clean_data['task_due_date']) || isset($clean_data['task_due_time']) || !empty($clean_data['task_due_date']) || !empty($clean_data['task_due_time'])) {
                    if (!empty($clean_data['task_due_date'])){
                        $task->due_date = $clean_data['task_due_date'];
                    }
                    if (!empty($clean_data['task_due_time'])){
                        $task->due_time = $clean_data['task_due_time'];
                    } else {
                        $task->due_time = '09:00:00';
                    }
                    
                    $task->save();
                }
            }

            $docList = [];
            $i = 0;
            foreach($request->all() as $index => $value) {
                if (str_contains($index, 'file-')) {
                    $i           = $i+1;
                    $file        = $value;
                    $oriname     = str_replace(' ','_', explode('.',$file->getClientOriginalName())[0]);
                    $filename    = "{$oriname}_{$new->id}-{$i}-".time().".{$file->extension()}";
                    $path        = "task/{$new->task->id}";
        
                    Storage::putFileAs($path, new File($file), $filename);
        
                    $documentUpload = new DocumentUpload;
                    $documentUpload->lead_id         = NULL;
                    $documentUpload->task_id         = $clean_data['task_id'];
                    $documentUpload->task_comment_id = $new->id;
                    $documentUpload->upload_by       = Auth::guard('web')->user()->id;
                    $documentUpload->filename        = $filename;
                    $documentUpload->original_name   = $file->getClientOriginalName();
                    $documentUpload->size            = Storage::size("{$path}/{$filename}");
                    $documentUpload->mime_type       = $file->getMimeType();
                    $documentUpload->save();
    
                    $tz              = Config::get('app.timezonecommission_model');
                    $doc['name']     = Auth::guard('web')->user()->name;
                    $doc['time']     = Carbon::createFromTimestamp(strtotime($new->created_at))->timezone($tz)->format('h:i A');
                    $doc['chatid']   = $new->id;
                    $doc['docid']    = $documentUpload->id;
                    $doc['filename'] = $documentUpload->display_name;
                    $doc['fullpath'] = $documentUpload->file_full_path;
    
                    $ext = explode('.',$filename);
                    $ext = $ext[count($ext)-1];
    
                    $chatVideoFormat = [
                        'mp4'
                    ];

                    $chatAudioFormat = [
                        '3gp','aa','aac','aax','act','aiff','alac','amr','au','awb','dvf','flac','gsm','iklax','ivs','m4a','m4b','m4p','mmf','movpkg','mp3','mpc','msv','nmf','ogg','oga','mogg','opus','ra','rm','raw','rf64','sln','tta','voc','vox','wav','wma','wv','8svx','cda'
                    ];
    
                    $chatImageFormat = [
                        'png','jpg'
                    ];
    
                    $chatPdfFormat = [
                        'pdf'
                    ];
    
                    $isChatVideo = array_search($ext, $chatVideoFormat) === false ? 0 : 1;
                    $isChatAudio = array_search($ext, $chatAudioFormat) === false ? 0 : 1;
                    $isChatImage = array_search($ext, $chatImageFormat) === false ? 0 : 1;
                    $isChatPdf   = array_search($ext, $chatPdfFormat)   === false ? 0 : 1;
    
                    $doc['isChatVideo'] = $isChatVideo;
                    $doc['isChatAudio'] = $isChatAudio;
                    $doc['isChatImage'] = $isChatImage;
                    $doc['isChatPdf']   = $isChatPdf;

                    array_push($docList, $doc);
                }
            }

            // $runJob = (new TelegramNotification($new->id, 'chatroom', '1'));
            // dispatch($runJob);

            $runJobFirebase = (new FirebaseNotification($new->id, 'chatroom', '1'));
            dispatch($runJobFirebase);

            DB::commit();

            $data = $new->toArray();
            $data['name'] = Auth::guard('web')->user()->name;
    
            $tz             = Config::get('app.timezonecommission_model');
            $data['time']   = Carbon::createFromTimestamp(strtotime($data['created_at']))->timezone($tz)->format('h:i A');
            $data['chatid'] = $new->id;
            $data['hasdoc'] = count($docList) > 0 ? 1 : 0;
            $data['doc']    = $docList;

            $message->put('type', 'success');
            $message->put('data', json_encode($data));
            $message->put('message', trans('translation.successfully_update'));
            return response()->json($message->toArray(), 200);
            
        } catch (Throwable $e) {

            DB::rollBack();
            $message->put('type', 'error');
            $message->put('message', 'Oops...'. $e->getMessage());
            return response()->json($message->toArray(), 200);
        
        } catch (\Exception $f) {

            DB::rollBack();
            $message->put('type', 'error');
            $message->put('message', 'Oops...'. $f->getMessage());
            return response()->json($message->toArray(), 200);
        }
    }

    public function chat_delete(Request $request)
    {
        DB::beginTransaction();
        try {
            $message = collect([
                'type' => 'error',
                'message' => '',
            ]);

            $chat = TaskComment::findOrFail($request->get('id'));

            if ( $chat->submit_by != Auth::guard('web')->user()->id ) {
                $message->put('type', 'error');
                $message->put('message', trans('translation.no_authorise_on_this_action'));
                return response()->json($message->toArray(), 200);
            }

            // User can only delete the message within 15 minutes of sending it.
            if ( Carbon::parse($chat->created_at)->diffInMinutes(Carbon::now()) > 15 ) {
                $message->put('type', 'error');
                $message->put('message', trans('translation.delete_time_limit_exceeded'));
                return response()->json($message->toArray(), 200);
            }

            if ( !empty($request->get('docId')) ) {
                // delete the document, if this is the last deleted document, then delete the comment as well.
                $documentUpload = DocumentUpload::where('id', $request->get('docId'))->first();
                if ($documentUpload) {
                    if (S3ClientRepo::IsExisted($documentUpload->file_path, $documentUpload->filename)) {
                        S3ClientRepo::Delete($documentUpload->file_path, $documentUpload->filename);
                    }
                    
                    // $runJob = (new TelegramNotification($chat->id, 'chatroom', '2'));
                    // dispatch($runJob);

                    $runJobFirebase = (new FirebaseNotification($chat->id, 'chatroom', '2'));
                    dispatch($runJobFirebase);

                    $documentUpload->delete();
                }

            } else {
            
                // $runJob = (new TelegramNotification($chat->id, 'chatroom', '2'));
                // dispatch($runJob);

                $runJobFirebase = (new FirebaseNotification($chat->id, 'chatroom', '2'));
                dispatch($runJobFirebase);

                if ($chat->documentUploads->count() > 0) {
                    $chat->message = '';
                    $chat->save();
                } else {
                    $chat->delete();
                }
            }
            
            DB::commit();
            
        } catch (Throwable $e) {

            DB::rollBack();
            $message->put('type', 'error');
            $message->put('message', 'Oops...'. $e->getMessage());
            return response()->json($message->toArray(), 200);
        
        } catch (\Exception $f) {

            DB::rollBack();
            $message->put('type', 'error');
            $message->put('message', 'Oops...'. $f->getMessage());
            return response()->json($message->toArray(), 200);
        }

        $message->put('type', 'success');
        $message->put('message', trans('translation.successfully_delete'));
        return response()->json($message->toArray(), 200);
    }

    public function chat_update(Request $request)
    {
        DB::beginTransaction();
        try {
            $message = collect([
                'type'    => 'error',
                'message' => '',
                'data'    => ''
            ]);

            $chat = TaskComment::findOrFail($request->get('id'));

            if ( $chat->submit_by != Auth::guard('web')->user()->id ) {
                $message->put('type', 'error');
                $message->put('message', trans('translation.no_authorise_on_this_action'));
                return response()->json($message->toArray(), 200);
            }

            // User can only edit the message within 15 minutes of sending it.
            if ( Carbon::parse($chat->created_at)->diffInMinutes(Carbon::now()) > 15 ) {
                $message->put('type', 'error');
                $message->put('message', trans('translation.delete_time_limit_exceeded'));
                return response()->json($message->toArray(), 200);
            }

            $filters    = ['chat_message' => 'trim'];
            $sanitizer  = new Sanitizer($request->all(), $filters);
            $clean_data = $sanitizer->sanitize();

            $chat->message = $clean_data['chat_message'] ? $clean_data['chat_message'] : '';
            $chat->save();

            DB::commit();

            $data = [
                'chatid'           => $chat->id,
                'message'          => $chat->message,
                'formated_message' => $chat->formated_message,
            ];

            $message->put('type', 'success');
            $message->put('data', json_encode($data));
            $message->put('message', trans('translation.successfully_update'));
            return response()->json($message->toArray(), 200);

        } catch (Throwable $e) {

            DB::rollBack();
            $message->put('type', 'error');
            $message->put('message', 'Oops...'. $e->getMessage());
            return response()->json($message->toArray(), 200);

        } catch (\Exception $f) {

            DB::rollBack();
            $message->put('type', 'error');
            $message->put('message', 'Oops...'. $f->getMessage());
            return response()->json($message->toArray(), 200);
        }
    }

    public function chat_marked_as_read(Request $request)
    {
        try {
            $message = collect([
                'type' => 'error',
                'message' => '',
            ]);

            DB::beginTransaction();
            
            $task = Tasks::with('comments')->where('id',$request->id)->first();

            if ($task->has_unread_notification->count() > 0) {
                $notifications = Notification::whereIn('notifiable_id', [Auth::guard('web')->user()->id])
                                            ->where('content_type', 'App\Models\TaskComment')
                                            ->whereIn('content_id', $task->comments->pluck('id')->toArray())
                                            ->whereNull('read_at')
                                            ->get();
            
                foreach($notifications as $n) {
                    $n->read_at = now();
                    $n->save();
                }
            }
            
            DB::commit();

        } catch (Throwable $e) {

            DB::rollBack();
            $message->put('type', 'error');
            $message->put('message', 'Oops...'. $e->getMessage());
            return response()->json($message->toArray(), 200);
        
        } catch (\Exception $f) {

            DB::rollBack();
            $message->put('type', 'error');
            $message->put('message', 'Oops...'. $f->getMessage());
            return response()->json($message->toArray(), 200);
        }

        $message->put('type', 'success');
        $message->put('message', trans('translation.successfully_update'));
        return response()->json($message->toArray(), 200);
    }

    /**
     * The status actions the edit page offers: the checker's and owner's
     * steps only, so no Accept, and Done only for an owner.
     */
    private function editActionFlags(Tasks $task, User $user): array
    {
        $isOwner = $task->users->where('role', 4)->where('user_id', $user->id)->isNotEmpty();

        return array_merge($task->actionFlagsFor($user), [
            'can_accept_task' => false,
            'can_done_task'   => $task->status == 2 && $isOwner,
        ]);
    }

    /**
     * IFE areas as options, with their descriptions for the area listing.
     */
    private function areaOptions($ifeareas): array
    {
        return collect($ifeareas)->map(fn (IfeArea $area) => [
            'value'       => $area->id,
            'label'       => $area->area,
            'description' => $area->description,
        ])->values()->all();
    }

    public function upload(Request $request, $task_id)
    {
        $files = $request->file('file');
        
        foreach($files as $file) {
            $oriname     = str_replace(' ','_', explode('.',$file->getClientOriginalName())[0]);
            $task        = Tasks::findOrFail($task_id);
            $filename    = "{$oriname}_{$task->id}-".time().".{$file->extension()}";
            $path        = "task/{$task->id}";

            Storage::putFileAs($path, new File($file), $filename);

            $documentUpload = new DocumentUpload;
            $documentUpload->lead_id         = NULL;
            $documentUpload->task_id         = $task_id;
            $documentUpload->task_comment_id = NULL;
            $documentUpload->upload_by       = Auth::guard('web')->user()->id;
            $documentUpload->filename        = $filename;
            $documentUpload->size            = Storage::size("{$path}/{$filename}");
            $documentUpload->mime_type       = $file->getMimeType();
            $documentUpload->save();
        }        
    }

    public function print_report(Request $request)
    {
        $task = Tasks::where('id',$request->id)->first();

        $task = $task->load([
            'lead',
            'users',
            'comments'
        ]);

        $pdf = Pdf::loadView('pdf.task.index', [
            'data' => $task,
        ]);
        $pdf->setPaper('a4');
        $pdf->setOptions(['isFontSubsettingEnabled'=>true]);

        return $pdf->download("{$task->task_reference}.pdf");
    }

    public function export_single_task(Request $request)
    {
        ini_set('max_execution_time', 6000);
        ini_set('memory_limit', '512M');

        $task = Tasks::findOrFail($request->id);
        return Excel::download(new \App\Exports\SingleTaskReportExport($request->id), "Task_{$task->task_reference}.xlsx");
    }
}