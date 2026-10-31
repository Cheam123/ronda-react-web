<?php

namespace Tests\Feature;

use App\Models\DocumentUpload;
use App\Models\Leads;
use App\Models\Tasks;
use App\Models\TaskUsers;
use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The mobile home and task endpoints the app's Today and Tasks screens use.
 *
 * Runs inside a transaction that is rolled back, so it leaves the database
 * as it found it; pushes are faked so no device is notified.
 */
class MobileTasksTest extends TestCase
{
    use DatabaseTransactions;

    private User $rep;
    private User $otherRep;
    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        Bus::fake();

        $this->rep      = $this->makeUser(User::TYPE_USER, 'Test Rep');
        $this->otherRep = $this->makeUser(User::TYPE_USER, 'Other Rep');
        $this->manager  = $this->makeUser(User::TYPE_MANAGER, 'Test Manager');
    }

    public function test_home_lists_overdue_and_at_risk_tasks_separately(): void
    {
        $overdue = $this->makeTask($this->rep, 'Collect overdue invoice', now()->subDays(2));
        $atRisk  = $this->makeTask($this->rep, 'Fit new grinder burrs', now()->addHours(5));
        $this->makeTask($this->rep, 'Send a quote', now()->addDays(10), now()->subDay());

        Sanctum::actingAs($this->rep);
        $today = $this->getJson('/api/mobile/home')->assertOk()->json('today');

        $this->assertSame(2, $today['counts']['at_risk'], 'at_risk keeps counting overdue too');
        $this->assertSame(1, $today['counts']['overdue']);
        $this->assertSame([$overdue->id], array_column($today['overdue'], 'id'));
        $this->assertSame([$atRisk->id], array_column($today['at_risk'], 'id'));
        $this->assertSame('overdue', $today['overdue'][0]['risk']);
        $this->assertArrayHasKey('suggestions', $today);
    }

    public function test_managers_get_no_rep_suggestions_card(): void
    {
        Sanctum::actingAs($this->manager);

        $this->assertNull($this->getJson('/api/mobile/home')->assertOk()->json('today.suggestions'));
    }

    public function test_task_list_focus_and_extra_fields(): void
    {
        $overdue = $this->makeTask($this->rep, 'Collect overdue invoice', now()->subDay());
        $this->makeTask($this->rep, 'Later work', now()->addDays(10), now()->subDay());

        Sanctum::actingAs($this->rep);
        $tasks = $this->getJson('/api/mobile/tasks?focus=overdue&per_page=50')->assertOk()->json('tasks');

        $this->assertSame([$overdue->id], array_column($tasks, 'id'));
        $row = $tasks[0];
        $this->assertSame('overdue', $row['risk']);
        $this->assertSame('Test Manager', $row['checker']);
        $this->assertSame('Test Shop', $row['outlet_name']);
        $this->assertNotEmpty($row['reference']);
    }

    public function test_a_rep_cannot_open_someone_elses_task(): void
    {
        $theirs = $this->makeTask($this->otherRep, 'Not yours', now()->addDay());

        Sanctum::actingAs($this->rep);
        $this->getJson('/api/mobile/tasks/get?taskID=' . $theirs->id)
            ->assertStatus(400)
            ->assertJson(['message' => 'Task not found.']);

        Sanctum::actingAs($this->manager);
        $this->getJson('/api/mobile/tasks/get?taskID=' . $theirs->id)
            ->assertOk()
            ->assertJsonPath('data.checker', 'Test Manager');
    }

    public function test_a_rep_cannot_read_or_post_in_someone_elses_task_chat(): void
    {
        $theirs = $this->makeTask($this->otherRep, 'Not yours', now()->addDay());

        Sanctum::actingAs($this->rep);
        $this->getJson('/api/mobile/tasks/chatHistory?taskID=' . $theirs->id)->assertStatus(400);
        $this->postJson('/api/mobile/tasks/storeChat', ['task_id' => $theirs->id, 'chat_message' => 'Hello'])->assertStatus(400);

        Sanctum::actingAs($this->otherRep);
        $this->postJson('/api/mobile/tasks/storeChat', ['task_id' => $theirs->id, 'chat_message' => 'On my way'])->assertOk();
        $this->getJson('/api/mobile/tasks/chatHistory?taskID=' . $theirs->id)
            ->assertOk()
            ->assertJsonPath('data.comments.0.message', 'On my way');
    }

    public function test_mark_as_done_needs_no_optional_keys_and_keeps_photos(): void
    {
        Storage::fake();
        $task = $this->makeTask($this->rep, 'Fix the water filter', now()->addDay());

        Sanctum::actingAs($this->rep);
        $this->post('/api/mobile/tasks/markAsDone', [
            'task_id'        => $task->id,
            'special_remark' => 'Changed the cartridge.',
            'files'          => [UploadedFile::fake()->image('filter.jpg')],
        ], ['Accept' => 'application/json'])->assertOk();

        $this->assertSame(3, (int) $task->fresh()->status);
        $this->assertSame(1, DocumentUpload::where('task_id', $task->id)->whereNull('task_comment_id')->count());

        $detail = $this->getJson('/api/mobile/tasks/get?taskID=' . $task->id)->assertOk()->json('data');
        $this->assertSame('Changed the cartridge.', $detail['done_remark']);
        $this->assertCount(1, $detail['done_photos']['media']);

        // No remark, invoice or sales keys at all: still fine.
        $other = $this->makeTask($this->rep, 'Deliver tabs', now()->addDay());
        $this->postJson('/api/mobile/tasks/markAsDone', ['task_id' => $other->id])->assertOk();
    }

    public function test_a_sent_back_task_shows_the_checkers_reason_until_it_is_done_again(): void
    {
        $task = $this->makeTask($this->rep, 'Check the grinder', now()->addDay());

        Sanctum::actingAs($this->rep);
        $this->postJson('/api/mobile/tasks/markAsDone', ['task_id' => $task->id, 'special_remark' => 'Cleaned the grinder.'])->assertOk();
        $this->assertNull($this->getJson('/api/mobile/tasks/get?taskID=' . $task->id)->json('data.sent_back'));

        Sanctum::actingAs($this->manager);
        $this->postJson('/api/mobile/tasks/markAsFallback', ['task_id' => $task->id, 'special_remark' => 'Please add a photo.'])->assertOk();

        Sanctum::actingAs($this->rep);
        $detail = $this->getJson('/api/mobile/tasks/get?taskID=' . $task->id)->assertOk()->json('data');
        $this->assertSame(2, (int) $detail['status']);
        $this->assertSame('Please add a photo.', $detail['sent_back']['remark']);
        $this->assertSame('Test Manager', $detail['sent_back']['by']);
        $this->assertNotEmpty($detail['sent_back']['at']);

        // Done again: the reason has been dealt with.
        $this->postJson('/api/mobile/tasks/markAsDone', ['task_id' => $task->id, 'special_remark' => 'Added the photo.'])->assertOk();
        $this->assertNull($this->getJson('/api/mobile/tasks/get?taskID=' . $task->id)->json('data.sent_back'));
    }

    private function makeUser(int $type, string $name): User
    {
        return User::withoutEvents(fn () => User::factory()->create([
            'name'   => $name,
            'type'   => $type,
            'status' => 1,
        ]));
    }

    /** An In Progress task on a fresh outlet: $doer does it, the manager checks it. */
    private function makeTask(User $doer, string $title, $due, $start = null): Tasks
    {
        $lead = Leads::create(['name' => 'Test Company', 'business_name' => 'Test Shop', 'belong_to' => $doer->id]);

        $task = new Tasks();
        $task->status         = 2;
        $task->lead_id        = $lead->id;
        $task->task_reference = 'T-TEST-' . uniqid();
        $task->title          = $title;
        $task->start_date     = ($start ?? now()->subDays(3))->toDateString();
        $task->start_time     = ($start ?? now()->subDays(3))->format('H:i:s');
        $task->due_date       = $due->toDateString();
        $task->due_time       = $due->format('H:i:s');
        $task->creation_date  = now()->subDays(3);
        $task->save();

        foreach ([[1, $this->manager], [2, $doer], [3, $this->manager], [4, $this->manager]] as [$role, $user]) {
            TaskUsers::create(['task_id' => $task->id, 'user_id' => $user->id, 'role' => $role]);
        }

        return $task;
    }
}
