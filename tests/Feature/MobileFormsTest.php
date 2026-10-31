<?php

namespace Tests\Feature;

use App\Models\Form;
use App\Models\FormSubmission;
use App\Models\User;
use App\Services\FormSchemaService;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Bus;
use Illuminate\Support\Facades\Storage;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

/**
 * The mobile forms endpoints the app uses: a submission sent the way the app
 * sends it (multipart, answers as a JSON string, photos per field), and
 * closing a record.
 *
 * Runs inside a transaction that is rolled back; pushes and files are faked.
 */
class MobileFormsTest extends TestCase
{
    use DatabaseTransactions;

    private User $rep;
    private User $otherRep;
    private User $manager;
    private Form $form;

    protected function setUp(): void
    {
        parent::setUp();

        Bus::fake();
        Storage::fake();
        FormSchemaService::flushUserOptions();

        $this->rep      = $this->makeUser(User::TYPE_USER, 'Test Rep');
        $this->otherRep = $this->makeUser(User::TYPE_USER, 'Other Rep');
        $this->manager  = $this->makeUser(User::TYPE_MANAGER, 'Test Manager');
        $this->form     = $this->makeForm();
    }

    public function test_a_submission_sent_like_the_app_is_saved_with_its_photos_and_stamp(): void
    {
        Sanctum::actingAs($this->rep);

        $body = $this->post("/api/mobile/forms/{$this->form->id}/submit", [
            'record_title' => 'Test Cafe, October check',
            'form_data'    => json_encode([
                ['id' => 'el_machine', 'value' => 'Grinder'],
                ['id' => 'el_working', 'value' => 'No'],
                ['id' => 'el_wrong', 'value' => 'The burrs are worn.'],
                ['id' => 'el_stamp', 'value' => ['lat' => 3.11803, 'lng' => 101.62402, 'accuracy' => 12, 'captured_at' => now()->toIso8601String()]],
            ]),
            'files' => ['el_photos' => [UploadedFile::fake()->image('wand.jpg')]],
        ], ['Accept' => 'application/json'])->assertOk()->json();

        $entry = FormSubmission::findOrFail($body['entry_id']);
        $this->assertSame('pending', $entry->status);
        $this->assertSame('Test Cafe, October check', $entry->record_title);

        $answers = collect($entry->form_elements)->keyBy('id');
        $this->assertSame('The burrs are worn.', $answers['el_wrong']['value']);
        $this->assertEqualsWithDelta(3.11803, $answers['el_stamp']['value']['lat'], 0.00001);
        $this->assertCount(1, $answers['el_photos']['value']);

        // The opener sees it, may close it, and nobody else can open it.
        $this->getJson("/api/mobile/forms/records/{$entry->id}")
            ->assertOk()
            ->assertJsonPath('record.can_close', true);

        Sanctum::actingAs($this->otherRep);
        $this->getJson("/api/mobile/forms/records/{$entry->id}")->assertStatus(400);
    }

    public function test_a_hidden_answer_is_dropped_and_a_missing_one_is_refused(): void
    {
        Sanctum::actingAs($this->rep);

        // "What is wrong?" only shows when the machine is not working.
        $body = $this->postJson("/api/mobile/forms/{$this->form->id}/submit", [
            'form_data' => [
                ['id' => 'el_machine', 'value' => 'Grinder'],
                ['id' => 'el_working', 'value' => 'Yes'],
                ['id' => 'el_wrong', 'value' => 'Should not be kept'],
            ],
        ])->assertOk()->json();

        $answers = collect(FormSubmission::findOrFail($body['entry_id'])->form_elements)->keyBy('id');
        $this->assertNull($answers['el_wrong']['value']);
        $this->assertTrue($answers['el_wrong']['hidden']);

        $this->postJson("/api/mobile/forms/{$this->form->id}/submit", [
            'form_data' => [['id' => 'el_working', 'value' => 'Yes']],
        ])->assertStatus(400)->assertJsonPath('errors.el_machine', 'Which machine? is required.');
    }

