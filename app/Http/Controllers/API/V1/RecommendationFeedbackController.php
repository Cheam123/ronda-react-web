<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Controllers\Controller;
use App\Models\Leads;
use App\Models\RecommendationFeedback;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;

/**
 * What a rep did with a drink idea: JSON endpoint the outlet page calls with
 * axios. Anyone who can open the outlet can answer (a rep: their own outlets).
 */
class RecommendationFeedbackController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth');
    }

    public function store(Request $request, $id)
    {
        $user = Auth::guard('web')->user();
        abort_unless($user->can('view_lead'), 403);

        $lead = Leads::visibleTo($user)->findOrFail($id);

        RecommendationFeedback::record($lead, $user, $request->validate(self::rules()));

        return $this->response_success(RecommendationFeedback::answersFor($lead));
    }

    /** A drink, a status, and an optional reason for declining. Shared with the mobile endpoint. */
    public static function rules(): array
    {
        return [
            'recipe_id'    => 'required|integer|exists:recipes,id',
            'menu_scan_id' => 'nullable|integer',
            'status'       => ['required', Rule::in(RecommendationFeedback::CHOICES)],
            'reason'       => ['nullable', Rule::in(array_keys(RecommendationFeedback::REASONS))],
        ];
    }
}
