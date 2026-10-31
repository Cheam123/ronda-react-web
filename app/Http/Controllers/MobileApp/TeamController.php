<?php

namespace App\Http\Controllers\MobileApp;

use App\Http\Controllers\Controller;
use App\Http\Resources\Dashboard\DailyDigestResource;
use App\Http\Resources\Dashboard\DashboardSummaryResource;
use App\Models\DailyDigest;
use App\Models\IFEReport;
use App\Models\User;
use App\Services\DashboardService;
use App\Services\FormApprovalService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * The manager's Team tab: the same figures as the web's team dashboard
 * (DashboardService::summary(null)), the latest Morning Round-Up, and what
 * is waiting in Review. Managers and Admins only, like the web.
 */
class TeamController extends Controller
{
    /** How far back "new visit reports" reach on the Review tab. */
    public const RECENT_DAYS = 14;

    public function __construct(private DashboardService $dashboard, private FormApprovalService $approvals)
    {
    }

    public function index(Request $request)
    {
        $user = $request->user();
        if (!$user->seesAllRecords()) {
            return $this->response_failed('Only managers can see the team.');
        }

        try {
            $digest = DailyDigest::latestDigest();

            return $this->response_ok([
                'summary' => DashboardSummaryResource::make($this->dashboard->summary(null))->resolve(),
                // The card shows when it was written ("7:42 AM") and who wrote it.
                'digest'  => $digest ? DailyDigestResource::make($digest)->resolve() + [
                    'digest_date' => optional($digest->digest_date)->toDateString(),
                    'written_at'  => optional($digest->updated_at)->toDateTimeString(),
                ] : null,
                'review'  => $this->reviewCounts($user),
            ], 'Team retrieved successfully.');
        } catch (Throwable $e) {
            Log::error('Mobile team failed', ['error' => $e->getMessage(), 'user_id' => $user->id]);
            return $this->response_failed('Failed to retrieve the team.', $e->getMessage());
        }
    }

    /** One person's own work, the same figures the web shows a Field Rep. Their tasks come from GET tasks. */
    public function person(Request $request)
    {
        $user = $request->user();
        if (!$user->seesAllRecords()) {
            return $this->response_failed('Only managers can see the team.');
        }

        $person = User::find($request->input('userID'));
        if (!$person) {
            return $this->response_failed('We could not find this person.');
        }

        try {
            return $this->response_ok([
                'person'  => [
                    'id'     => $person->id,
                    'name'   => $person->name,
                    'email'  => $person->email,
                    'mobile' => $person->mobile,
                    'role'   => User::getUserType($person->type),
                ],
                'summary' => DashboardSummaryResource::make($this->dashboard->summary($person))->resolve(),
            ], 'Person retrieved successfully.');
        } catch (Throwable $e) {
            Log::error('Mobile team person failed', ['error' => $e->getMessage(), 'person_id' => $person->id]);
            return $this->response_failed('Failed to retrieve this person.', $e->getMessage());
        }
    }

    /** Forms waiting on this manager, and recent visit reports that are not a task yet. */
    private function reviewCounts(User $user): array
    {
        return [
            'forms'  => $this->approvals->pendingFor($user)->count(),
            'visits' => IFEReport::visibleTo($user)
                ->whereNull('task_id')
                ->where('created_at', '>=', now()->subDays(self::RECENT_DAYS)->startOfDay())
                ->count(),
        ];
    }
}