    public function test_only_the_opener_can_close_a_record_and_a_reason_is_required(): void
    {
        $entry = $this->submitAs($this->rep);

        Sanctum::actingAs($this->otherRep);
        $this->postJson("/api/mobile/forms/records/{$entry->id}/close", ['remark' => 'Not mine'])->assertStatus(400);

        Sanctum::actingAs($this->rep);
        $this->postJson("/api/mobile/forms/records/{$entry->id}/close", [])->assertStatus(400);

        $this->postJson("/api/mobile/forms/records/{$entry->id}/close", ['remark' => 'Sent by mistake.'])
            ->assertOk()
            ->assertJsonPath('record_status', 'closed')
            ->assertJsonPath('entry_status', 'cancelled');

        $entry->refresh();
        $this->assertSame('closed', $entry->record_status);
        $this->assertSame('Sent by mistake.', $entry->record_closed_remark);
        $this->assertSame('Record closed: Sent by mistake.', $entry->rejected_remark);

        // Closing twice says so rather than writing again.
        $this->postJson("/api/mobile/forms/records/{$entry->id}/close", ['remark' => 'Again'])->assertStatus(400);
        $this->getJson("/api/mobile/forms/records/{$entry->id}")
            ->assertOk()
            ->assertJsonPath('record.can_close', false)
            ->assertJsonPath('record.closed.remark', 'Sent by mistake.');
    }

    public function test_the_approver_sees_it_in_their_turn_and_can_approve(): void
    {
        $entry = $this->submitAs($this->rep);

        Sanctum::actingAs($this->manager);
        $tasks = $this->getJson('/api/mobile/forms/tasks')->assertOk()->json('tasks');
        $this->assertContains($entry->id, array_column($tasks, 'entry_id'));

        $this->getJson("/api/mobile/forms/entries/{$entry->id}")
            ->assertOk()
            ->assertJsonPath('entry.can_act', true)
            ->assertJsonPath('entry.stage_type', 'approval');

        $this->postJson("/api/mobile/forms/tasks/{$entry->id}/approve", ['remark' => null])->assertOk();
        $this->assertSame('approved', $entry->fresh()->status);
    }

    public function test_person_fields_carry_names_the_app_can_show(): void
    {
        Sanctum::actingAs($this->rep);

        // The form lists who a Person field offers, by name.
        $elements = collect($this->getJson("/api/mobile/forms/{$this->form->id}")->assertOk()->json('form.elements'))->keyBy('id');
        $this->assertContains(['id' => $this->manager->id, 'name' => 'Test Manager', 'active' => true], $elements['el_who']['people']);
        $this->assertArrayNotHasKey('people', $elements['el_machine']);

        // And a stored answer comes back with the name beside the id.
        $id = $this->postJson("/api/mobile/forms/{$this->form->id}/submit", [
            'form_data' => [
                ['id' => 'el_machine', 'value' => 'Grinder'],
                ['id' => 'el_who', 'value' => $this->manager->id],
            ],
        ])->assertOk()->json('entry_id');

        $answers = collect($this->getJson("/api/mobile/forms/entries/{$id}")->assertOk()->json('entry.form_elements'))->keyBy('id');
        $this->assertSame('Test Manager', $answers['el_who']['value_label']);
    }

    public function test_a_deactivated_person_keeps_their_name_but_is_marked_inactive(): void
    {
        $gone = User::withoutEvents(fn () => User::factory()->create(['name' => 'Gone Rep', 'type' => User::TYPE_USER, 'status' => 0]));
        FormSchemaService::flushUserOptions();

        Sanctum::actingAs($this->rep);
        $people = collect($this->getJson("/api/mobile/forms/{$this->form->id}")->assertOk()->json('form.elements'))
            ->keyBy('id')['el_who']['people'];
        $people = collect($people)->keyBy('id');

        $this->assertSame(['id' => $gone->id, 'name' => 'Gone Rep', 'active' => false], $people[$gone->id]);
        $this->assertTrue($people[$this->manager->id]['active']);
    }

