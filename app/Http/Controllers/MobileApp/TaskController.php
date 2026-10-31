<?php

namespace App\Http\Controllers\MobileApp;

use App\Helpers\Helper;
use App\Http\Controllers\Controller;
use App\Http\Requests\TaskCreateRequest;
use App\Http\Requests\TaskSaveRequest;
use App\Jobs\FirebaseNotification;
use App\Models\DocumentUpload;
use App\Models\IFEReport;
use App\Models\Leads;
use App\Models\Notification;
use App\Models\TaskComment;
use App\Models\TaskHistory;
use App\Models\Tasks;
use App\Models\TaskUsers;
use App\Models\User;
use App\Repositories\S3ClientRepo;
use App\Services\TaskRisk;
use Illuminate\Http\File;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

use Elegant\Sanitizer\Sanitizer;
use Carbon\Carbon;
use Throwable;

class TaskController extends Controller
{
    /*
        status 0: Active tasks
        status 1: New Task
        status 2: In Progress
        status 3: Done
        status 4: Verified
        status 5: Completed
        status 6: KIV
        status 7: Rejected Up
        
    */

    public function index(Request $request)
    {
        // Use Sanctum authentication
        $user = $request->user();

        // if (!$user->can('manage_task')) {
        //     return response()->json([
        //         'success' => false,
        //         'message' => trans('translation.access_error_msg'),
        //         'data' => null
        //     ], 403);
        // }

        $all   = Tasks::with('lead', 'users.user')->visibleTo($user);
        $tasks = Tasks::with('lead', 'users.user')->visibleTo($user);

        // One search box: title, reference, or the outlet's name.
        if ($request->filled('search')) {
            $keyword = $request->get('search');
            $match = function ($q) use ($keyword) {
                $q->where('title', 'like', '%' . $keyword . '%')
                  ->orWhere('task_reference', 'like', '%' . $keyword . '%')
                  ->orWhereHas('lead', fn ($lead) => $lead->where('name', 'like', '%' . $keyword . '%')
                                                          ->orWhere('business_name', 'like', '%' . $keyword . '%'));
            };
            $tasks = $tasks->where($match);
            $all   = $all->where($match);
        }

        // One outlet's tasks (the outlet screen's Tasks row).
        if ($request->filled('lead_id')) {
            $tasks = $tasks->where('lead_id', $request->get('lead_id'));
            $all   = $all->where('lead_id', $request->get('lead_id'));
        }

        // The outlet's area (More filters on the manager's Tasks).
        if ($request->filled('area')) {
            $area  = $request->get('area');
            $tasks = $tasks->whereHas('lead', fn ($lead) => $lead->where('ife_area_id', $area));
            $all   = $all->whereHas('lead', fn ($lead) => $lead->where('ife_area_id', $area));
        }

        // Apply filters
        if (null != $request->get('leadName') || null != $request->get('businessName')) {
            $tasks = $tasks->whereHas('lead', function ($query) use ($request) {
                $query->where(function ($q) use ($request) {
                    if (null != $request->get('leadName')) {
                        $keyword = $request->get('leadName');
                        $q->where('name', 'like', '%' . $keyword . '%');
                    }

                    if (null != $request->get('leadName') && null != $request->get('businessName')) {
                        $keyword2 = $request->get('businessName');
                        $q->orWhere('business_name', 'like', '%' . $keyword2 . '%');
                    } elseif (null == $request->get('leadName') && null != $request->get('businessName')) {
                        $keyword2 = $request->get('businessName');
                        $q->where('business_name', 'like', '%' . $keyword2 . '%');
                    }
                });
            });

            $all = $all->whereHas('lead', function ($query) use ($request) {
                $query->where(function ($q) use ($request) {
                    if (null != $request->get('leadName')) {
                        $keyword = $request->get('leadName');
                        $q->where('name', 'like', '%' . $keyword . '%');
                    }

                    if (null != $request->get('leadName') && null != $request->get('businessName')) {
                        $keyword2 = $request->get('businessName');
                        $q->orWhere('business_name', 'like', '%' . $keyword2 . '%');
                    } elseif (null == $request->get('leadName') && null != $request->get('businessName')) {
                        $keyword2 = $request->get('businessName');
                        $q->where('business_name', 'like', '%' . $keyword2 . '%');
                    }
                });
            });
        }

        if (null !== $request->get('leadMobile')) {
            $keyword = $request->get('leadMobile');
            $tasks = $tasks->whereHas('lead', function ($query) use ($keyword) {
                $query->where('mobile', 'like', '%' . $keyword . '%');
            });

            $all = $all->whereHas('lead', function ($query) use ($keyword) {
                $query->where('mobile', 'like', '%' . $keyword . '%');
            });
        }

        if (null !== $request->get('taskTitle')) {
            $keyword = $request->get('taskTitle');
            $tasks = $tasks->where('title', 'like', '%' . $keyword . '%');
            $all = $all->where('title', 'like', '%' . $keyword . '%');
        }

        if (null !== $request->get('withSales')) {
            $tasks = $tasks->where('sales', '>', 0);
            $all = $all->where('sales', '>', 0);
        }

        if (null != $request->get('customerID')) {
            $keyword = $request->get('customerID');

            $tasks = $tasks->whereHas('lead', function ($query) use ($keyword) {
                $query->where('customer_id', $keyword);
            });

            $all = $all->whereHas('lead', function ($query) use ($keyword) {
                $query->where('customer_id', $keyword);
            });
        }

        if (null !== $request->get('alert')) {
            $tasks = $tasks->where('alert', '>', 0);
            $all = $all->where('alert', '>', 0);
        }

        if (null !== $request->get('source')) {
            $keyword = $request->get('source');

            $tasks = $tasks->whereHas('lead', function ($query) use ($keyword) {
                $query->where('source', $keyword);
            });

            $all = $all->whereHas('lead', function ($query) use ($keyword) {
                $query->where('source', $keyword);
            });
        }

        if (null !== $request->get('businessCategory')) {
            $keyword = $request->get('businessCategory');

            $tasks = $tasks->whereHas('lead', function ($query) use ($keyword) {
                $query->where('business_category', $keyword);
            });

            $all = $all->whereHas('lead', function ($query) use ($keyword) {
                $query->where('business_category', $keyword);
            });
        }

        if (null !== $request->get('refNumber')) {
            $keyword = $request->get('refNumber');
            $tasks = $tasks->where('task_reference', 'like', '%' . $keyword . '%');
            $all = $all->where('task_reference', 'like', '%' . $keyword . '%');
        }

        if (null !== $request->get('submissionStartDate')) {
            $from = Carbon::parse($request->get('submissionStartDate'))->startOfDay();
            $to = Carbon::parse($request->get('submissionEndDate'))->copy()->endOfDay();
            $tasks = $tasks->whereBetween('created_at', [$from, $to]);
            $all = $all->whereBetween('created_at', [$from, $to]);
        }

        if (null !== $request->get('completionStartDate')) {
            $from = Carbon::parse($request->get('completionStartDate'))->startOfDay();
            $to = Carbon::parse($request->get('completionEndDate'))->copy()->endOfDay();
            $tasks = $tasks->whereBetween('complete_date', [$from, $to]);
            $all = $all->whereBetween('complete_date', [$from, $to]);
        }

        if (null !== $request->get('inProgressStartDate')) {
            $from = Carbon::parse($request->get('inProgressStartDate'))->startOfDay();
            $to = Carbon::parse($request->get('inProgressEndDate'))->copy()->endOfDay();
            $tasks = $tasks->whereBetween('inprogress_date', [$from, $to]);
            $all = $all->whereBetween('inprogress_date', [$from, $to]);
        }

        if (null !== $request->get('doneStartDate')) {
            $from = Carbon::parse($request->get('doneStartDate'))->startOfDay();
            $to = Carbon::parse($request->get('doneEndDate'))->copy()->endOfDay();
            $tasks = $tasks->whereBetween('done_date', [$from, $to]);
            $all = $all->whereBetween('done_date', [$from, $to]);
        }

        if (null !== $request->get('verificationStartDate')) {
            $from = Carbon::parse($request->get('verificationStartDate'))->startOfDay();
            $to = Carbon::parse($request->get('verificationEndDate'))->copy()->endOfDay();
            $tasks = $tasks->whereBetween('verify_date', [$from, $to]);
            $all = $all->whereBetween('verify_date', [$from, $to]);
        }

        if (null !== $request->get('rejectedStartDate')) {
            $from = Carbon::parse($request->get('rejectedStartDate'))->startOfDay();
            $to = Carbon::parse($request->get('rejectedEndDate'))->copy()->endOfDay();
            $tasks = $tasks->whereBetween('reject_date', [$from, $to]);
            $all = $all->whereBetween('reject_date', [$from, $to]);
        }

        if (null !== $request->get('KIVStartDate')) {
            $from = Carbon::parse($request->get('KIVStartDate'))->startOfDay();
            $to = Carbon::parse($request->get('KIVEndDate'))->copy()->endOfDay();
            $tasks = $tasks->whereBetween('kiv_date', [$from, $to]);
            $all = $all->whereBetween('kiv_date', [$from, $to]);
        }

        if (null !== $request->get('appointmentStartDate')) {
            $from = Carbon::parse($request->get('appointmentStartDate'))->startOfDay();
            $to = Carbon::parse($request->get('appointEndDate'))->copy()->endOfDay();
            $tasks = $tasks->whereBetween('appointment_date', [$from, $to]);
            $all = $all->whereBetween('appointment_date', [$from, $to]);
        }

        if (null !== $request->get('onHoldStartDate')) {
            $from = Carbon::parse($request->get('onHoldStartDate'))->startOfDay();
            $to = Carbon::parse($request->get('onHoldEndDate'))->copy()->endOfDay();
            $tasks = $tasks->whereBetween('onhold_date', [$from, $to]);
            $all = $all->whereBetween('onhold_date', [$from, $to]);
        }

        $userFilterList = [];
        if (null !== $request->get('subscriber') || null !== $request->get('subSubscriber') || null !== $request->get('creator') || null !== $request->get('checker') || null !== $request->get('owner') || null !== $request->get('viewer')) {
            if (null !== $request->get('subscriber')) {
                array_push($userFilterList, ['role' => 2, 'id' => $request->get('subscriber')]);
            }
            if (null !== $request->get('subSubscriber')) {
                array_push($userFilterList, ['role' => 6, 'id' => $request->get('subSubscriber')]);
            }
            if (null !== $request->get('creator')) {
                array_push($userFilterList, ['role' => 1, 'id' => $request->get('creator')]);
            }
            if (null !== $request->get('checker')) {
                array_push($userFilterList, ['role' => 3, 'id' => $request->get('checker')]);
            }
            if (null !== $request->get('owner')) {
                array_push($userFilterList, ['role' => 4, 'id' => $request->get('owner')]);
            }
            if (null !== $request->get('viewer')) {
                array_push($userFilterList, ['role' => 5, 'id' => $request->get('viewer')]);
            }

            if (count($userFilterList) > 0) {
                $tasks = $tasks->whereHas('users', function ($query) use ($userFilterList) {
                    $first = true;
                    foreach ($userFilterList as $item) {
                        if ($first == true) {
                            $query->where(function ($q) use ($item) {
                                $q->where('user_id', $item['id'])
                                    ->where('role', $item['role']);
                            });
                            $first = false;
                        } else {
                            $query->orWhere(function ($q) use ($item) {
                                $q->where('user_id', $item['id'])
                                    ->where('role', $item['role']);
                            });
                        }
                    }
                });
                $all = $all->whereHas('users', function ($query) use ($userFilterList) {
                    $first = true;
                    foreach ($userFilterList as $item) {
                        if ($first == true) {
                            $query->where(function ($q) use ($item) {
                                $q->where('user_id', $item['id'])
                                    ->where('role', $item['role']);
                            });
                            $first = false;
                        } else {
                            $query->orWhere(function ($q) use ($item) {
                                $q->where('user_id', $item['id'])
                                    ->where('role', $item['role']);
                            });
                        }
                    }
                });
            }
        }

        // Get Summary Counts
        $statusOptions = [
            0 => 'Active Tasks', // Combined count for status 1, 2, 3
            1 => 'New Task',
            2 => 'In Progress',
            3 => 'Done',
            4 => 'Verified',
            5 => 'Completed',
            6 => 'Keep In View',
            7 => 'Rejected',
            
        ];

        $summaryQuery = clone $all;
        $statusCounts = $summaryQuery->selectRaw('status, COUNT(id) as count')
            ->groupBy('status')
            ->get()
            ->pluck('count', 'status')
            ->toArray();

        // Initialize summary array with format matching frontend requirements
        $summary = [];
        foreach ($statusOptions as $value => $label) {
            // Calculate count for active tasks (status 0) as sum of statuses 1, 2, and 3
            $count = 0;
            if ($value === 0) {
                $count = ($statusCounts[1] ?? 0) + ($statusCounts[2] ?? 0) ;
            } else {
                $count = $statusCounts[$value] ?? 0;
            }

            $summary[] = [
                'label' => $label,
                'value' => $value,
                'count' => $count
            ];
        }

        // A focus replaces the status filter: the risk ones pick from open
        // tasks (narrowed after the risk check below), to_check is work marked
        // done and waiting for its checker, parked is kept in view or on hold.
        $focus = $request->input('focus');
        $riskFocus = in_array($focus, ['overdue', 'at_risk', 'urgent', 'due_today'], true);

        // Apply Status Filter
        $status = $request->input('status');
        if ($riskFocus) {
            $tasks = $tasks->whereIn('status', TaskRisk::OPEN_STATUSES);
        } elseif ($focus === 'to_check') {
            $tasks = $tasks->where('status', 3);
        } elseif ($focus === 'parked') {
            $tasks = $tasks->whereIn('status', [6, 8]);
        } elseif ($status === '0' || $status === 0) {
            $activeStatuses = [1, 2]; // 1=New, 2=In Progress
            $tasks = $tasks->whereIn('status', $activeStatuses);
        } elseif ($status) {
            $tasks = $tasks->where('status', $status);
        } else {
            // Default to status 1 & 2 if no status is provided
            $activeStatuses = [1, 2]; // 1=New, 2=In Progress
            $tasks = $tasks->whereIn('status', $activeStatuses);
        }

        // Set default sorting
        if (null == $request->get('sortBy')) {
            $request->merge(['sortBy' => 'last_follow_up']);
        }

        if ($request->get('sortBy') == 'last_follow_up') {
            if (null == $request->get('sortMode')) {
                $request->merge(['sortMode' => 'desc']);
            }
        } else if ($request->get('sortBy') == 'reminder_date') {
            if (null == $request->get('sortMode')) {
                $request->merge(['sortMode' => 'desc']);
            }
        } else if ($request->get('sortBy') == 'due_date') {
            if (null == $request->get('sortMode')) {
                $request->merge(['sortMode' => 'asc']);
            }
        } else if ($request->get('sortBy') == 'reject_date') {
            if (null == $request->get('sortMode')) {
                $request->merge(['sortMode' => 'desc']);
            }
        } else if ($request->get('sortBy') == 'inprogress_date') {
            if (null == $request->get('sortMode')) {
                $request->merge(['sortMode' => 'desc']);
            }
        } else if ($request->get('sortBy') == 'kiv_date') {
            if (null == $request->get('sortMode')) {
                $request->merge(['sortMode' => 'desc']);
            }
        } else if ($request->get('sortBy') == 'onhold_date') {
            if (null == $request->get('sortMode')) {
                $request->merge(['sortMode' => 'desc']);
            }
        } else {
            if (null == $request->get('sortMode')) {
                $request->merge(['sortMode' => 'desc']);
            }
        }

        // Apply sorting
        $currentStatus = $request->input('status');
        if ($currentStatus < 5) {
            if ($request->get('sortMode') == 'asc') {
                $sortBy = $request->get('sortBy');
                $tasks = $tasks->get()
                    ->sortBy(function ($t) use ($sortBy) {
                        switch ($sortBy) {
                            case 'reminder_date':
                                return [$t->reminder_date_time, $t->last_follow_up];
                            case 'last_follow_up':
                                return [$t->last_follow_up, $t->created_at];
                            case 'last_updated_date':
                                return [$t->updated_at];
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
                                return [$t->reject_date, $t->last_follow_up, $t->created_at];
                        }
                    });
            } else {
                $sortBy = $request->get('sortBy');
                $tasks = $tasks->get()
                    ->sortByDesc(function ($t) use ($sortBy) {
                        switch ($sortBy) {
                            case 'reminder_date':
                                return [$t->reminder_date_time, $t->last_follow_up];
                            case 'last_updated_date':
                                return [$t->updated_at];
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
                                return [$t->reject_date, $t->last_follow_up, $t->created_at];
                        }
                    });
            }
        } else {
            if ($request->get('sortBy') == 'last_follow_up') {
                $tasks = $tasks->orderBy('complete_date', 'desc')->orderBy('kiv_date', 'desc')->orderBy('reject_date', 'desc');
            } elseif ($request->get('sortBy') == 'last_updated_date') {
                $tasks = $tasks->orderBy('updated_at', $request->get('sortMode'));
            } else {
                $tasks = $tasks->orderBy($request->get('sortBy'), $request->get('sortMode'));
            }
        }

        // Narrow and order the risk focuses with the same check the
        // dashboard uses: overdue first, then at risk, each by due time.
        $riskCheck = TaskRisk::fromConfig();
        $now       = now();
        if ($riskFocus) {
            $today = $now->toDateString();
            $tasks = $tasks->map(fn ($task) => ['task' => $task, 'risk' => $riskCheck->assessTask($task, $now)])
                ->filter(function ($row) use ($focus, $today) {
                    $level = $row['risk']['level'];
                    return match ($focus) {
                        'overdue'   => $level === TaskRisk::OVERDUE,
                        'at_risk'   => $level === TaskRisk::AT_RISK,
                        'urgent'    => $level !== TaskRisk::ON_TRACK,
                        'due_today' => $row['task']->due_date && Carbon::parse($row['task']->due_date)->toDateString() === $today,
                    };
                })
                ->sortBy(fn ($row) => [
                    $row['risk']['level'] === TaskRisk::OVERDUE ? 0 : ($row['risk']['level'] === TaskRisk::AT_RISK ? 1 : 2),
                    optional($row['risk']['due_at'])->getTimestamp() ?? PHP_INT_MAX,
                ])
                ->map(fn ($row) => $row['task'])
                ->values();
        }

        // Pagination
        $perPage    = $request->get('per_page', 10);
        $page       = $request->get('page', 1);

        if ($currentStatus < 5) {
            // For custom sorting, we need to handle pagination manually
            $total = $tasks->count();
            $tasks = $tasks->slice(($page - 1) * $perPage, $perPage)->values();

            $pagination = [
            'current_page'  => $page,
            'per_page'      => $perPage,
            'total'         => $total,
            'last_page'     => ceil($total / $perPage),
            'from'          => (($page - 1) * $perPage) + 1,
            'to'            => min($page * $perPage, $total)
            ];
        } else {
            $paginatedTasks = $tasks->paginate($perPage);
            $pagination = [
            'current_page'  => $paginatedTasks->currentPage(),
            'per_page'      => $paginatedTasks->perPage(),
            'total'         => $paginatedTasks->total(),
            'last_page'     => $paginatedTasks->lastPage(),
            'from'          => $paginatedTasks->firstItem(),
            'to'            => $paginatedTasks->lastItem()
            ];
            $tasks = collect($paginatedTasks->items());
        }

        $data = [];
        $data['tasks']              = $tasks->map(function ($task) use ($user, $riskCheck, $now) {
            return [
                'id'                    => $task->id,
                'alert'                 => $task->alert,
                ...$this->mobileTaskExtras($task, $riskCheck, $now),
                'lead_name'             => $task->lead->name ?? null,
                'lead_id'               => $task->lead_id,
                'title'                 => $task->title,
                'subscriber'            => $task->users->where('role', 2)->first()->user->name ?? null,
                'subscriber_id'         => $task->users->where('role', 2)->first()->user_id ?? null,
                'due_date'              => $task->due_date ?? null,
                'unread_notification'   => count($task->has_unread_notification ?? []),
                'status'                => $task->status,
                'sub_subscribers'       => $task->users->where('role', 6)->pluck('user.name')->toArray(),
                'sub_subscriber_ids'    => $task->users->where('role', 6)->pluck('user_id')->toArray(),
                'owners'                => $task->users->where('role', 4)->pluck('user.name')->toArray(),
                'owner_ids'             => $task->users->where('role', 4)->pluck('user_id')->toArray(),
                'viewers'               => $task->users->where('role', 5)->pluck('user.name')->toArray(),
                'viewer_ids'            => $task->users->where('role', 5)->pluck('user_id')->toArray(),
                'task_start_date'       => $task->start_date ?? null,
                'task_due_date'         => $task->due_date ?? null,
                'task_start_time'       => $task->start_time ?? null,
                'task_due_time'         => $task->due_time ?? null,
                'appointment_date_time' => $task->appointment_date ?? null,
                'remark'                => $task->remark ?? null,
                'last_follow_up'        => $task->last_follow_up ? Carbon::parse($task->last_follow_up)->format('Y-m-d H:i:s') : null,
                'last_updated_by'       => $task->comments->sortByDesc('created_at')->first()->submitBy->name ?? null,
                ...$task->actionFlagsFor($user),
            ];
        });
        $data['summary']    = $summary;
        $data['pagination'] = $pagination;
        return $this->response_ok($data, 'Task List Retrieved Successfully');
    }

