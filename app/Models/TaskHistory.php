<?php

namespace App\Models;

use App\Traits\Paginatable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class TaskHistory extends Model
{
    use HasFactory, Paginatable;

    protected $perPage = 50;
    protected $table = 'task_history';

    protected $fillable = [
        'task_id',
        'updated_by',
        'before_status',
        'after_status',
        'content_before',
        'content_after',
        'remark',
        'created_at',
    ];

    //Accessor
    protected $appends = ['before_data','after_data'];
    
    public function getBeforeDataAttribute() {

        if (isset($this->content_before)) {
            $data = @unserialize($this->content_before); // NOTE: use this to handle unserializable data

            if(!!$data) {
                $info = json_decode(json_encode((unserialize($this->content_before))), true);
            } else {
                $info = [];
            }
    
            return $info;

        } else {
            return [];
        }
        
    }

    public function getAfterDataAttribute() {

        if (isset($this->content_after)) {
            $data = @unserialize($this->content_after);

            if(!!$data) {
                $info = json_decode(json_encode((unserialize($this->content_after))), true);
            } else {
                $info = [];
            }
    
            return $info;

        } else {
            return [];
        }
    }

    public function task()
    {
        return $this->belongsTo(tasks::class);
    }

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by')->withTrashed();
    }
}
