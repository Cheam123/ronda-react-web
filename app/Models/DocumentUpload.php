<?php

namespace App\Models;

use App\Traits\Paginatable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Str;

class DocumentUpload extends Model
{
    use HasFactory, Paginatable;

    protected $fillable = [
        'task_id',
        'lead_id',
        'menu_scan_id',
        'task_comment_id',
        'filename',
        'original_name',
        'mime_type',
        'size',
        'upload_by',
        'created_at',
        'updated_at',
    ];

    public function task()
    {
        return $this->belongsTo(Tasks::class, 'task_id');
    }

    public function lead()
    {
        return $this->belongsTo(Leads::class, 'lead_id');
    }

    public function uploadBy()
    {
        return $this->belongsTo(User::class, 'upload_by')->withTrashed();
    }

    public function getDisplayNameAttribute()
    {
        return $this->original_name ?: $this->filename;
    }

    /**
     * Storage folder: task/{task_id} for task and chat files, lead/{lead_id}
     * for lead files.
     */
    public function getFilePathAttribute()
    {
        return $this->task_id ? "task/{$this->task_id}" : "lead/{$this->lead_id}";
    }

    public function getFileFullPathAttribute()
    {
        return config('app.aws_s3_path') .'/'. $this->file_path .'/'. $this->filename;
    }
}
