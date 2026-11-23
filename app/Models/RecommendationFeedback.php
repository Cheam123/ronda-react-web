<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/**
 * What a rep did with one drink idea at an outlet. Rows are only ever added:
 * the newest per outlet and drink is its status, and the rest is the history.
 */
class RecommendationFeedback extends Model
{
    protected $table = 'recommendation_feedback';

    public const STATUSES = ['pitched', 'accepted', 'declined'];

    /** What a rep can send: a status, or "cleared" to take the last one back. */
    public const CHOICES = ['pitched', 'accepted', 'declined', 'cleared'];

    /** Why a drink idea was declined. Optional. */
    public const REASONS = [
        'too_expensive'       => 'Too expensive',
        'has_supplier'        => 'Already has a supplier',
        'not_on_menu'         => 'Not on their menu',
        'not_their_customers' => 'Not their customers',
        'other'               => 'Other',
    ];

    protected $fillable = [
        'lead_id', 'recipe_id', 'menu_scan_id', 'user_id', 'status', 'reason',
    ];

    /**
     * Saves one answer about a drink at an outlet.
     *
     * @param array{recipe_id: int, menu_scan_id?: ?int, status: string, reason?: ?string} $data validated input
     */
    public static function record(Leads $lead, User $user, array $data): self
    {
        // The menu scan the idea came from, when it is one of this outlet's.
        $scanId = !empty($data['menu_scan_id'])
            ? MenuScan::where('lead_id', $lead->id)->whereKey((int) $data['menu_scan_id'])->value('id')
            : null;

        return self::create([
            'lead_id'      => $lead->id,
            'recipe_id'    => (int) $data['recipe_id'],
            'menu_scan_id' => $scanId,
            'user_id'      => $user->id,
            'status'       => $data['status'],
            'reason'       => $data['status'] === 'declined' ? ($data['reason'] ?? null) : null,
        ]);
    }

    /**
     * The newest answer per drink at this outlet, with the reason given for a
     * decline. An answer that was taken back is left out.
     *
     * @return array{drink_feedback: array<int, string>, drink_reasons: array<int, string>}
     */
    public static function answersFor(Leads $lead): array
    {
        $feedback = [];
        $reasons  = [];

        foreach (self::latestDrinksByLead([$lead->id])[$lead->id] ?? [] as $recipeId => $row) {
            if ($row->status === 'cleared') {
                continue;
            }
            $feedback[$recipeId] = $row->status;
            if ($row->status === 'declined' && $row->reason !== null) {
                $reasons[$recipeId] = $row->reason;
            }
        }

        return ['drink_feedback' => $feedback, 'drink_reasons' => $reasons];
    }

    public function lead()
    {
        return $this->belongsTo(Leads::class, 'lead_id');
    }

    public function recipe()
    {
        return $this->belongsTo(Recipe::class, 'recipe_id');
    }

    /**
     * Newest answer per drink for the given outlets.
     *
     * @param int[]|null $leadIds null for every outlet
     * @return array<int, array<int, self>> lead id => recipe id => newest row
     */
    public static function latestDrinksByLead(?array $leadIds = null): array
    {
        $rows = self::query()
            ->when($leadIds !== null, fn ($query) => $query->whereIn('lead_id', $leadIds))
            ->orderBy('id')
            ->get(['id', 'lead_id', 'recipe_id', 'status', 'reason', 'created_at']);

        $latest = [];
        foreach ($rows as $row) {
            $latest[$row->lead_id][$row->recipe_id] = $row;
        }

        return $latest;
    }
}
