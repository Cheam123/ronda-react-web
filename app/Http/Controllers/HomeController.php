<?php

namespace App\Http\Controllers;

use App\Http\Resources\Dashboard\AdminDashboardResource;
use App\Http\Resources\Dashboard\DailyDigestResource;
use App\Http\Resources\Dashboard\DashboardSummaryResource;
use App\Models\DailyDigest;
use App\Services\AdminDashboardService;
use App\Services\DailyDigestService;
use App\Services\DashboardService;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class HomeController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth');
    }

    public function index(Request $request)
    {
        return $this->dashboard($request);
    }

    public function root()
    {
        return $this->dashboard(new Request());
    }

    /**
     * Admins land on the organisation overview and can switch to the team
     * view (?view=team). Managers get the team dashboard (every task, the
     * team activity table, the AI digest); a Field Rep gets the same tiles
     * and chart for their own work.
     */
    private function dashboard(Request $request)
    {
        $user    = Auth::guard('web')->user();
        $isAdmin = $user->isAdmin();

        if ($isAdmin && $request->query('view') !== 'team') {
            return Inertia::render('Dashboard/Admin', [
                'summary'   => AdminDashboardResource::make(app(AdminDashboardService::class)->summary($user))->resolve(),
                'teamRisks' => app(DashboardService::class)->riskCounts(),
            ]);
        }

        $isTeam = $user->seesAllRecords();

        $summary = app(DashboardService::class)->summary($isTeam ? null : $user);
        $digest  = $isTeam ? DailyDigest::latestDigest() : null;

        return Inertia::render('Dashboard/Index', [
            'isTeam'       => $isTeam,
            'showViewTabs' => $isAdmin,
            'summary'      => DashboardSummaryResource::make($summary)->resolve(),
            'digest'       => $digest ? DailyDigestResource::make($digest)->resolve() : null,
            'digestStatus' => session('digest_status'),
            'risk'         => [
                'hours'   => (int) config('ife.risk.hours'),
                'percent' => (int) round(config('ife.risk.elapsed') * 100),
            ],
        ]);
    }

    /** "Regenerate" on the digest card: rewrite today's digest now. */
    public function regenerateDigest(DailyDigestService $digests)
    {
        if (!Auth::guard('web')->user()->seesAllRecords()) {
            abort(403);
        }

        $digest = $digests->generate();

        $message = $digest->source === 'bedrock'
            ? 'Morning Round-Up rewritten by Claude.'
            : 'Morning Round-Up rewritten from the template' . ($digest->error ? ' (Bedrock error: ' . $digest->error . ')' : ' (Bedrock not configured)') . '.';

        // Admins regenerate from the team view (/index?view=team); keep them there.
        return redirect()->to(Auth::guard('web')->user()->isAdmin() ? '/index?view=team' : '/index')
            ->with('digest_status', $message);
    }
}