    public function test_a_deactivated_person_cannot_be_picked_but_an_edit_may_keep_them(): void
    {
        Sanctum::actingAs($this->rep);
        $answers = fn (int $who) => [
            ['id' => 'el_machine', 'value' => 'Grinder'],
            ['id' => 'el_who', 'value' => $who],
        ];

        // Picked while still active.
        $id = $this->postJson("/api/mobile/forms/{$this->form->id}/submit", ['form_data' => $answers($this->otherRep->id)])
            ->assertOk()
            ->json('entry_id');

        User::withoutEvents(fn () => $this->otherRep->update(['status' => 0]));
        FormSchemaService::flushUserOptions();

        // A new pick of them is refused, and says why.
        $this->postJson("/api/mobile/forms/{$this->form->id}/submit", ['form_data' => $answers($this->otherRep->id)])
            ->assertStatus(400)
            ->assertJsonPath('errors.el_who', 'Other Rep is no longer active. Choose someone else for Who fixes it?.');

        // An edit that leaves the answer as it was still saves.
        $this->putJson("/api/mobile/forms/entries/{$id}", ['form_data' => $answers($this->otherRep->id)])->assertOk();
    }

    public function test_a_record_names_who_it_is_waiting_on(): void
    {
        $entry = $this->submitAs($this->rep);

        $this->getJson("/api/mobile/forms/records/{$entry->id}")
            ->assertOk()
            ->assertJsonPath('record.waiting_on', ['Test Manager']);

        Sanctum::actingAs($this->manager);
        $this->postJson("/api/mobile/forms/tasks/{$entry->id}/approve", ['remark' => null])->assertOk();

        // Approved: nobody owes anything now.
        $this->getJson("/api/mobile/forms/records/{$entry->id}")
            ->assertOk()
            ->assertJsonPath('record.waiting_on', []);
    }

    private function submitAs(User $user): FormSubmission
    {
        Sanctum::actingAs($user);

        $id = $this->postJson("/api/mobile/forms/{$this->form->id}/submit", [
            'form_data' => [
                ['id' => 'el_machine', 'value' => 'Grinder'],
                ['id' => 'el_working', 'value' => 'Yes'],
            ],
        ])->assertOk()->json('entry_id');

        return FormSubmission::findOrFail($id);
    }

    private function makeUser(int $type, string $name): User
    {
        return User::withoutEvents(fn () => User::factory()->create(['name' => $name, 'type' => $type, 'status' => 1]));
    }

    private function makeForm(): Form
    {
        $field = fn (string $id, string $type, string $label, array $extra = []) => array_merge([
            'id' => $id, 'kind' => 'field', 'type' => $type, 'label' => $label, 'mandatory' => false,
            'values' => [], 'group_id' => 'grp_machine', 'order' => 10, 'visible_when' => null,
        ], $extra);

        return Form::create([
            'name'          => 'Test equipment check',
            'is_enabled'    => 1,
            'settings'      => ['access' => ['submit_scope' => 'everyone', 'user_ids' => [], 'user_types' => []]],
            'form_elements' => [
                'schema_version' => 2,
                'groups'         => [['id' => 'grp_machine', 'label' => 'Machine', 'order' => 10, 'visible_when' => null]],
                'elements'       => [
                    $field('el_machine', 'select', 'Which machine?', ['mandatory' => true, 'values' => ['Grinder', 'Espresso machine'], 'order' => 10]),
                    $field('el_working', 'select', 'Is it working?', ['values' => ['Yes', 'No'], 'order' => 20]),
                    $field('el_wrong', 'textarea', 'What is wrong?', ['order' => 30, 'visible_when' => [
                        'groups' => [['conditions' => [['field' => 'el_working', 'operator' => 'equals', 'value' => 'No']]]],
                    ]]),
                    $field('el_photos', 'file', 'Photos', ['order' => 40]),
                    $field('el_stamp', 'gps', 'Location stamp', ['order' => 50, 'capture_mode' => 'manual']),
                    $field('el_who', 'user', 'Who fixes it?', ['order' => 60, 'user_source' => 'all']),
                ],
            ],
            'process_definition' => [
                'process_version' => 1,
                'nodes'           => [[
                    'id' => 'nd_approve', 'type' => 'approval', 'name' => 'Manager approves',
                    'approver_ids' => [$this->manager->id], 'approval_mode' => 'any',
                    'field_permissions' => ['default' => 'read', 'overrides' => []],
                ]],
            ],
        ]);
    }
}
