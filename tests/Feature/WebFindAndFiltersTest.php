<?php

namespace Tests\Feature;

use App\Models\Leads;
use App\Models\Tasks;
use App\Models\TaskUsers;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Bus;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * The top bar's quick find, the Due today task filter, the admin to-dos'
 * filtered lists, and who may open the Telegram chat ID page.
 *
 * Runs inside a transaction that is rolled back. Every outlet and task carries
 * a marker only this test uses, and every request searches for it.
 */
class WebFindAndFiltersTest extends TestCase
{
    use DatabaseTransactions;

    private User $rep;
    private User $otherRep;
    private User $manager;
    private User $admin;
    private string $marker;

    protected function setUp(): void
    {
        parent::setUp();

        Bus::fake();

        $this->rep      = $this->makeUser(User::TYPE_USER, 'Find Rep');
        $this->otherRep = $this->makeUser(User::TYPE_USER, 'Other Find Rep');
        $this->manager  = $this->makeUser(User::TYPE_MANAGER, 'Find Manager');
        $this->admin    = $this->makeUser(User::TYPE_ADMIN, 'Find Admin');
        $this->marker   = 'FINDTEST' . uniqid();
    }

    public function test_quick_find_returns_outlets_and_tasks_the_user_may_open(): void
    {
        $mine   = $this->makeOutlet($this->rep, $this->marker . ' Kopi');
        $theirs = $this->makeOutlet($this->otherRep, $this->marker . ' Teh');
        $task   = $this->makeTask($mine, 2, now()->addDays(3));

        $found = $this->actingAs($this->manager)
            ->getJson(route('search', ['q' => $this->marker]))
            ->assertOk()
            ->json();

        $this->assertEqualsCanonicalizing([$mine->id, $theirs->id], array_column($found['outlets'], 'id'));
        $this->assertSame([$task->id], array_column($found['tasks'], 'id'));
        $this->assertStringContainsString('In progress', $found['tasks'][0]['sub']);

        // A rep finds only the outlets they own or are assigned.
        $repFound = $this->actingAs($this->rep)->getJson(route('search', ['q' => $this->marker]))->json();
        $this->assertSame([$mine->id], array_column($repFound['outlets'], 'id'));
    }

    public function test_quick_find_waits_for_two_letters(): void
    {
        $this->actingAs($this->manager)
            ->getJson(route('search', ['q' => 'a']))
            ->assertOk()
            ->assertExactJson(['outlets' => [], 'tasks' => []]);
    }

    public function test_due_today_filters_the_open_tab_and_is_counted(): void
    {
        $outlet  = $this->makeOutlet($this->rep, $this->marker);
        $today   = $this->makeTask($outlet, 2, now()->endOfDay()->subMinute());
        $this->makeTask($outlet, 1, now()->addDays(5));

        $this->actingAs($this->manager)
            ->get(route('tasks.index2', ['status' => 'open', 'due' => 'today', 'search' => $this->marker]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('tasks.data', fn ($rows) => collect($rows)->pluck('id')->all() === [$today->id])
                ->where('riskCounts.due_today', 1));
    }

    public function test_the_outlet_list_can_show_outlets_without_an_ife_area(): void
    {
        $without = $this->makeOutlet($this->rep, $this->marker . ' No Area');
        $with    = $this->makeOutlet($this->rep, $this->marker . ' Has Area');
        $with->ife_area_id = \App\Models\IfeArea::query()->value('id');
        $with->save();

        $this->actingAs($this->admin)
            ->get(route('lead.index', ['ifearea' => 'none', 'search' => $this->marker]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('leads.data', fn ($rows) => collect($rows)->pluck('id')->all() === ($with->ife_area_id ? [$without->id] : collect([$without->id, $with->id])->sortDesc()->values()->all())));
    }

    public function test_the_user_list_can_show_people_without_telegram(): void
    {
        $linked = $this->makeUser(User::TYPE_USER, $this->marker . ' Linked');
        $linked->telegram_chat_id = '123456';
        $linked->save();
        $unlinked = $this->makeUser(User::TYPE_USER, $this->marker . ' Unlinked');

        $this->actingAs($this->admin)
            ->get(route('users.index', ['telegram' => 'none', 'search' => $this->marker]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('users', fn ($rows) => collect($rows)->pluck('id')->all() === [$unlinked->id]));
    }

    public function test_only_people_who_manage_users_see_telegram_chat_ids(): void
    {
        $this->actingAs($this->rep)
            ->get(route('setting.telegram_message'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Errors/CustomError'));
    }

    private function makeUser(int $type, string $name): User
    {
        return User::withoutEvents(fn () => User::factory()->create([
            'name'   => $name,
            'type'   => $type,
            'status' => 1,
        ]));
    }

    private function makeOutlet(User $owner, string $shop): Leads
    {
        return Leads::create(['name' => 'Find Test Company', 'business_name' => $shop, 'customer_id' => 'C-' . uniqid(), 'belong_to' => $owner->id]);
    }

    /** A task on the outlet carrying the marker: its owner does it, the manager checks and owns it. */
    private function makeTask(Leads $outlet, int $status, $due): Tasks
    {
        $task = new Tasks();
        $task->status         = $status;
        $task->lead_id        = $outlet->id;
        $task->task_reference = 'T-FIND-' . uniqid();
        $task->title          = $this->marker . ' task';
        $task->start_date     = now()->subDays(3)->toDateString();
        $task->start_time     = '09:00:00';
        $task->due_date       = $due->toDateString();
        $task->due_time       = $due->format('H:i:s');
        $task->creation_date  = now()->subDays(3);
        $task->save();

        foreach ([[1, $this->manager], [2, User::find($outlet->belong_to)], [3, $this->manager], [4, $this->manager]] as [$role, $user]) {
            TaskUsers::create(['task_id' => $task->id, 'user_id' => $user->id, 'role' => $role]);
        }

        return $task;
    }
}
