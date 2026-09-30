<?php

namespace App\Models;

use App\Traits\Paginatable;
use EloquentFilter\Filterable;
use Illuminate\Support\Facades\Auth;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use betterapp\LaravelDbEncrypter\Traits\EncryptableDbAttribute;
use Carbon\Carbon;

class Tasks extends Model
{
    use HasFactory, Paginatable, Filterable;

    protected $perPage = 10;

    protected $fillable = [
        'id',
        'alert',
        'title',
        'invoice_no',
        'sales',
        'due_notify',
        'status',
        'lead_id',
        'task_reference',
        'appointment_date',
        'start_date',
        'start_time',
        'due_date',
        'due_time',
        'remark',
        'creation_date',
        'inprogress_date',
        'done_date',
        'verify_date',
        'complete_date',
        'reject_date',
        'kiv_date',
        'onhold_date',
        'at_risk_at',
        'created_at',
        'updated_at',
    ];

    protected $dates = [
        'at_risk_at',
        'appointment_date',
        'creation_date',
        'inprogress_date',
        'done_date',
        'verify_date',
        'complete_date',
        'reject_date',
        'kiv_date',
        'onhold_date',
    ];

    protected $appends = ['reminder_date_time','last_follow_up','has_unread_notification'];

    public function getReminderDateTimeAttribute()
    {
        // 1. Check if a user is authenticated via ANY guard (web or sanctum).
        //    If not, we cannot proceed, so we return null.
        if (!Auth::check()) {
            return null;
        }

        // 2. If a user is authenticated, Auth::user() will return the correct
        //    user instance, whether from the session or the Sanctum token.
        $user = Auth::user();

        // 3. The rest of your logic remains the same, using the retrieved user's ID.
        $record = $this->reminder() // Use the relationship method `reminder()` for querying
            ->where('user_id', $user->id)
            ->latest() // Cleaner way to do ->sortByDesc('created_at')->first()
            ->first();

        if ($record) {
            $d = Carbon::parse($record->reminder_date . ' ' . $record->reminder_time)->format('Y-m-d H:i:s');
            return $d;
        }

        return null;
    }

    public function getLastFollowUpAttribute()
    {
        $dates = [];
        array_push($dates, $this->creation_date);

        $record = $this->comments->sortByDesc('created_at')->first();
        if ($record) {
            array_push($dates, $record->created_at);
        }
        
        if ($this->inprogress_date) {
            array_push($dates, $this->inprogress_date);
        }

        // $histories = $this->histories->sortByDesc('created_at')->first();
        // if ($histories) {
        //     array_push($dates, $histories->created_at);
        // }
        
        return max($dates);
    }

    public function getHasUnreadNotificationAttribute()
    {

        if (!Auth::check()) {
            return null;
        }

        // 2. If a user is authenticated, Auth::user() will return the correct
        //    user instance, whether from the session or the Sanctum token.
        $user = Auth::user();

        return Notification::whereIn('notifiable_id', [$user->id])
                            ->where('content_type', 'App\Models\TaskComment')
                            ->whereIn('content_id', $this->comments->pluck('id')->toArray())
                            ->whereNull('read_at')
                            ->select('*')
                            ->orderBy('created_at', 'desc')
                            ->get();
    }

    /**
     * Admins and Managers see every task; a normal User sees the tasks they
     * take part in (creator, subscriber, checker, owner, viewer, sub-subscriber).
     */
    public function scopeVisibleTo($query, User $user)
    {
        if ($user->seesAllRecords()) {
            return $query;
        }

        return $query->whereHas('users', fn ($q) => $q->where('user_id', $user->id));
    }

    /**
     * Next task reference, e.g. T-20260927-0001. The running number lives in
     * general_settings (task_submit_cnt) and is reset daily by
     * ResetAppSubmitCount. Call inside a transaction: the row is locked.
     */
    public static function nextReference()
    {
        $counter = GeneralSetting::where('key', 'task_submit_cnt')->lockForUpdate()->firstOrFail();
        $counter->value = (int) $counter->value + 1;
        $counter->save();

        $date   = now()->format('Ymd');
        $number = str_pad($counter->value, 4, '0', STR_PAD_LEFT);

        return "T-{$date}-{$number}";
    }

    public function lead()
    {
        return $this->belongsTo(Leads::class, 'lead_id')->withTrashed();
    }

    public function users()
    {
        return $this->hasMany(TaskUsers::class, 'task_id', 'id');
    }

    public function rating()
    {
        return $this->hasMany(Rating::class, 'task_id', 'id');
    }

    public function reminder()
    {
        return $this->hasMany(Reminders::class, 'task_id', 'id');
    }

    public function comments()
    {
        return $this->hasMany(TaskComment::class, 'task_id', 'id');
    }

    public function histories()
    {
        return $this->hasMany(TaskHistory::class, 'task_id', 'id');
    }

    public function ifeReport()
    {
        return $this->hasMany(IFEReport::class, 'task_id', 'id');
    }

    public function documentUploads()
    {
        return $this->hasMany(DocumentUpload::class,'task_id','id');
    }

    public static function getTaskStatus($status)
    {
        switch ($status) {
            case 1:  return 'New Task'; break;
            case 2:  return 'In Progress'; break;
            case 3:  return 'Done'; break;
            case 4:  return 'Verified'; break;
            case 5:  return 'Completed'; break;
            case 6:  return 'KIV'; break;
            case 7:  return 'Rejected'; break;
            case 8:  return 'On Hold'; break;
        }
    }

    /**
     * Which "Mark as ..." actions $user may perform on this task.
     * Single source of truth for the mobile list + detail responses and the web
     * task pages' action menu (TaskStatusMenu).
     *
     * ROLE:
     *  1:creator
     *  2:subscriber
     *  3:checker
     *  4:owner
     *  5:viewer
     *  6:sub-subscriber
     */
    public function actionFlagsFor(User $user)
    {
        $hasRole = fn (array $roles) => $this->users->whereIn('role', $roles)->where('user_id', $user->id)->isNotEmpty();

        return [
            'can_accept_task'   => $this->status == 1 && $hasRole([2, 6]),
            // On Hold is hidden - the action is no longer offered, and everything that used to be
            // available while a task was On Hold (status 8) is now offered at In Progress (status 2).
            'can_hold_task'     => false,
            'can_done_task'     => $this->status == 2 && $hasRole([2, 6, 4]),
            'can_verify_task'   => $this->status == 3 && $hasRole([3, 4]),
            'can_fallback_task' => ($this->status == 3 && $hasRole([3, 4])) || ($this->status == 2 && $hasRole([4])),
            'can_complete_task' => $this->status == 4 && $hasRole([4]),
            'can_reject_task'   => $this->status == 2 && $hasRole([4]),
            'can_kiv_task'      => $this->status == 2 && $hasRole([4]),
        ];
    }

    public function getUserUnreadNotification($uid)
    {
        return $this->hasOne(Notification::class, 'content_id', 'id')->select('content_type','content_id','telegram_send_message_id','telegram_send_sticker_id','created_at')
                                                                     ->whereNull('read_at')
                                                                     ->where('content_type', 'App\Models\Tasks')
                                                                     ->where('notifiable_id', $uid)
                                                                     ->first();
    }
}
