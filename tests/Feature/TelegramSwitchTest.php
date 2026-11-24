<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/** The Telegram bot is off for now: no pages, no webhook, no messages, no chat ID prompts. */
class TelegramSwitchTest extends TestCase
{
    use DatabaseTransactions;

    private function admin(): User
    {
        return User::withoutEvents(fn () => User::factory()->create(['type' => User::TYPE_ADMIN, 'status' => 1, 'telegram_chat_id' => null]));
    }

    public function test_off_by_default_its_pages_and_webhook_do_not_exist(): void
    {
        $this->assertFalse((bool) config('telegram.enabled'));
        $admin = $this->admin();

        $this->actingAs($admin)->get(route('setting.telegram_message'))->assertNotFound();
        $this->actingAs($admin)->get(route('setting.on_telegram_webhook'))->assertNotFound();
        $this->post('/webhook/telegram/callback', ['message' => ['text' => '/start']])->assertNotFound();
    }

    public function test_off_the_pages_hide_it_and_nobody_is_unlinked(): void
    {
        $this->withoutVite()->actingAs($this->admin())
            ->get('/index')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('app.telegram', false)
                ->where('summary.users.unlinked', 0)
                ->where('summary.users.unlinked_names', []));
    }

    public function test_switched_on_the_admin_is_told_who_is_unlinked(): void
    {
        config(['telegram.enabled' => true]);

        $this->withoutVite()->actingAs($this->admin())
            ->get('/index')
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page
                ->where('app.telegram', true)
                ->where('summary.users.unlinked', fn ($count) => $count >= 1));
    }

    public function test_off_no_reminder_is_sent(): void
    {
        $this->artisan('notification:task-reminder-alert')
            ->expectsOutputToContain('switched off')
            ->assertSuccessful();
    }
}
