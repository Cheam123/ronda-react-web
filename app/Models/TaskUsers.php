<?php

namespace App\Models;

use App\Traits\Paginatable;
use EloquentFilter\Filterable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class TaskUsers extends Model
{
    use HasFactory;

    public $timestamps = false;
    
    protected $perPage = 10;
    protected $table = 'task_users';

    protected $fillable = [
        'task_id',
        'user_id',
        'role'
    ];

    public function user()
    {
        return $this->belongsTo(User::class,'user_id','id')->withTrashed();
    }

    /**
     * ROLE:
     *  1:creator
     *  2:subscriber
     *  3:checker
     *  4:owner
     *  5:viewer
     *  6:sub-subscriber 
     */
}
