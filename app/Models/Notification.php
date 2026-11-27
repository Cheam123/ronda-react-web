<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $table = 'notifications';
    protected $primaryKey = 'id';

    protected $fillable = [
        'id',
        'type',
        'notifiable_type',
        'notifiable_id',
        'data',
        'read_at',
        'content_id',
        'content_type'
    ];

    public function notifiable()
    {
        return $this->morphTo();
    }

    public function content()
    {
        return $this->morphTo();
    }
}
