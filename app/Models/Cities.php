<?php

namespace App\Models;

use App\Traits\Paginatable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Cities extends Model
{
    use HasFactory, Paginatable;

    protected $fillable = [
        'state_id',
        'name',
    ];

    public function state()
    {
        return $this->belongsTo(States::class,'state_id','id');
    }
}