    public function getTaskByID(Request $request) 
    {
        try {

            $user = $request->user();

            $taskID = $request->input('taskID');
            if (!$taskID) {
                return $this->response_failed('Task ID is required.');
            }

            // Only a task the caller may see (everyone, for Admin/Manager).
            $task = Tasks::with('users.user', 'lead')->visibleTo($user)->find($taskID);
            if (!$task) {
                return $this->response_failed('Task not found.');
            }

            // What the doer wrote when they marked it done, for the checker.
            $doneNote = TaskHistory::where('task_id', $task->id)
                ->where('after_status', 3)
                ->latest('id')
                ->first();

            // Why the checker sent it back (Done to In Progress), while it is in
            // progress again: the doer needs the reason to finish it.
            $sentBack = (int) $task->status === 2
                ? TaskHistory::where('task_id', $task->id)
                    ->where('before_status', 3)
                    ->where('after_status', 2)
                    ->latest('id')
                    ->first()
                : null;

            $data = [
                'id'                    => $task->id,
                ...$this->mobileTaskExtras($task, TaskRisk::fromConfig(), now()),
                'reminder_at'           => $task->reminder_date_time,
                'done_remark'           => optional($doneNote)->remark,
                'done_by'               => optional(optional($doneNote)->updatedBy)->name,
                // Photos added with Mark as done: the task's own files from then on.
                'done_photos'           => $doneNote
                    ? Helper::media_documents_array(DocumentUpload::where('task_id', $task->id)
                        ->whereNull('task_comment_id')
                        ->where('created_at', '>=', $doneNote->created_at->copy()->subMinute())
                        ->get())
                    : null,
                'sent_back'             => $sentBack ? [
                    'remark' => $sentBack->remark,
                    'by'     => optional($sentBack->updatedBy)->name,
                    'at'     => optional($sentBack->created_at)->toDateTimeString(),
                ] : null,
                'verify_date'           => $task->verify_date,
                'invoice_no'            => $task->invoice_no,
                'sales'                 => $task->sales,
                'lead_mobile'           => optional($task->lead)->mobile,
                'creator'               => optional(optional($task->users->firstWhere('role', 1))->user)->name,
                'reference_no'          => $task->task_reference ?? null,
                'lead'                  => $task->lead->name,
                'lead_id'               => $task->lead_id,
                'title'                 => $task->title,
                'subscriber'            => $task->users->where('role', 2)->first()->user->name ?? null,
                'subscriber_id'         => $task->users->where('role', 2)->first()->user_id ?? null,
                'due_date'              => $task->due_date ?? null,
                'unread_notification'   => count($task->has_unread_notification ?? []),
                'status'                => $task->status,
                'sub_subscribers'       => $task->users->where('role', 6)->pluck('user.name')->toArray(),
                'sub_subscriber_ids'    => $task->users->where('role', 6)->pluck('user_id')->toArray(),
                'owners'                => $task->users->where('role', 4)->pluck('user.name')->toArray(),
                'owner_ids'             => $task->users->where('role', 4)->pluck('user_id')->toArray(),
                'viewers'               => $task->users->where('role', 5)->pluck('user.name')->toArray(),
                'viewer_ids'            => $task->users->where('role', 5)->pluck('user_id')->toArray(),
                'task_start_date'       => $task->start_date ?? null,
                'task_due_date'         => $task->due_date ?? null,
                'task_start_time'       => $task->start_time ?? null,
                'task_due_time'         => $task->due_time ?? null,
                'appointment_date_time' => $task->appointment_date ?? null,
                'remark'                => $task->remark ?? null,
                ...$task->actionFlagsFor($user),
            ];

            return $this->response_success($data, 'Task retrieved successfully.');
        } catch (Throwable $e) {
            return $this->response_failed('Failed to retrieve task: ' . $e->getMessage());
        } catch (\Exception $f) {
            return $this->response_failed('Failed to retrieve task: ' . $f->getMessage());
        }  
    }

