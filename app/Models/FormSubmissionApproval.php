<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FormSubmissionApproval extends Model
{
    use HasFactory;

    protected $fillable = [
        'form_submission_id',
        'sequence',
        'iteration',
        'node_id',
        'node_type',
        'source_branch_id',
        'name',
        'approval_mode',
        'approver_ids',
        'field_permissions',
        'status',
        'actions',
        'acted_by',
        'acted_at',
        'remark',
    ];

    protected $casts = [
        'approver_ids'      => 'array',
        'field_permissions' => 'array',
        'actions'           => 'array',
        'acted_at'          => 'datetime',
    ];

    public function submission()
    {
        return $this->belongsTo(FormSubmission::class, 'form_submission_id');
    }

    public function actedBy()
    {
        return $this->belongsTo(User::class, 'acted_by');
    }

    public function isApprovalNode(): bool
    {
        return $this->node_type === 'approval';
    }

    public function isFillNode(): bool
    {
        return $this->node_type === 'fill';
    }

    /**
     * Blocking rows pause the chain until acted on (approvals and fill phases).
     */
    public function isBlockingNode(): bool
    {
        return in_array($this->node_type, ['approval', 'fill'], true);
    }

    public function hasApprover(int $userId): bool
    {
        return in_array($userId, array_map('intval', $this->approver_ids ?? []), true);
    }

    public function hasActed(int $userId): bool
    {
        return collect($this->actions ?? [])->contains(fn ($a) => (int) ($a['user_id'] ?? 0) === $userId);
    }
}
