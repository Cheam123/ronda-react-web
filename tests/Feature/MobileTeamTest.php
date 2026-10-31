<?php

namespace Tests\Feature;

use App\Models\IFEReport;
use App\Models\Leads;
use App\Models\TaskComment;
use App\Models\Tasks;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Bus;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The manager's side of the app: the Team tab, one person, recent visit
 * reports for Review, and making a visit report a task.
 *
 * Runs inside a transaction that is rolled back; pushes are faked.
 */
class MobileTeamTest extends TestCase
{
    use DatabaseTransactions;

    private User $rep;
    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        Bus::fake();

        $this->rep     = $this->makeUser(User::TYPE_USER, 'Team Test Rep');
        $this->manager = $this->makeUser(User::TYPE_MANAGER, 'Team Test Manager');
    }

    public function test_only_managers_see_the_team(): void
    {
        Sanctum::actingAs($this->rep);
        $this->getJson('/api/mobile/team')->assertStatus(400);
        $this->getJson("/api/mobile/team/person?userID={$this->rep->id}")->assertStatus(400);

        Sanctum::actingAs($this->manager);
        $body = $this->getJson('/api/mobile/team')->assertOk()->json();

        $this->assertSame('team', $body['summary']['scope']);
        $this->assertContains($this->rep->id, array_column($body['summary']['team'], 'user_id'));
        $this->assertArrayHasKey('forms', $body['review']);
        $this->assertArrayHasKey('visits', $body['review']);

        $this->getJson("/api/mobile/team/person?userID={$this->rep->id}")
            ->assertOk()
            ->assertJsonPath('person.name', 'Team Test Rep')
            ->assertJsonPath('summary.scope', 'personal');
    }

    public function test_recent_visit_reports_for_review_and_for_me(): void
    {
        $lead   = $this->makeLead();
        $open   = $this->makeReport($lead, 'Grinder is old', 'Yes');
        $tasked = $this->makeReport($lead, 'Order taken', 'No');
        $tasked->forceFill(['task_id' => $this->makeTask($lead)->id])->save();

        Sanctum::actingAs($this->rep);
        $this->getJson('/api/mobile/ife/recent')->assertStatus(400);
        $mine = $this->getJson('/api/mobile/ife/recent?mine=1')->assertOk()->json('data');
        $this->assertEqualsCanonicalizing([$open->id, $tasked->id], array_column($mine, 'id'));

        Sanctum::actingAs($this->manager);
        $ids = array_column($this->getJson('/api/mobile/ife/recent?open=1&per_page=100')->assertOk()->json('data'), 'id');
        $this->assertContains($open->id, $ids);
        $this->assertNotContains($tasked->id, $ids, 'a report that is already a task is not offered again');

        // One person's visits, for their screen.
        $theirs = array_column($this->getJson("/api/mobile/ife/recent?created_by={$this->rep->id}&days=30")->assertOk()->json('data'), 'id');
        $this->assertEqualsCanonicalizing([$open->id, $tasked->id], $theirs);
    }

    public function test_a_manager_makes_a_visit_report_a_task(): void
    {
        $lead   = $this->makeLead();
        $report = $this->makeReport($lead, 'The grinder is old', 'Yes');

        // A rep cannot convert one, even their own.
        Sanctum::actingAs($this->rep);
        $this->postJson('/api/mobile/tasks/create', $this->taskFields($lead, $report))->assertStatus(400);

        Sanctum::actingAs($this->manager);
        $taskId = $this->postJson('/api/mobile/tasks/create', $this->taskFields($lead, $report))
            ->assertOk()
            ->json('data.id');

        $report->refresh();
        $this->assertSame($taskId, (int) $report->task_id);
        $this->assertTrue(TaskComment::where('task_id', $taskId)->where('ife_report_id', $report->id)->exists());

        // Once is enough.
        $this->postJson('/api/mobile/tasks/create', $this->taskFields($lead, $report))
            ->assertStatus(400)
            ->assertJsonPath('message', 'This visit report is already a task.');
    }

    private function taskFields(Leads $lead, IFEReport $report): array
    {
        return [
            'title'           => 'Check the grinder before the trial',
            'lead_id'         => $lead->id,
            'subscriber'      => $this->rep->id,
            'owner'           => [$this->manager->id],
            'task_start_date' => now()->toDateString(),
            'task_start_time' => '09:00:00',
            'task_due_date'   => now()->addDays(2)->toDateString(),
            'task_due_time'   => '17:00:00',
            'ife_report_id'   => $report->id,
        ];
    }

    private function makeUser(int $type, string $name): User
    {
        return User::withoutEvents(fn () => User::factory()->create(['name' => $name, 'type' => $type, 'status' => 1]));
    }

    private function makeLead(): Leads
    {
        return Leads::create([
            'name'          => 'Team Test Cafe Sdn Bhd',
            'business_name' => 'Team Test Cafe',
            'belong_to'     => $this->rep->id,
            'assign_to'     => $this->rep->id,
        ]);
    }

    private function makeTask(Leads $lead): Tasks
    {
        $task = new Tasks();
        $task->status         = 2;
        $task->lead_id        = $lead->id;
        $task->task_reference = 'T-TEAM-' . uniqid();
        $task->title          = 'Made from a visit';
        $task->start_date     = now()->toDateString();
        $task->start_time     = '09:00:00';
        $task->due_date       = now()->addDay()->toDateString();
        $task->due_time       = '17:00:00';
        $task->creation_date  = now();
        $task->save();

        return $task;
    }

    private function makeReport(Leads $lead, string $what, string $support): IFEReport
    {
        return IFEReport::create([
            'created_by'          => $this->rep->id,
            'lead_id'             => $lead->id,
            'shop_name'           => $lead->business_name,
            'company_name'        => $lead->name,
            'problem_description' => $what,
            'support_required'    => $support,
        ]);
    }
}
