<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Tests\TestCase;

/**
 * What the sign-in form says when it can't let someone in.
 *
 * Runs inside a transaction that is rolled back. Factory users have the
 * password "password".
 */
class WebSignInTest extends TestCase
{
    use DatabaseTransactions;

    private const WRONG = 'The email or password isn’t right. Check both and try again.';

    public function test_a_wrong_password_and_an_unknown_email_get_the_same_message(): void
    {
        $user = $this->makeUser(1);

        $this->from(route('login'))
            ->post(route('login'), ['email' => $user->email, 'password' => 'not-the-password'])
            ->assertRedirect(route('login'))
            ->assertSessionHasErrors(['message' => self::WRONG]);

        $this->from(route('login'))
            ->post(route('login'), ['email' => 'nobody-' . uniqid() . '@example.test', 'password' => 'not-the-password'])
            ->assertSessionHasErrors(['message' => self::WRONG]);

        $this->assertGuest();
    }

    public function test_a_switched_off_account_is_named_only_to_someone_with_its_password(): void
    {
        $user = $this->makeUser(0);

        $this->from(route('login'))
            ->post(route('login'), ['email' => $user->email, 'password' => 'not-the-password'])
            ->assertSessionHasErrors(['message' => self::WRONG]);

        $this->from(route('login'))
            ->post(route('login'), ['email' => $user->email, 'password' => 'password'])
            ->assertSessionHasErrors(['message' => 'Your account is switched off. Ask your manager or an admin to turn it back on.']);

        $this->assertGuest();
    }

    public function test_the_password_is_not_sent_back_to_the_form(): void
    {
        $user = $this->makeUser(1);

        $this->from(route('login'))
            ->post(route('login'), ['email' => $user->email, 'password' => 'not-the-password'])
            ->assertSessionHasInput('email', $user->email)
            ->assertSessionMissing('_old_input.password');
    }

    private function makeUser(int $status): User
    {
        return User::withoutEvents(fn () => User::factory()->create([
            'type'   => User::TYPE_USER,
            'status' => $status,
        ]));
    }
}