    public function getTaskMedia(Request $request)
    {
        $taskID = $request->input('taskID');

        if (!$taskID) {
            return $this->response_failed('Lead ID is required.');
        }

        $task = Tasks::with('documentUploads')->find($taskID);

        if (!$task) {
            return $this->response_failed('Task not found.');
        }

        $data = Helper::media_documents_array($task->documentUploads);

        return $this->response_success($data, 'Sales tasks media retrieved successfully.');
    }
    
    public function getFilterOptions(Request $request)
    {
        // One list serves every picker: users, subscribers, viewers and owners.
        $assignable = User::assignable()->get(['id', 'name']);

        try {
            $data= [];
            $data['users']                      = Helper::formatForDropdown($assignable, 'id', 'name');
            $data['source']                     = Helper::getLeadSourceListingForMobile();
            $data['businessCategory']           = Helper::getBusinessCategoryListingForMobile();
            $data['add_task_subscribers']       = Helper::formatForDropdown($assignable, 'id', 'name');
            $data['add_task_viewers']           = Helper::formatForDropdown($assignable, 'id', 'name');
            $data['add_task_owners']            = Helper::formatForDropdown($assignable, 'id', 'name');

        } catch (\Exception $e) {
            return $this->response_failed([], 'Error Retrieving Filter Options: ' . $e->getMessage());
        } catch (\Throwable $f) {
            return $this->response_failed([], 'Error Retrieving Filter Options: ' . $f->getMessage());
        }
        
        return $this->response_ok($data, 'Filter Options Retrieved Successfully');
    }

