<?php

namespace Tests\Feature;

use App\Jobs\FirebaseNotification;
use App\Models\IFEReport;
use App\Models\Leads;
use App\Models\Order;
use App\Models\Tasks;
use App\Models\TaskUsers;
use App\Models\User;
use App\Services\AlertInbox;
use App\Services\FirebaseService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\DB;
use Laravel\Sanctum\Sanctum;
use Mockery;
use Tests\TestCase;

/**
 * Focus alerts (every push saved to an inbox) and the Me screen's numbers.
 *
 * Runs inside a transaction that is rolled back; pushes are faked or mocked.
 */
class MobileAlertsTest extends TestCase
{
    use DatabaseTransactions;

    private User $rep;
    private User $otherRep;
    private User $manager;

    protected function setUp(): void
    {
        parent::setUp();

        Bus::fake();

        $this->rep      = $this->makeUser(User::TYPE_USER, 'Alerts Rep');
        $this->otherRep = $this->makeUser(User::TYPE_USER, 'Other Rep');
        $this->manager  = $this->makeUser(User::TYPE_MANAGER, 'Alerts Manager');
    }

    public function test_the_inbox_lists_only_my_alerts_and_leaves_chat_badges_alone(): void
    {
        AlertInbox::record([$this->rep, $this->otherRep], 'New Sales Task', 'Collect the invoice at Daily Grind', ['type' => 'task', 'id' => '42']);
        $badgeId = $this->chatBadgeFor($this->rep);

        Sanctum::actingAs($this->rep);
        $body = $this->getJson('/api/mobile/alerts')->assertOk()->json();

        $this->assertCount(1, $body['alerts']);
        $this->assertSame(1, $body['unread']);
        $this->assertSame('New Sales Task', $body['alerts'][0]['title']);
        $this->assertSame('Collect the invoice at Daily Grind', $body['alerts'][0]['body']);
        $this->assertSame('task', $body['alerts'][0]['type']);
        $this->assertSame('42', $body['alerts'][0]['target_id']);
        $this->assertFalse($body['alerts'][0]['read']);

        // Marking all read does not touch the chat's unread badge.
        $this->postJson('/api/mobile/alerts/read', ['all' => true])->assertOk()->assertJsonPath('unread', 0);
        $this->assertNull(DB::table('notifications')->where('id', $badgeId)->value('read_at'));

        // The other rep's copy is still unread.
        Sanctum::actingAs($this->otherRep);
        $this->getJson('/api/mobile/alerts')->assertOk()->assertJsonPath('unread', 1);
    }

    public function test_marking_some_alerts_read(): void
    {
        AlertInbox::record($this->rep, 'First', 'One', ['type' => 'task', 'id' => '1']);
        AlertInbox::record($this->rep, 'Second', 'Two', ['type' => 'task', 'id' => '2']);

        Sanctum::actingAs($this->rep);
        $alerts = $this->getJson('/api/mobile/alerts')->json('alerts');

        $this->postJson('/api/mobile/alerts/read', [])->assertStatus(400);
        $this->postJson('/api/mobile/alerts/read', ['ids' => [$alerts[0]['id']]])
            ->assertOk()
            ->assertJsonPath('marked', 1)
            ->assertJsonPath('unread', 1);

        // Someone else's ids do nothing.
        AlertInbox::record($this->otherRep, 'Theirs', 'Not yours');
        $theirs = DB::table('notifications')->where('notifiable_id', $this->otherRep->id)->where('type', AlertInbox::TYPE)->value('id');
        $this->postJson('/api/mobile/alerts/read', ['ids' => [$theirs]])->assertOk()->assertJsonPath('marked', 0);
    }

    public function test_a_push_is_saved_for_people_with_no_device(): void
    {
        $lead = Leads::create(['name' => 'Alerts Cafe Sdn Bhd', 'business_name' => 'Alerts Cafe', 'belong_to' => $this->rep->id, 'assign_to' => $this->rep->id]);

        // The test manager has no token: no push for them, but an inbox row.
        $firebase = Mockery::mock(FirebaseService::class);
        $firebase->shouldReceive('sendToDevice')->andReturn([]);
        (new FirebaseNotification($lead->id, 'lead', '0'))->handle($firebase);

        $row = DB::table('notifications')->where('notifiable_id', $this->manager->id)->where('type', AlertInbox::TYPE)->first();
        $this->assertNotNull($row);
        $data = json_decode($row->data, true);
        $this->assertSame('New outlet', $data['title']);
        $this->assertSame('Alerts Cafe', $data['body']);
        $this->assertSame(['lead', (string) $lead->id], [$data['type'], $data['id']]);

        // A rep is not told about new leads.
        $this->assertFalse(DB::table('notifications')->where('notifiable_id', $this->rep->id)->where('type', AlertInbox::TYPE)->exists());
    }

