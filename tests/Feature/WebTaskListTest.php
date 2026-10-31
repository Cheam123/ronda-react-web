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
 * The web task list's Open tab and its Overdue / At risk filters, "New task"
 * started without an outlet, and the task page naming everyone on a task.
 *
 * Runs inside a transaction that is rolled back. The tasks get a title only
 * they carry, and every request searches for it, so other rows in the
 * database never land on the page.
 */
class WebTaskListTest extends TestCase
{
    use DatabaseTransactions;

    private User $rep;
    private User $manager;
    private string $marker;

    protected function setUp(): void
    {
        parent::setUp();

        Bus::fake();

        $this->rep     = $this->makeUser(User::TYPE_USER, 'Test Rep');
        $this->manager = $this->makeUser(User::TYPE_MANAGER, 'Test Manager');
        $this->marker  = 'WEBLIST-' . uniqid();
    }

    public function test_the_list_opens_on_new_and_in_progress_together(): void
    {
        $new        = $this->makeTask(1, now()->addDays(10));
        $inProgress = $this->makeTask(2, now()->addDays(10));
        $done       = $this->makeTask(3, now()->addDays(10));

        $this->actingAs($this->manager)
            ->get(route('tasks.index2', ['search' => $this->marker]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Tasks/Index')
                ->where('filters.status', 'open')
                ->where('tasks.data', fn ($rows) => collect($rows)->pluck('id')->sort()->values()->all() === collect([$new->id, $inProgress->id])->sort()->values()->all())
                ->where('statusCounts.3', 1));

        $this->assertNotNull($done->id);
    }

    public function test_overdue_and_at_risk_filter_the_open_tab_and_are_counted(): void
    {
        $overdue = $this->makeTask(2, now()->subDay());
        $atRisk  = $this->makeTask(2, now()->addHours(5));
        $this->makeTask(1, now()->addDays(10), now()->subDay());

        $this->actingAs($this->manager)
            ->get(route('tasks.index2', ['status' => 'open', 'risk' => 'overdue', 'search' => $this->marker]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('tasks.data', fn ($rows) => collect($rows)->pluck('id')->all() === [$overdue->id])
                ->where('riskCounts.overdue', 1)
                ->where('riskCounts.at_risk', 1));

        $this->actingAs($this->manager)
            ->get(route('tasks.index2', ['status' => 'open', 'risk' => 'at_risk', 'search' => $this->marker]))
            ->assertInertia(fn (Assert $page) => $page
                ->where('tasks.data', fn ($rows) => collect($rows)->pluck('id')->all() === [$atRisk->id]));
    }

    public function test_a_risk_filter_is_ignored_off_the_open_statuses(): void
    {
        $done = $this->makeTask(3, now()->subDay());

        $this->actingAs($this->manager)
            ->get(route('tasks.index2', ['status' => 3, 'risk' => 'overdue', 'search' => $this->marker]))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('tasks.data', fn ($rows) => collect($rows)->pluck('id')->all() === [$done->id]));
    }

    public function test_new_task_without_an_outlet_asks_for_one_first(): void
    {
        $prospect = Leads::create(['name' => 'Busy Prospect Co', 'business_name' => $this->marker, 'belong_to' => $this->rep->id]);
        $this->makeTask(2, now()->addDays(3), null, $prospect);

        $this->actingAs($this->manager)
            ->get(route('tasks.create'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Tasks/ChooseOutlet')
                ->where('outlets', function ($outlets) use ($prospect) {
                    $row = collect($outlets)->firstWhere('value', $prospect->id);

                    // A prospect with a running task can't take another, so it is offered greyed out.
                    return $row !== null && $row['disabled'] === true && $row['label'] === $this->marker;
                }));
    }

    public function test_the_task_page_names_owners_the_people_list_leaves_out(): void
    {
        $task  = $this->makeTask(2, now()->addDays(3));
        $admin = $this->makeUser(User::TYPE_ADMIN, 'Test Admin Owner');
        TaskUsers::create(['task_id' => $task->id, 'user_id' => $admin->id, 'role' => 4]);

        // Admins can't be picked in the people list, so the page needs their name from the task itself.
        $this->actingAs($this->manager)
            ->get(route('tasks.view', $task->id))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->component('Tasks/Show')
                ->where('task.people.owner_names', fn ($names) => collect($names)->sort()->values()->all() === ['Test Admin Owner', 'Test Manager'])
                ->where('task.people.sub_subscriber_names', [])
                ->missing('people'));
    }

    private function makeUser(int $type, string $name): User
    {
        return User::withoutEvents(fn () => User::factory()->create([
            'name'   => $name,
            'type'   => $type,
            'status' => 1,
        ]));
    }

    /** A task carrying this test's marker: the rep does it, the manager checks and owns it. */
    private function makeTask(int $status, $due, $start = null, ?Leads $lead = null): Tasks
    {
        $lead ??= Leads::create(['name' => 'Test Company', 'business_name' => 'Test Shop', 'customer_id' => 'C-' . uniqid(), 'belong_to' => $this->rep->id]);

        $task = new Tasks();
        $task->status         = $status;
        $task->lead_id        = $lead->id;
        $task->task_reference = 'T-TEST-' . uniqid();
        $task->title          = $this->marker . ' task';
        $task->start_date     = ($start ?? now()->subDays(3))->toDateString();
        $task->start_time     = ($start ?? now()->subDays(3))->format('H:i:s');
        $task->due_date       = $due->toDateString();
        $task->due_time       = $due->format('H:i:s');
        $task->creation_date  = now()->subDays(3);
        $task->save();

        foreach ([[1, $this->manager], [2, $this->rep], [3, $this->manager], [4, $this->manager]] as [$role, $user]) {
            TaskUsers::create(['task_id' => $task->id, 'user_id' => $user->id, 'role' => $role]);
        }

        return $task;
    }
}