    public function getTaskHistory(Request $request)
    {
        try {
            $taskID = $request->input('taskID');
            if (!$taskID) {
                return $this->response_failed('Task ID is required.');
            }

            $task = Tasks::with('history')->find($taskID);
            if (!$task) {
                return $this->response_failed('Task not found.');
            }

            $data = [
                'id' => $task->id,
                'history' => $task->history,
            ];

            return $this->response_success($data, 'Task history retrieved successfully.');
        } catch (Throwable $e) {
            return $this->response_failed('Failed to retrieve task history: ' . $e->getMessage());
        } catch (\Exception $f) {
            return $this->response_failed('Failed to retrieve task history: ' . $f->getMessage());
        }
    }

    public function addTask(TaskCreateRequest $request)
    {
        $user = $request->user();

        if (!$user->can('add_task')) {
            return $this->response_failed('Only your manager can add a task. Check with them.')->setStatusCode(403);
        }

        // create_task means "create and assign to others". Without it the task
        // is the user's own: they are its subscriber, checker and owner.
        $assigns = $user->can('create_task');

        // Only on a lead this user can already see (everyone, for Admin/Manager).
        if (Leads::visibleTo($user)->where('id', $request->input('lead_id'))->doesntExist()) {
            return $this->response_failed('We could not find this outlet.');
        }

        // "Make it a task" from a visit report: the same link as the web's
        // convert, checked before anything is written.
        $report = null;
        if ($request->filled('ife_report_id')) {
            if (!$user->can('manage_ife_report')) {
                return $this->response_failed('Only your manager can make a visit report a task.');
            }
            $report = IFEReport::visibleTo($user)->find($request->input('ife_report_id'));
            if (!$report) {
                return $this->response_failed('We could not find this visit report.');
            }
            if ($report->task_id) {
                return $this->response_failed('This visit report is already a task.');
            }
        }

        try {
            DB::beginTransaction();

            $validatedData  = $request->validated();
            $subscriber     = $assigns ? User::where('id', $validatedData['subscriber'])->firstOrFail() : $user;
            $subSubscribers = $assigns ? ($validatedData['sub_subscriber'] ?? []) : [];
            $owners         = $assigns ? ($validatedData['owner'] ?? []) : [$user->id];
            $viewers        = $assigns ? ($validatedData['viewer'] ?? []) : [];

            $lead = Leads::where('id', $validatedData['lead_id'])->lockForUpdate()->firstOrFail();
            $lead->assign_to = $subscriber->id;
            // hq_checker is the overseeing manager; a rep's own task keeps it.
            if ($assigns) {
                $lead->hq_checker = $user->id;
            }
            $lead->save();

            $task = new Tasks();
            $task->status           = 1;
            $task->lead_id          = $lead->id;
            $task->task_reference   = Tasks::nextReference();
            $task->title            = $validatedData['title'];
            $task->start_date       = $validatedData['task_start_date'];
            $task->start_time       = $validatedData['task_start_time'];
            $task->due_date         = $validatedData['task_due_date'];
            $task->due_time         = $validatedData['task_due_time'];

            if (!empty($validatedData['task_appointment_date'])) {
                if (!empty($validatedData['task_appointment_time'])) {
                    $task->appointment_date = Carbon::parse($validatedData['task_appointment_date'])->format('Y-m-d ' . $validatedData['task_appointment_time']);
                } else {
                    $task->appointment_date = Carbon::parse($validatedData['task_appointment_date'])->format('Y-m-d 00:00:00');
                }
            } else {
                $task->appointment_date = null;
            }

            $task->remark               = $validatedData['remark'] ?? null;
            $task->creation_date        = now();
            $task->inprogress_date      = null;
            $task->done_date            = null;
            $task->verify_date          = null;
            $task->complete_date        = null;
            $task->reject_date          = null;
            $task->kiv_date             = null;
            $task->save();

            /**
             * ROLE:
             *  1:creator, 2:subscriber, 3:checker, 4:owner, 5:viewer, 6:sub-subscriber
             */

            // creator
            $taskUser           = new TaskUsers();
            $taskUser->task_id  = $task->id;
            $taskUser->user_id  = $user->id;
            $taskUser->role     = 1;
            $taskUser->save();

            // subscriber
            $taskUser           = new TaskUsers();
            $taskUser->task_id  = $task->id;
            $taskUser->user_id  = $subscriber->id;
            $taskUser->role     = 2;
            $taskUser->save();

            // checker
            $taskUser           = new TaskUsers();
            $taskUser->task_id  = $task->id;
            $taskUser->user_id  = $user->id;
            $taskUser->role     = 3;
            $taskUser->save();

            // sub-subscriber
            foreach ($subSubscribers as $o) {
                $taskUser          = new TaskUsers();
                $taskUser->task_id = $task->id;
                $taskUser->user_id = $o;
                $taskUser->role    = 6;
                $taskUser->save();
            }

            // owner
            foreach ($owners as $o) {
                $taskUser          = new TaskUsers();
                $taskUser->task_id = $task->id;
                $taskUser->user_id = $o;
                $taskUser->role    = 4;
                $taskUser->save();
            }

            // viewer
            foreach ($viewers as $v) {
                $taskUser          = new TaskUsers();
                $taskUser->task_id = $task->id;
                $taskUser->user_id = $v;
                $taskUser->role    = 5;
                $taskUser->save();
            }

            if ($request->hasFile('file')) {
                $this->upload($request, $task->id);
            }

            $param_b    = new Tasks();
            $param_a    = Tasks::with('lead')->findOrFail($task->id);
            $data       = Helper::prepareDataForSerialize($param_b, $param_a);

            $history                    = new TaskHistory();
            $history->task_id           = $task->id;
            $history->updated_by        = $user->id;
            $history->before_status     = 0;
            $history->after_status      = 1;
            $history->content_before    = serialize($data['before']);
            $history->content_after     = serialize($data['after']);
            $history->remark            = null;
            $history->save();

            if ($report) {
                $this->linkVisitReport($report, $task);
            }

            $runJob = (new FirebaseNotification($task->id, 'task', '1'));
            dispatch($runJob);

            DB::commit();

            return $this->response_success($task, 'Task created successfully.');

        } catch (Throwable $e) {
            DB::rollBack();

            Log::error('API Task creation failed: ' . $e->getMessage(), [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
                'trace' => $e->getTraceAsString()
            ]);

            return $this->response_failed('An unexpected error occurred while creating the task.');
        }
    }

