<?php

namespace Tests\Feature;

use App\Models\DailyDigest;
use App\Models\OutletRecommendation;
use App\Models\User;
use App\Services\AdminDashboardService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * What the team dashboard says about the Morning Round-Up's date and how it
 * writes times, and what the admin overview sends, including the scheduled
 * jobs that missed their run.
 *
 * Runs inside a transaction that is rolled back.
 */
class WebDashboardTest extends TestCase
{
    use DatabaseTransactions;

    public function test_an_old_round_up_says_it_is_not_todays(): void
    {
        DailyDigest::where('digest_date', '>=', now()->subDay()->toDateString())->delete();
        DailyDigest::create(['digest_date' => now()->subDay()->toDateString(), 'content' => 'Summary: yesterday.', 'source' => 'template']);

        $this->actingAs($this->manager())
            ->get('/index')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Index')
                ->where('digest.is_today', false));
    }

    public function test_todays_round_up_is_marked_as_today(): void
    {
        DailyDigest::where('digest_date', '>=', now()->toDateString())->delete();
        DailyDigest::create(['digest_date' => now()->toDateString(), 'content' => 'Summary: today.', 'source' => 'template']);

        $this->actingAs($this->manager())
            ->get('/index')
            ->assertInertia(fn (Assert $page) => $page->where('digest.is_today', true));
    }

    public function test_times_are_written_with_a_small_am_or_pm(): void
    {
        $this->actingAs($this->manager())
            ->get('/index')
            ->assertInertia(fn (Assert $page) => $page
                ->where('summary.time_label', fn ($label) => preg_match('/^\d{1,2}:\d{2} (am|pm)$/', $label) === 1));
    }

    public function test_the_admin_overview_sends_counts_not_the_people_and_automations_panels(): void
    {
        $this->actingAs($this->manager(User::TYPE_ADMIN))
            ->get('/index')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Dashboard/Admin')
                ->missing('summary.people')
                ->missing('summary.automations')
                ->has('summary.users', fn (Assert $users) => $users
                    ->whereType('active', 'integer')
                    ->whereType('unlinked', 'integer')
                    ->etc())
                ->where('summary.activity', fn ($activity) => count($activity) <= AdminDashboardService::ACTIVITY_LIMIT)
                ->has('summary.missed_jobs'));
    }

    public function test_a_round_up_missing_after_seven_is_a_missed_job(): void
    {
        $today = Carbon::today();
        DailyDigest::where('digest_date', '>=', $today->toDateString())->delete();

        $this->assertNotContains('digest', $this->missedJobs($today->copy()->setTime(6, 59)));
        $this->assertContains('digest', $this->missedJobs($today->copy()->setTime(7, 0)));

        DailyDigest::create(['digest_date' => $today->toDateString(), 'content' => 'Summary: today.', 'source' => 'template']);

        $this->assertNotContains('digest', $this->missedJobs($today->copy()->setTime(10, 0)));
    }

    public function test_suggested_orders_older_than_a_day_are_a_missed_job(): void
    {
        if (OutletRecommendation::doesntExist()) {
            $this->markTestSkipped('No suggested orders in this database.');
        }

        $now = Carbon::now();

        OutletRecommendation::query()->update(['computed_at' => $now->copy()->subDays(3)]);
        $this->assertContains('recommendations', $this->missedJobs($now));

        OutletRecommendation::query()->update(['computed_at' => $now->copy()->subHours(2)]);
        $this->assertNotContains('recommendations', $this->missedJobs($now));
    }

    /** @return string[] */
    private function missedJobs(Carbon $now): array
    {
        return array_column(app(AdminDashboardService::class)->summary($now)['missed_jobs'], 'job');
    }

    private function manager(int $type = User::TYPE_MANAGER): User
    {
        return User::withoutEvents(fn () => User::factory()->create(['type' => $type, 'status' => 1]));
    }
}
