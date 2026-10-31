<?php

namespace App\Http\Controllers\MobileApp;

use App\Http\Controllers\Controller;
use App\Models\Leads;
use App\Services\Ai\OutletAssistantService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;
use InvalidArgumentException;
use Throwable;

/**
 * The outlet assistant for the mobile app: the same service as the web's
 * API\V1\OutletAssistantController, behind Sanctum instead of the session.
 * Anyone who can see the outlet can use it (a rep: their own outlets).
 */
class OutletAssistantController extends Controller
{
    private const UNAVAILABLE = 'Ask Ronda needs Claude on Amazon Bedrock, which is not set up yet. An admin can turn it on.';
    private const FAILED      = 'Ronda could not answer just now. Please try again.';

    public function __construct(private OutletAssistantService $assistant)
    {
    }

    /** The last visit brief written for the outlet, or null when there is none. */
    public function showBrief(Request $request, $id)
    {
        $lead = $this->outlet($request, $id);
        if (!$lead) {
            return $this->response_failed('We could not find this outlet.');
        }

        return $this->response_success([
            'brief'     => $this->assistant->briefPayload($lead),
            'available' => $this->assistant->isAvailable(),
        ]);
    }

    /** "Update": write the brief again. */
    public function brief(Request $request, $id)
    {
        $lead = $this->outlet($request, $id);
        if (!$lead) {
            return $this->response_failed('We could not find this outlet.');
        }
        set_time_limit(120);

        $brief = $this->assistant->brief($lead, $request->user());

        return $this->response_success(['brief' => $this->assistant->briefResource($brief)]);
    }

    /** One answer in the Ask Ronda chat; the app sends the whole chat. */
    public function chat(Request $request, $id)
    {
        $lead = $this->outlet($request, $id);
        if (!$lead) {
            return $this->response_failed('We could not find this outlet.');
        }

        if (!$this->assistant->isAvailable()) {
            return response()->json(['status' => 'error', 'message' => self::UNAVAILABLE], 503);
        }

        $request->validate(['messages' => ['required', 'array', 'max:' . OutletAssistantService::MAX_TURNS]]);
        set_time_limit(120);

        try {
            $answer = $this->assistant->chat($lead, $request->user(), $request->input('messages'));
        } catch (InvalidArgumentException $e) {
            return $this->response_failed($e->getMessage());
        } catch (Throwable $e) {
            Log::warning('Ask Ronda (mobile) failed', ['lead_id' => $lead->id, 'error' => $e->getMessage()]);

            return response()->json(['status' => 'error', 'message' => self::FAILED], 503);
        }

        return $this->response_success($answer);
    }

    /** A follow-up message draft in English or Bahasa Melayu. */
    public function followUp(Request $request, $id)
    {
        $lead = $this->outlet($request, $id);
        if (!$lead) {
            return $this->response_failed('We could not find this outlet.');
        }

        $data = $request->validate([
            'language' => ['required', Rule::in(array_keys(OutletAssistantService::LANGUAGES))],
            'topic'    => ['required', Rule::in(OutletAssistantService::TOPICS)],
            'note'     => ['nullable', 'string', 'max:300'],
        ]);
        set_time_limit(120);

        return $this->response_success($this->assistant->followUp(
            $lead,
            $request->user(),
            $data['language'],
            $data['topic'],
            $data['note'] ?? null
        ));
    }

    /** "How to pitch" tips for every suggested product at once. */
    public function pitches(Request $request, $id)
    {
        $lead = $this->outlet($request, $id);
        if (!$lead) {
            return $this->response_failed('We could not find this outlet.');
        }
        set_time_limit(120);

        return $this->response_success($this->assistant->pitches($lead));
    }

    /** The outlet, if the caller may open it. */
    private function outlet(Request $request, $id): ?Leads
    {
        $user = $request->user();
        if (!$user->can('view_lead')) {
            return null;
        }

        return Leads::visibleTo($user)->find($id);
    }
}
