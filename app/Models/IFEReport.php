<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class IFEReport extends Model
{
    use HasFactory;

    protected $table = 'ife_report';

    protected $fillable = [
        'task_id',
        'lead_id',
        'created_by',
        'company_name',
        'nature_of_business',
        'status',
        'ife_area',
        'shop_name',
        'problem_description',
        'support_required',
        'support_description',
        'personal_remarks',
        'pic_name',
        'mobile_number',
        'other_mobile_numbers',
        'email',
        'next_followup_date',
        'next_followup_plan',
        'location',
        'created_at',
        'updated_at',
    ];

    public function documentUploads()
    {
        return $this->hasMany(IfeReportDocumentUpload::class, 'ife_report_id');
    }

    public function area()
    {
        return $this->belongsTo(IfeArea::class, 'ife_area');
    }

    public function task()
    {
        return $this->belongsTo(Tasks::class, 'task_id');
    }

    /** The outlet this visit was made at. */
    public function lead()
    {
        return $this->belongsTo(Leads::class, 'lead_id')->withTrashed();
    }

    public function taskComment()
    {
        return $this->hasOne(TaskComment::class, 'ife_report_id');
    }

    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Admins and Managers see every IFE report; a normal User sees their own.
     */
    public function scopeVisibleTo($query, User $user)
    {
        if ($user->seesAllRecords()) {
            return $query;
        }

        return $query->where('created_by', $user->id);
    }
}