    /**
     * Tie a visit report to the task made from it, as the web's convert does:
     * the report points at the task (and its outlet), and the task's messages
     * open with the report.
     */
    private function linkVisitReport(IFEReport $report, Tasks $task): void
    {
        $report->task_id = $task->id;
        if (!$report->lead_id) {
            $report->lead_id = $task->lead_id;
        }
        $report->save();

        $comment                = new TaskComment();
        $comment->task_id       = $task->id;
        $comment->submit_by     = $report->created_by;
        $comment->submit_date   = now();
        $comment->message       = Helper::generateIfeReportHTML($report);
        $comment->ife_report_id = $report->id;
        $comment->save();
    }

    public function updateTask(TaskSaveRequest $request)
    {
        $user = $request->user();

        try {
            DB::beginTransaction();

            $validatedData = $request->validated();

            $task       = Tasks::where('id', $validatedData['task_id'])->lockForUpdate()->firstOrFail();
            $param_b    = Tasks::with('lead', 'users.user')->findOrFail($task->id);
            $subscriber = User::where('id', $validatedData['subscriber'])->firstOrFail();

            $lead = Leads::where('id', $task->lead_id)->lockForUpdate()->firstOrFail();
            $lead->assign_to = $subscriber->id;
            $lead->save();

            $task->title            = $validatedData['title'];
            $task->start_date       = $validatedData['task_start_date'];
            $task->start_time       = $validatedData['task_start_time'];
            $task->due_date         = $validatedData['task_due_date'];
            $task->due_time         = $validatedData['task_due_time'];

            $today  = strtotime(Carbon::now()->format('Y-m-d H:i:s'));
            $due    = strtotime(Carbon::parse($validatedData['task_due_date'] . ' ' . $validatedData['task_due_time'])->format('Y-m-d H:i:s'));

            if ($today < $due) {
                $task->due_notify = 0;
            }

            if (!empty($validatedData['task_appointment_date'])) {
                if (!empty($validatedData['task_appointment_time'])) {
                    $task->appointment_date = Carbon::parse($validatedData['task_appointment_date'])->format('Y-m-d ' . $validatedData['task_appointment_time']);
                } else {
                    $task->appointment_date = Carbon::parse($validatedData['task_appointment_date'])->format('Y-m-d 00:00:00');
                }
            } else {
                $task->appointment_date = null;
            }

            $task->remark           = $validatedData['remark'] ?? null;
            $task->save();

            $isRecycle = false;
            if (in_array($task->status, [5, 6, 7])) {
                $task->status = 1;
                $task->save();
                $isRecycle = true;
            }

            /**
             * ROLE:
             *  1:creator, 2:subscriber, 3:checker, 4:owner, 5:viewer, 6:sub-subscriber
             */

            $changerUser = false; // This flag is preserved from the original logic.

            // subscriber
            $keep = [];
            $find = TaskUsers::where('task_id', $task->id)
                ->where('user_id', $subscriber->id)
                ->where('role', 2)
                ->first();
            array_push($keep, $subscriber->id);
            if (!isset($find)) {
                $changerUser = true;
                TaskUsers::where('task_id', $task->id)
                    ->where('role', 2)
                    ->whereNotIn('user_id', $keep)
                    ->delete();

                $taskUser = new TaskUsers();
                $taskUser->task_id = $task->id;
                $taskUser->user_id = $subscriber->id;
                $taskUser->role = 2;
                $taskUser->save();
            }

            // sub-subscriber
            if (isset($validatedData['sub_subscriber'])) {
                $keep = [];
                foreach ($validatedData['sub_subscriber'] as $o) {
                    $find = TaskUsers::where('task_id', $task->id)
                        ->where('user_id', $o)
                        ->where('role', 6)
                        ->first();
                    array_push($keep, $o);
                    if (!isset($find)) {
                        $changerUser = true;
                        $taskUser = new TaskUsers();
                        $taskUser->task_id = $task->id;
                        $taskUser->user_id = $o;
                        $taskUser->role = 6;
                        $taskUser->save();
                    }
                }
                $cnt = TaskUsers::where('task_id', $task->id)
                    ->where('role', 6)
                    ->whereNotIn('user_id', $keep)
                    ->count();
                if ($cnt > 0) {
                    $changerUser = true;
                    TaskUsers::where('task_id', $task->id)
                        ->where('role', 6)
                        ->whereNotIn('user_id', $keep)
                        ->delete();
                }
            } else {
                $find = TaskUsers::where('task_id', $task->id)->where('role', 6)->first();
                if (isset($find)) {
                    $changerUser = true;
                    TaskUsers::where('task_id', $task->id)->where('role', 6)->delete();
                }
            }

            // owner
            if (isset($validatedData['owner'])) {
                $keep = [];
                foreach ($validatedData['owner'] as $o) {
                    $find = TaskUsers::where('task_id', $task->id)
                        ->where('user_id', $o)
                        ->where('role', 4)
                        ->first();
                    array_push($keep, $o);
                    if (!isset($find)) {
                        $changerUser = true;
                        $taskUser = new TaskUsers();
                        $taskUser->task_id = $task->id;
                        $taskUser->user_id = $o;
                        $taskUser->role = 4;
                        $taskUser->save();
                    }
                }
                $cnt = TaskUsers::where('task_id', $task->id)->where('role', 4)->whereNotIn('user_id', $keep)->count();
                if ($cnt > 0) {
                    $changerUser = true;
                    TaskUsers::where('task_id', $task->id)->where('role', 4)->whereNotIn('user_id', $keep)->delete();
                }
            } else {
                $find = TaskUsers::where('task_id', $task->id)->where('role', 4)->first();
                if (isset($find)) {
                    $changerUser = true;
                    TaskUsers::where('task_id', $task->id)->where('role', 4)->delete();
                }
            }

            // viewer
            if (isset($validatedData['viewer'])) {
                $keep = [];
                foreach ($validatedData['viewer'] as $o) {
                    $find = TaskUsers::where('task_id', $task->id)->where('user_id', $o)->where('role', 5)->first();
                    array_push($keep, $o);
                    if (!isset($find)) {
                        $changerUser = true;
                        $taskUser = new TaskUsers();
                        $taskUser->task_id = $task->id;
                        $taskUser->user_id = $o;
                        $taskUser->role = 5;
                        $taskUser->save();
                    }
                }
                $cnt = TaskUsers::where('task_id', $task->id)->where('role', 5)->whereNotIn('user_id', $keep)->count();
                if ($cnt > 0) {
                    $changerUser = true;
                    TaskUsers::where('task_id', $task->id)->where('role', 5)->whereNotIn('user_id', $keep)->delete();
                }
            } else {
                $find = TaskUsers::where('task_id', $task->id)->where('role', 5)->first();
                if (isset($find)) {
                    $changerUser = true;
                    TaskUsers::where('task_id', $task->id)->where('role', 5)->delete();
                }
            }

            $param_a    = Tasks::with('lead', 'users.user')->findOrFail($task->id);
            $data       = Helper::prepareDataForSerialize($param_b, $param_a);

            $history                    = new TaskHistory();
            $history->task_id           = $task->id;
            $history->updated_by        = $user->id; // Using the API user
            $history->before_status     = $param_b->status;
            $history->after_status      = $param_a->status;
            $history->content_before    = serialize($data['before']);
            $history->content_after     = serialize($data['after']);
            $history->remark            = $validatedData['special_remark'] ?? null;
            $history->save();

            if ($isRecycle == true) {
                $runJob = (new FirebaseNotification($task->id, 'task', '1'));
                dispatch($runJob);
            } else {
                
            }

            DB::commit();

            return $this->response_success($param_a, 'Task updated successfully.');

        } catch (Throwable $e) {
            DB::rollBack();
            Log::error('API Task update failed: ' . $e->getMessage(), [
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return $this->response_failed('An unexpected error occurred while updating the task.');
        }
    }

    public function getChatHistory(Request $request)
    {
        try {
            $request->validate(['taskID' => 'required|integer']);
            $taskID = $request->input('taskID');

            // Only the messages of a task the caller may see.
            if (Tasks::visibleTo($request->user())->whereKey($taskID)->doesntExist()) {
                return $this->response_failed('Task not found.');
            }

            // 1. Build the base query from the TaskComment model.
            $commentsQuery = TaskComment::where('task_id', $taskID)
                ->with(['submitBy', 'documentUploads'])
                ->orderBy('created_at', 'asc');

            // 4. Paginate the query directly at the database level.
            $paginatedComments = $commentsQuery->paginate(500, ['*'], 'page', $request->input('page', 1));

            $data = [];

            // nl2br($data)

            $data['comments'] = $paginatedComments->map(function ($comment)  {
                return [
                    'id'                => $comment->id,
                    'task_id'           => $comment->task_id,
                    'submitted_by'      => $comment->submit_by,
                    'submit_by_name'    => $comment->submitBy->name ?? 'System',
                    'message'           => nl2br($comment->message),
                    'formatted_message' => nl2br($comment->formated_message),
                    'is_read'           => $comment->is_read,
                    'created_at'        => $comment->created_at,
                    'date'              => $comment->created_at->format('Y-m-d'),
                    'reply_to'          => $comment->reply_message_id,
                    'reply_to_message'  => TaskComment::where('id', $comment->reply_message_id)->with('documentUploads')->get()->first(),
                    'reply_to_name'     => TaskComment::where('id', $comment->reply_message_id)->with('submitBy')->get()->first()->submitBy->name ?? 'System',
                    'updated_at'        => $comment->updated_at,
                    'document_uploads'  => $comment->ife_report_id ? $comment->ifeReport->documentUploads->map(function ($upload) {
                        return [
                            'id'                => $upload->id,
                            'file_name'         => $upload->filename,
                            'file_path'         => $upload->getFileFullPathAttribute(),
                            'file_type'         => strtolower(pathinfo($upload->filename, PATHINFO_EXTENSION)),
                            'size'              => $upload->size,
                            'mime_type'         => $upload->mime_type,
                            'created_at'        => $upload->created_at,
                            'uploaded_by'       => $upload->upload_by,
                            'uploaded_by_name'  => User::find($upload->upload_by)->name ?? 'System',
                        ];
                    }) : $comment->documentUploads->map(function ($upload) {
                        return [
                            'id'                => $upload->id,
                            'file_name'         => $upload->filename,
                            'file_path'         => $upload->getFileFullPathAttribute(),
                            'file_type'         => strtolower(pathinfo($upload->filename, PATHINFO_EXTENSION)),
                            'size'              => $upload->size,
                            'mime_type'         => $upload->mime_type,
                            'created_at'        => $upload->created_at,
                            'uploaded_by'       => $upload->upload_by,
                            'uploaded_by_name'  => User::find($upload->upload_by)->name ?? 'System',
                        ];
                    }),
                ];
            });

            $data['pagination'] = [
                'total'         => $paginatedComments->total(),
                'per_page'      => $paginatedComments->perPage(),
                'current_page'  => $paginatedComments->currentPage(),
                'last_page'     => $paginatedComments->lastPage(),
            ];

            return $this->response_success($data, 'Chat history retrieved successfully.');

        } catch (\Illuminate\Validation\ValidationException $e) {
            return $this->response_failed($e->getMessage(), 422);
        } catch (Throwable $e) {
            Log::error('Error in getChatHistory: ' . $e->getMessage());
            return $this->response_failed('An unexpected error occurred.', 500);
        }
    }

    public function storeChat(Request $request)
    {
        try {
            $user = $request->user();

            // Only on a task the caller may see.
            if (Tasks::visibleTo($user)->whereKey($request->input('task_id'))->doesntExist()) {
                return $this->response_failed('Task not found.');
            }
            
            $newComment = DB::transaction(function () use ( $request, $user) {
                // Create the comment first, so we have an ID to associate with uploads.
                $comment = new TaskComment();
                $comment->task_id           = $request->input('task_id');
                $comment->message           = $request->input('chat_message'); //nl2br($request->input('chat_message', ''));
                $comment->submit_date       = now()->format('Y-m-d');
                $comment->submit_by         = $user->id;
                $comment->reply_message_id  = $request->input('reply_message_id', default: null);
                $comment->save();

                if ($request->hasFile('files')) {
                    Log::info("Request input: " . json_encode($request->all()));
                    $files = $request->file('files');

                    if (!is_array($files)) {
                        $files = [$files];
                    }


                    $task = Tasks::findOrFail($request->input('task_id'));

                    foreach ($files as $i=>$file) {

                        if(!$file->isValid()) {
                            continue; // Skip invalid files
                        }


                        $originalName   = pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME);
                        $sanitizedName  = str_replace(' ', '_', $originalName);
                        $extension      = $file->getClientOriginalExtension();
                        
                        $filename       = "{$sanitizedName}_{$comment->id}-".($i + 1)."-".time().".{$extension}";
                        $path           = "task/{$task->id}";

                        Storage::putFileAs($path, new File($file), $filename);

                        // Create the database record for the upload.
                        $documentUpload = new DocumentUpload();
                        $documentUpload->lead_id         = null;
                        $documentUpload->task_id         = $task->id;
                        $documentUpload->task_comment_id = $comment->id;
                        $documentUpload->upload_by       = $user->id;
                        $documentUpload->filename        = $filename;
                        $documentUpload->size            = $file->getSize();
                        $documentUpload->mime_type       = $file->getMimeType();
                        $documentUpload->save();
                    }
                }

                // Dispatch the notification job.
                dispatch(new FirebaseNotification($comment->id, 'chatroom', '1'));
                
                return $comment;
            });
            
            // Eager load relationships on the newly created comment for the final response.
            $newComment->load(['documentUploads']);

            // 3. Format the final response exactly as specified in the original code.
            $docList = [];
            foreach ($newComment->documentUploads as $upload) {
                $ext = strtolower(pathinfo($upload->filename, PATHINFO_EXTENSION));
                $chatAudioFormat = ['3gp','aa','aac','aax','act','aiff','alac','amr','au','awb','dvf','flac','gsm','iklax','ivs','m4a','m4b','m4p','mmf','movpkg','mp3','mpc','msv','nmf','ogg','oga','mogg','opus','ra','rm','raw','rf64','sln','tta','voc','vox','wav','wma','wv','8svx','cda'];
                $chatImageFormat = ['png', 'jpg', 'jpeg'];
                $chatPdfFormat = ['pdf'];

                $docList[] = [
                    'name'        => $user->name,
                    'time'        => $newComment->created_at->format('h:i A'),
                    'chatid'      => $newComment->id,
                    'docid'       => $upload->id,
                    'fullpath'    => $upload->file_full_path, // Assumes this accessor exists
                    'isChatAudio' => in_array($ext, $chatAudioFormat),
                    'isChatImage' => in_array($ext, $chatImageFormat),
                    'isChatPdf'   => in_array($ext, $chatPdfFormat),
                ];
            }

            $data = $newComment->toArray();
            $data['name']   = $user->name;
            $data['time']   = $newComment->created_at->format('h:i A');
            $data['chatid'] = $newComment->id;
            $data['hasdoc'] = count($docList) > 0;
            $data['doc']    = $docList;
            
            return $this->response_ok($data, 'Message sent successfully.');

        } catch (Throwable $e) {
            // Rollback is handled automatically by DB::transaction() on exception.
            Log::error('Error in ChatController@store: ' . $e->getMessage());
            return $this->response_failed('An unexpected error occurred while sending the message.');
        }
    }

    public function markChatAsRead(Request $request)
    {
        try {

            $user = $request->user();

            DB::beginTransaction();
            
            $task = Tasks::with('comments')->where('id',$request->id)->first();

            if ($task->has_unread_notification->count() > 0) {
                $notifications = Notification::whereIn('notifiable_id', [$user->id])
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

            return $this->response_success([], 'Chat marked as read successfully.');

        } catch (Throwable $e) {

            DB::rollBack();
            return $this->response_failed('Failed to mark chat as read: ' . $e->getMessage());
        
        } catch (\Exception $f) {

            DB::rollBack();
            return $this->response_failed('Failed to mark chat as read: ' . $f->getMessage());
        }

        
    }

    public function editChat(Request $request)
    {
        try {
            $user       = $request->user();
            $chatId     = $request->get('commentID');
            $message    = $request->get('message');

            if (!$chatId || !$message) {
                return $this->response_failed('Comment ID and message are required.');
            }

            $chat = TaskComment::find($chatId);

            // Check if comment was created within the last 15 minutes
            $created    = Carbon::parse($chat->created_at);
            $now        = Carbon::now();
            
            if ($created->diffInMinutes($now) > 15) {
                return $this->response_failed('Comments can only be edited within 15 minutes of creation.');
            }

            if (!$chat) {
                return $this->response_failed('Chat comment not found.');
            }

            if ($chat->submit_by != $user->id) {
                return $this->response_failed('You do not have permission to edit this chat.');
            }

            $chat->message = $message;
            $chat->save();

            // Dispatch the notification job.
            dispatch(new FirebaseNotification($chat->id, 'chatroom', '1'));

            return $this->response_success([], 'Chat updated successfully.');

        } catch (Throwable $e) {
            return $this->response_failed('Failed to update chat: ' . $e->getMessage());
        } catch (\Exception $f) {
            return $this->response_failed('Failed to update chat: ' . $f->getMessage());
        }
    }

    public function deleteChat(Request $request)
    {
        DB::beginTransaction();
        try {

            $user   = $request->user();
            $commentID = $request->get('commentID');

            if (!$commentID) {
                return $this->response_failed('Comment ID is required.');
            }
            
            $chat = TaskComment::find($commentID);
            
            if (!$chat) {
                return $this->response_failed('Chat comment not found.');
            }

            if ($chat->submit_by != $user->id) {
                return $this->response_failed('You do not have permission to delete this chat.');
            }

            if (!empty($request->get('docId'))) {
                $docIds = $request->get('docId');
                // Convert to array if it's a single value
                if (!is_array($docIds)) {
                    $docIds = [$docIds];
                }
                
                // Delete each document in the array
                foreach ($docIds as $docId) {
                    $documentUpload = DocumentUpload::where('id', $docId)->first();
                    if ($documentUpload) {
                        if (S3ClientRepo::IsExisted($documentUpload->file_path, $documentUpload->filename)) {
                            S3ClientRepo::Delete($documentUpload->file_path, $documentUpload->filename);
                        }
                        $documentUpload->delete();
                    }
                }
                
                // Check if there are any remaining documents for this chat
                $remainingDocs = DocumentUpload::where('task_comment_id', $chat->id)->count();
                if ($remainingDocs == 0 && empty($chat->message)) {
                    $chat->delete();
                }
            } else {
                if ($chat->documentUploads->count() > 0) {
                    $chat->message = '';
                    $chat->save();
                } else {
                    $chat->delete();
                }
            }

            DB::commit();

            return $this->response_success([], 'Chat deleted successfully.');

        } catch (Throwable $e) {

            DB::rollBack();
            return $this->response_failed('Failed to delete chat: ' . $e->getMessage());

        } catch (\Exception $f) {

            DB::rollBack();
            return $this->response_failed('Failed to delete chat: ' . $f->getMessage());
        }

       
    }

    public function marked_as_inprogress(Request $request)
    {
        if (!$request->user()->can('manage_task')) {
            return $this->response_failed('You do not have permission to perform this action.', 403);
        }

        $user = $request->user();

        if (!$user) {
            return $this->response_failed('Unauthenticated.', 401);
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
                $history->updated_by        = $user->id;
                $history->before_status     = $param_b->status;
                $history->after_status      = $param_a->status;
                $history->content_before    = serialize($data['before']);
                $history->content_after     = serialize($data['after']);
                $history->remark            = NULL;
                $history->save();

                $runJob = (new FirebaseNotification($task->id, 'task', '2'));
                dispatch($runJob);

                DB::commit();

                return $this->response_success([], 'Task marked as in-progress successfully.');
                
            } catch (Throwable $e) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task accept process fail due to exceptional throwable : '. $e->getMessage());
                    return $this->response_failed('Task accept process failed : ' . $e->getMessage());
                }
                sleep(1);

            } catch (\Exception $f) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task accept fail due to exceptional : '. $f->getMessage());
                    return $this->response_failed('Task accept process failed : ' . $f->getMessage());
                }
                sleep(1);
            }
        }
    }

    public function marked_as_onhold(Request $request)
    {
        if (!$request->user()->can('manage_task')) {
            return $this->response_failed('You do not have permission to perform this action.', 403);
        }

        $user = $request->user();

        if (!$user) {
            return $this->response_failed('Unauthenticated.', 401);
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
                $history->updated_by        = $user->id;
                $history->before_status     = $param_b->status;
                $history->after_status      = $param_a->status;
                $history->content_before    = serialize($data['before']);
                $history->content_after     = serialize($data['after']);
                $history->remark            = $validatedData['special_remark'] ?? null;
                $history->save();

                $runJob = (new FirebaseNotification($task->id, 'task', '6'));
                dispatch($runJob);

                DB::commit();

                return $this->response_success([], 'Task marked as on-hold successfully.');
                
            } catch (Throwable $e) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task kiv process fail due to exceptional throwable : '. $e->getMessage());
                    return $this->response_failed('Task kiv process fail due to exceptional throwable : ' . $e->getMessage());
                }
                sleep(1);

            } catch (\Exception $f) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task kiv fail due to exceptional : '. $f->getMessage());
                    return $this->response_failed('Task kiv fail due to exceptional : ' . $f->getMessage());
                }
                sleep(1);
            }
        }
    }

    public function marked_as_done(Request $request)
    {
        if (!$request->user()->can('manage_task')) {
            return $this->response_failed('You do not have permission to perform this action.', 403);
        }

        $user = $request->user();

        if (!$user) {
            return $this->response_failed('Unauthenticated.', 401);
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

                if (!empty($validatedData['invoice_no'] ?? null)) {
                    $task->invoice_no = $validatedData['invoice_no'];
                }

                if (isset($validatedData['sales_amt']) && is_numeric(str_replace(',', '', $validatedData['sales_amt']))) {
                   $task->sales = str_replace(',','',$validatedData['sales_amt']);
                }
                
                $task->done_date = now();
                $task->save();

                // Photos of the finished work, for the checker.
                $this->upload($request, $task->id, 'files');

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
                $history->updated_by        = $user->id;
                $history->before_status     = $param_b->status;
                $history->after_status      = $param_a->status;
                $history->content_before    = serialize($data['before']);
                $history->content_after     = serialize($data['after']);
                $history->remark            = $validatedData['special_remark'] ?? null;
                $history->save();

                $runJob = (new FirebaseNotification($task->id, 'task', '3'));
                dispatch($runJob);

                DB::commit();

                return $this->response_success([], 'Task marked as done successfully.');
                
            } catch (Throwable $e) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task done process fail due to exceptional throwable : '. $e->getMessage());
                    return $this->response_failed('Task done process fail due to exceptional throwable : ' . $e->getMessage());
                }
                sleep(1);

            } catch (\Exception $f) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task done fail due to exceptional : '. $f->getMessage());
                    return $this->response_failed('Task done fail due to exceptional : ' . $f->getMessage());
                }
                sleep(1);
            }
        }
    }

    public function marked_as_fallback(Request $request)
    {
        if (!$request->user()->can('manage_task')) {
            return $this->response_failed('You do not have permission to perform this action.', 403);
        }

        $user = $request->user();

        if (!$user) {
            return $this->response_failed('Unauthenticated.', 401);
        }

        $retryCount = 0;
        $maxRetries = 3;

        while ($retryCount < $maxRetries) {
            try {
                DB::beginTransaction();
                
                $validatedData = $request->all();   

                $task    = Tasks::where('id',$validatedData['task_id'])->lockForUpdate()->first();
                $param_b = Tasks::with('lead','users.user')->findOrFail($task->id);

                $task->status       = 2;
                $task->done_date    = NULL;
                $task->onhold_date  = NULL;
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
                $history->updated_by        = $user->id;
                $history->before_status     = $param_b->status;
                $history->after_status      = $param_a->status;
                $history->content_before    = serialize($data['before']);
                $history->content_after     = serialize($data['after']);
                $history->remark            = $validatedData['special_remark'] ?? null;
                $history->save();

                $runJob = (new FirebaseNotification($task->id, 'task', '8'));
                dispatch($runJob);

                DB::commit();

                return $this->response_success([], 'Task marked as fallback successfully.');
                
            } catch (Throwable $e) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task fallback process fail due to exceptional throwable : '. $e->getMessage());
                    return $this->response_failed('Task fallback process fail due to exceptional throwable : ' . $e->getMessage());
                }
                sleep(1);

            } catch (\Exception $f) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task fallback fail due to exceptional : '. $f->getMessage());
                    return $this->response_failed('Task fallback fail due to exceptional : ' . $f->getMessage());
                }
                sleep(1);
            }
        }
    }

    public function marked_as_verified(Request $request)
    {
        if (!$request->user()->can('manage_task')) {
            return $this->response_failed('You do not have permission to perform this action.', 403);
        }

        $user = $request->user();

        if (!$user) {
            return $this->response_failed('Unauthenticated.', 401);
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
                $history->updated_by        = $user->id;
                $history->before_status     = $param_b->status;
                $history->after_status      = $param_a->status;
                $history->content_before    = serialize($data['before']);
                $history->content_after     = serialize($data['after']);
                $history->remark            = $validatedData['special_remark'] ?? null;
                $history->save();

                $runJob = (new FirebaseNotification($task->id, 'task', '4'));
                dispatch($runJob);

                DB::commit();

                return $this->response_success([], 'Task marked as verified successfully.');
                
            } catch (Throwable $e) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task verified process fail due to exceptional throwable : '. $e->getMessage());
                    return $this->response_failed('Task verified process fail due to exceptional throwable : ' . $e->getMessage());
                }
                sleep(1);

            } catch (\Exception $f) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task verified fail due to exceptional : '. $f->getMessage());
                    return $this->response_failed('Task verified fail due to exceptional : ' . $f->getMessage());
                }
                sleep(1);
            }
        }
    }

    public function marked_as_completed(Request $request)
    {
        if (!$request->user()->can('manage_task')) {
            return $this->response_failed('You do not have permission to perform this action.', 403);
        }

        $user = $request->user();

        if (!$user) {
            return $this->response_failed('Unauthenticated.', 401);
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
                $history->updated_by        = $user->id;
                $history->before_status     = $param_b->status;
                $history->after_status      = $param_a->status;
                $history->content_before    = serialize($data['before']);
                $history->content_after     = serialize($data['after']);
                $history->remark            = $validatedData['special_remark'] ?? null;
                $history->save();

                $runJob = (new FirebaseNotification($task->id, 'task', '5'));
                dispatch($runJob);

                DB::commit();

                return $this->response_success([], 'Task marked as completed successfully.');
                
                
            } catch (Throwable $e) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task complete process fail due to exceptional throwable : '. $e->getMessage());
                    return $this->response_failed('Task complete process fail due to exceptional throwable : ' . $e->getMessage());
                }
                sleep(1);

            } catch (\Exception $f) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task complete fail due to exceptional : '. $f->getMessage());
                    return $this->response_failed('Task complete fail due to exceptional : ' . $f->getMessage());
                }
                sleep(1);
            }
        }
    }

    public function marked_as_kiv(Request $request)
    {
        if (!$request->user()->can('manage_task')) {
            return $this->response_failed('You do not have permission to perform this action.', 403);
        }

        $user = $request->user();

        if (!$user) {
            return $this->response_failed('Unauthenticated.', 401);
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
                $history->updated_by        = $user->id;
                $history->before_status     = $param_b->status;
                $history->after_status      = $param_a->status;
                $history->content_before    = serialize($data['before']);
                $history->content_after     = serialize($data['after']);
                $history->remark            = $validatedData['special_remark'] ?? null;
                $history->save();

                $runJob = (new FirebaseNotification($task->id, 'task', '6'));
                dispatch($runJob);

                DB::commit();

                return $this->response_success([], 'Task marked as completed successfully.');
                
            } catch (Throwable $e) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task kiv process fail due to exceptional throwable : '. $e->getMessage());
                    return $this->response_failed('Task kiv process fail due to exceptional throwable : ' . $e->getMessage());
                }
                sleep(1);

            } catch (\Exception $f) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task kiv fail due to exceptional : '. $f->getMessage());
                    return $this->response_failed('Task kiv fail due to exceptional : ' . $f->getMessage());
                }
                sleep(1);
            }
        }
    }

    public function marked_as_rejected(Request $request)
    {
        if (!$request->user()->can('manage_task')) {
            return $this->response_failed('You do not have permission to perform this action.', 403);
        }

        $user = $request->user();

        if (!$user) {
            return $this->response_failed('Unauthenticated.', 401);
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
                $history->updated_by        = $user->id;
                $history->before_status     = $param_b->status;
                $history->after_status      = $param_a->status;
                $history->content_before    = serialize($data['before']);
                $history->content_after     = serialize($data['after']);
                $history->remark            = $validatedData['special_remark'] ?? null;
                $history->save();

                $runJob = (new FirebaseNotification($task->id, 'task', '7'));
                dispatch($runJob);

                DB::commit();

                return $this->response_success([], 'Task marked as completed successfully.');
                
            } catch (Throwable $e) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task reject process fail due to exceptional throwable : '. $e->getMessage());
                    return $this->response_failed('Task reject process fail due to exceptional throwable : ' . $e->getMessage());
                }
                sleep(1);

            } catch (\Exception $f) {

                $retryCount++;
                if ($retryCount >= $maxRetries) {
                    DB::rollBack();
                    Log::info('Task reject fail due to exceptional : '. $f->getMessage());
                    return $this->response_failed('Task reject fail due to exceptional : ' . $f->getMessage());
                }
                sleep(1);
            }
        }
    }
    /**
     * Fields the mobile list and detail add to every task: the reference,
     * the outlet's shop name, the risk check the dashboard uses, and who
     * checks it. Open tasks only carry a risk; others read as on track.
     */
    private function mobileTaskExtras(Tasks $task, TaskRisk $riskCheck, Carbon $now): array
    {
        $assessment = in_array((int) $task->status, TaskRisk::OPEN_STATUSES, true)
            ? $riskCheck->assessTask($task, $now)
            : ['level' => TaskRisk::ON_TRACK, 'reason' => null, 'due_at' => TaskRisk::combine($task->due_date, $task->due_time, '23:59:59')];
        $checker = $task->users->firstWhere('role', 3);

        return [
            'reference'    => $task->task_reference,
            'outlet_name'  => optional($task->lead)->business_name ?: optional($task->lead)->name,
            'status_label' => Tasks::getTaskStatus($task->status),
            'risk'         => $assessment['level'],
            'risk_reason'  => $assessment['reason'],
            'due_at'       => optional($assessment['due_at'])->toDateTimeString(),
            'checker'      => optional(optional($checker)->user)->name,
            'checker_id'   => optional($checker)->user_id,
            'done_date'    => $task->done_date,
        ];
    }

    /**
     * Store files sent under $key as the task's own documents (not tied to a
     * message). Used when a task is added with a file, and for the photos a
     * rep adds when they mark a task as done.
     */
    private function upload(Request $request, $taskId, string $key = 'file'): void
    {
        if (!$request->hasFile($key)) {
            return;
        }

        $files = $request->file($key);
        if (!is_array($files)) {
            $files = [$files];
        }

        foreach ($files as $i => $file) {
            if (!$file->isValid()) {
                continue;
            }

            $sanitizedName = str_replace(' ', '_', pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME));
            $filename      = "{$sanitizedName}_{$taskId}-" . ($i + 1) . '-' . time() . ".{$file->extension()}";

            Storage::putFileAs("task/{$taskId}", new File($file), $filename);

            $documentUpload                  = new DocumentUpload();
            $documentUpload->lead_id         = null;
            $documentUpload->task_id         = $taskId;
            $documentUpload->task_comment_id = null;
            $documentUpload->upload_by       = $request->user()->id;
            $documentUpload->filename        = $filename;
            $documentUpload->size            = $file->getSize();
            $documentUpload->mime_type       = $file->getMimeType();
            $documentUpload->save();
        }
    }
}