    public function test_a_sent_back_task_alert_says_so_in_plain_words(): void
    {
        $lead = Leads::create(['name' => 'Alerts Cafe Sdn Bhd', 'business_name' => 'Alerts Cafe', 'belong_to' => $this->rep->id]);
        $task = new Tasks();
        $task->status         = 2;
        $task->lead_id        = $lead->id;
        $task->task_reference = 'T-TEST-' . uniqid();
        $task->title          = 'Fix the water filter';
        $task->start_date     = now()->toDateString();
        $task->due_date       = now()->addDay()->toDateString();
        $task->creation_date  = now();
        $task->save();
        foreach ([[1, $this->manager], [2, $this->rep], [3, $this->manager]] as [$role, $user]) {
            TaskUsers::create(['task_id' => $task->id, 'user_id' => $user->id, 'role' => $role]);
        }

        $firebase = Mockery::mock(FirebaseService::class);
        $firebase->shouldReceive('sendToDevice')->andReturn([]);
        (new FirebaseNotification($task->id, 'task', '8'))->handle($firebase);

        $data = json_decode(DB::table('notifications')->where('notifiable_id', $this->rep->id)->where('type', AlertInbox::TYPE)->value('data'), true);
        $this->assertSame('Task sent back', $data['title']);
        $this->assertSame('Fix the water filter at Alerts Cafe', $data['body']);
    }

    public function test_me_stats_and_my_orders(): void
    {
        $lead = Leads::create(['name' => 'Stats Cafe Sdn Bhd', 'business_name' => 'Stats Cafe', 'belong_to' => $this->rep->id, 'assign_to' => $this->rep->id]);
        IFEReport::create(['created_by' => $this->rep->id, 'lead_id' => $lead->id, 'problem_description' => 'Visited.']);
        $order = Order::create([
            'order_no'     => 'T' . substr(uniqid(), -8),
            'lead_id'      => $lead->id,
            'order_date'   => now()->toDateString(),
            'created_by'   => $this->rep->id,
            'status'       => Order::STATUS_CONFIRMED,
            'total_amount' => 412.5,
        ]);

        Sanctum::actingAs($this->rep);
        $this->getJson('/api/mobile/me/stats')
            ->assertOk()
            ->assertJsonPath('month.visits', 1)
            ->assertJsonPath('month.orders', 1)
            ->assertJsonPath('month.orders_value', 412.5)
            ->assertJsonPath('month.forms', 0)
            ->assertJsonPath('totals.orders', 1);

        $this->getJson('/api/mobile/orders?mine=1')
            ->assertOk()
            ->assertJsonPath('orders.0.id', $order->id)
            ->assertJsonPath('orders.0.outlet', 'Stats Cafe')
            ->assertJsonCount(1, 'orders');

        Sanctum::actingAs($this->otherRep);
        $this->getJson('/api/mobile/orders?mine=1')->assertOk()->assertJsonCount(0, 'orders');
    }

    /** A chat's unread-badge row, as FirebaseNotification writes it. Returns its id. */
    private function chatBadgeFor(User $user): string
    {
        $id = $user->id . '-' . uniqid();
        DB::table('notifications')->insert([
            'id'              => $id,
            'type'            => 'AppModelsTaskComment',
            'notifiable_type' => User::class,
            'notifiable_id'   => $user->id,
            'content_type'    => 'AppModelsTaskComment',
            'content_id'      => 1,
            'data'            => '[]',
            'created_at'      => now(),
            'updated_at'      => now(),
        ]);

        return $id;
    }

    private function makeUser(int $type, string $name): User
    {
        return User::withoutEvents(fn () => User::factory()->create(['name' => $name, 'type' => $type, 'status' => 1, 'fcm_token' => null]));
    }
}
