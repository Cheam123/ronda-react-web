<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Controllers\Controller;
use App\Models\Leads;
use App\Services\Ai\OutletAssistantService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use InvalidArgumentException;
use Throwable;

/**
 * The rep assistant on the outlet page: JSON endpoints the page calls with
 * axios. Anyone who can open the outlet can use it (a rep: their own
 * outlets). Claude can take a while, so each call gets two minutes.
 */
class OutletAssistantController extends Controller
{
    private const UNAVAILABLE = 'Ask Ronda needs Claude on Amazon Bedrock, which is not set up yet. An admin can turn it on.';
    private const FAILED      = 'Ronda could not answer just now. Please try again.';

    public function __construct(private OutletAssistantService $assistant)
    {
        $this->middleware('auth');
    }

    /** "Write a visit brief" / "Update": writes the brief again. */
    public function brief($id)
    {
        $lead = $this->outlet($id);
        set_time_limit(120);

        $brief = $this->assistant->brief($lead, Auth::guard('web')->user());

        return $this->response_success($this->assistant->briefResource($brief));
    }

    /** One answer in the Ask Ronda chat; the page sends the whole chat. */
    public function chat(Request $request, $id)
    {
        $lead = $this->outlet($id);

        if (!$this->assistant->isAvailable()) {
            return response()->json(['status' => 'error', 'message' => self::UNAVAILABLE], 503);
        }

        $request->validate(['messages' => ['required', 'array', 'max:' . OutletAssistantService::MAX_TURNS]]);
        set_time_limit(120);

        try {
            $answer = $this->assistant->chat($lead, Auth::guard('web')->user(), $request->input('messages'));
        } catch (InvalidArgumentException $e) {
            return $this->response_failed($e->getMessage());
        } catch (Throwable $e) {
            Log::warning('Ask Ronda failed', ['lead_id' => $lead->id, 'error' => $e->getMessage()]);

            return response()->json(['status' => 'error', 'message' => self::FAILED], 503);
        }

        return $this->response_success($answer);
    }

    /** A follow-up message draft in English or Bahasa Melayu. */
    public function followUp(Request $request, $id)
    {
        $lead = $this->outlet($id);
        $data = $request->validate([
            'language' => ['required', Rule::in(array_keys(OutletAssistantService::LANGUAGES))],
            'topic'    => ['required', Rule::in(OutletAssistantService::TOPICS)],
            'note'     => ['nullable', 'string', 'max:300'],
        ]);
        set_time_limit(120);

        return $this->response_success($this->assistant->followUp(
            $lead,
            Auth::guard('web')->user(),
            $data['language'],
            $data['topic'],
            $data['note'] ?? null
        ));
    }

    /** "How to pitch" tips for every suggested product at once. */
    public function pitches($id)
    {
        $lead = $this->outlet($id);
        set_time_limit(120);

        return $this->response_success($this->assistant->pitches($lead));
    }

    /** The outlet, if the signed-in user may open it (404 otherwise, as the page). */
    private function outlet($id): Leads
    {
        $user = Auth::guard('web')->user();
        abort_unless($user->can('view_lead'), 403);

        return Leads::visibleTo($user)->findOrFail($id);
    }
}
