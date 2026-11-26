<?php

namespace App\Models;

use App\Traits\Paginatable;
use Illuminate\Support\Facades\Auth;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class TaskComment extends Model
{
    use HasFactory, Paginatable;

    protected $perPage = 50;
    protected $table = 'task_comment';

    protected $fillable = [
        'task_id',
        'submit_by',
        'submit_date',
        'message',
        'created_at',
    ];

    protected $appends = ['formated_message','is_read'];

    public function getFormatedMessageAttribute()
    {
        $message = str_replace('<img', '<img style="width:50%; height:auto;" ', $this->message);
        return $message;
    }

    public function getIsReadAttribute()
    {
        return Notification::where('content_type', 'App\Models\TaskComment')
                            ->where('content_id', $this->id)
                            ->where('notifiable_id', Auth::user()->id)
                            ->where('notifiable_type', 'App\Models\User')
                            ->whereNull('read_at')
                            ->select('*')
                            ->first() ? false : true;
    }

    public function task()
    {
        return $this->belongsTo(Tasks::class, 'task_id', 'id');
    }

    public function submitBy()
    {
        return $this->belongsTo(User::class, 'submit_by')->withTrashed();
    }

    public function documentUploads()
    {
        return $this->hasMany(DocumentUpload::class, 'task_comment_id', 'id');
    }

    public function ifeReport()
    {
        return $this->belongsTo(IFEReport::class, 'ife_report_id', 'id');
    }
}
