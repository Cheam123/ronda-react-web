<?php

namespace App\Models;

use App\Traits\Paginatable;
use Illuminate\Support\Facades\Auth;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Rating extends Model
{
    use HasFactory, Paginatable;

    protected $perPage = 10;

    protected $table = 'rating';

    protected $fillable = [
        'task_id',
        'user_id',
        'task_creation_date',
        'rate',
        'comment',
        'editable'
    ];
}
