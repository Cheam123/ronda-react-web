<?php

namespace Tests\Feature;

use App\Models\IFEReport;
use App\Models\Leads;
use App\Models\Tasks;
use App\Models\TaskUsers;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Bus;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The mobile outlet endpoints: the list with its open work, the assistant
 * behind Sanctum, and visit reports filed from a task.
 *
 * Runs inside a transaction that is rolled back; pushes are faked.
 */
class MobileOutletsTest extends TestCase
{
    use DatabaseTransactions;

    private User $rep;
    private User $otherRep;
    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        Bus::fake();
        // Claude stays off: the assistant falls back to its templates.
        config(['ife.bedrock.enabled' => false]);

        $this->rep      = $this->makeUser(User::TYPE_USER, 'Test Rep');
        $this->otherRep = $this->makeUser(User::TYPE_USER, 'Other Rep');
        $this->manager  = $this->makeUser(User::TYPE_MANAGER, 'Test Manager');
    }

    public function test_outlets_list_puts_open_work_first_with_counts(): void
    {
        $quiet   = $this->makeLead($this->rep, 'Aaa Quiet Cafe', 'C-1');
        $overdue = $this->makeLead($this->rep, 'Zzz Busy Cafe', null);
        $this->makeTask($overdue, $this->rep, now()->subDays(2));

        Sanctum::actingAs($this->rep);
        $body = $this->getJson('/api/mobile/leads?sort=open_work&per_page=50&search=Cafe')->assertOk()->json();

        $ids = array_column($body['leads'], 'id');
        $this->assertSame([$overdue->id, $quiet->id], $ids, 'the outlet with an overdue task comes first');

        $first = $body['leads'][0];
        $this->assertSame('prospect', $first['kind']);
        $this->assertSame(1, $first['open_tasks']);
        $this->assertSame(1, $first['overdue']);
        $this->assertSame('customer', $body['leads'][1]['kind']);
        $this->assertSame(['all' => 2, 'customer' => 1, 'prospect' => 1, 'suggested' => 0], $body['counts']);

        $this->getJson('/api/mobile/leads?kind=customer&search=Cafe')
            ->assertOk()
            ->assertJsonPath('leads.0.id', $quiet->id)
            ->assertJsonCount(1, 'leads');
    }

    public function test_the_assistant_only_answers_about_outlets_the_caller_can_see(): void
    {
        $mine   = $this->makeLead($this->rep, 'My Cafe', null);
        $theirs = $this->makeLead($this->otherRep, 'Their Cafe', null);

        Sanctum::actingAs($this->rep);
        $this->getJson("/api/mobile/leads/{$theirs->id}/assistant/brief")->assertStatus(400);
        $this->getJson("/api/mobile/leads/{$mine->id}/assistant/brief")
            ->assertOk()
            ->assertJsonPath('data.brief', null);

        // Without Bedrock the brief is written from the template.
        $this->postJson("/api/mobile/leads/{$mine->id}/assistant/brief")
            ->assertOk()
            ->assertJsonPath('data.brief.source', 'template');
    }

    public function test_a_visit_logged_from_a_task_is_linked_to_it_and_its_outlet(): void
    {
        $lead = $this->makeLead($this->rep, 'Visit Cafe', 'C-9');
        $task = $this->makeTask($lead, $this->rep, now()->addDay());

        Sanctum::actingAs($this->rep);
        $id = $this->postJson('/api/mobile/ife/create', [
            'task_id'             => $task->id,
            'problem_description' => 'Collected the payment.',
            'support_required'    => 'No',
            'next_followup_date'  => now()->addWeek()->toDateString(),
            'next_followup_plan'  => 'Bring a sample.',
            'location'            => 'Stamped 3.11803, 101.62402 (±12 m)',
        ])->assertOk()->json('id');

        $report = IFEReport::findOrFail($id);
        $this->assertSame($task->id, (int) $report->task_id);
        $this->assertSame($lead->id, (int) $report->lead_id);
        $this->assertNull($report->pic_name);
    }

    public function test_a_rep_cannot_log_a_visit_against_someone_elses_task(): void
    {
        $lead = $this->makeLead($this->otherRep, 'Not Mine', null);
        $task = $this->makeTask($lead, $this->otherRep, now()->addDay());

        Sanctum::actingAs($this->rep);
        $this->postJson('/api/mobile/ife/create', [
            'task_id'             => $task->id,
            'problem_description' => 'x',
            'support_required'    => 'No',
            'next_followup_date'  => now()->toDateString(),
            'next_followup_plan'  => 'x',
            'location'            => 'x',
        ])->assertStatus(400);
    }

    public function test_outlet_detail_tasks_and_a_visit_report_for_the_outlet_screen(): void
    {
        $lead   = $this->makeLead($this->rep, 'Detail Cafe', 'C-7');
        $task   = $this->makeTask($lead, $this->rep, now()->subDay());
        $other  = $this->makeLead($this->rep, 'Other Cafe', null);
        $this->makeTask($other, $this->rep, now()->subDay());
        $report = IFEReport::create(['created_by' => $this->otherRep->id, 'lead_id' => $lead->id, 'problem_description' => 'Checked the grinder.']);

        Sanctum::actingAs($this->rep);
        $this->getJson("/api/mobile/leads/get?leadID={$lead->id}")
            ->assertOk()
            ->assertJsonPath('data.kind', 'customer')
            ->assertJsonPath('data.customer_id', 'C-7');

        $this->getJson("/api/mobile/tasks?status=0&lead_id={$lead->id}")
            ->assertOk()
            ->assertJsonCount(1, 'tasks')
            ->assertJsonPath('tasks.0.id', $task->id);

        // Anyone who can see the outlet can read its visit reports...
        $this->getJson("/api/mobile/ife/get?id={$report->id}")
            ->assertOk()
            ->assertJsonPath('data.outlet', null)
            ->assertJsonPath('data.problem_description', 'Checked the grinder.');

        // ...and nobody else.
        $stranger = $this->makeUser(User::TYPE_USER, 'Stranger');
        Sanctum::actingAs($stranger);
        $this->getJson("/api/mobile/ife/get?id={$report->id}")->assertStatus(400);
    }

    private function makeUser(int $type, string $name): User
    {
        return User::withoutEvents(fn () => User::factory()->create(['name' => $name, 'type' => $type, 'status' => 1]));
    }

    private function makeLead(User $owner, string $shop, ?string $customerId): Leads
    {
        return Leads::create([
            'name'          => $shop . ' Sdn Bhd',
            'business_name' => $shop,
            'customer_id'   => $customerId,
            'belong_to'     => $owner->id,
            'assign_to'     => $owner->id,
        ]);
    }

    private function makeTask(Leads $lead, User $doer, $due): Tasks
    {
        $task = new Tasks();
        $task->status         = 2;
        $task->lead_id        = $lead->id;
        $task->task_reference = 'T-TEST-' . uniqid();
        $task->title          = 'Test task';
        $task->start_date     = now()->subDays(5)->toDateString();
        $task->start_time     = '09:00:00';
        $task->due_date       = $due->toDateString();
        $task->due_time       = $due->format('H:i:s');
        $task->creation_date  = now()->subDays(5);
        $task->save();

        foreach ([[1, $this->manager], [2, $doer], [3, $this->manager], [4, $this->manager]] as [$role, $user]) {
            TaskUsers::create(['task_id' => $task->id, 'user_id' => $user->id, 'role' => $role]);
        }

        return $task;
    }
}
