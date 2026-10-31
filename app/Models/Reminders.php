<?php

namespace App\Models;

use App\Traits\Paginatable;
use EloquentFilter\Filterable;
use Illuminate\Support\Facades\Auth;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Reminders extends Model
{
    use HasFactory;

    protected $fillable = [
        'task_id',
        'user_id',
        'message',
        'notify',
        'reminder_date',
        'reminder_time',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'id')->withTrashed();
    }

    public function task()
    {
        return $this->belongsTo(Tasks::class, 'task_id', 'id');
    }
}
