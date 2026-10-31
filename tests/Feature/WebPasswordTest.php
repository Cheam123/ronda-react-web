<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use Tests\TestCase;

/**
 * The password rule (App\Support\PasswordPolicy) wherever a password is set,
 * and an admin's "Reset password" emailing a link instead of setting one.
 *
 * Runs inside a transaction that is rolled back. Factory users have the
 * password "password".
 */
class WebPasswordTest extends TestCase
{
    use DatabaseTransactions;

    private const PHRASE = 'kopi at the corner shop';

    public function test_a_new_password_needs_ten_characters(): void
    {
        $user = $this->makeUser(User::TYPE_USER);

        $this->actingAs($user)
            ->from(route('users.changepassword'))
            ->post(route('users.updatepassword'), ['oldpass' => 'password', 'pass1' => 'short1234', 'pass2' => 'short1234'])
            ->assertSessionHasErrors(['pass1' => 'Use at least 10 characters.']);

        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }

    public function test_a_long_phrase_is_a_good_password(): void
    {
        $user = $this->makeUser(User::TYPE_USER);

        $this->actingAs($user)
            ->post(route('users.updatepassword'), ['oldpass' => 'password', 'pass1' => self::PHRASE, 'pass2' => self::PHRASE])
            ->assertRedirect(route('users.profile'));

        $this->assertTrue(Hash::check(self::PHRASE, $user->fresh()->password));
    }

    public function test_a_wrong_current_password_is_said_under_its_field(): void
    {
        $user = $this->makeUser(User::TYPE_USER);

        $this->actingAs($user)
            ->from(route('users.changepassword'))
            ->post(route('users.updatepassword'), ['oldpass' => 'not-it', 'pass1' => self::PHRASE, 'pass2' => self::PHRASE])
            ->assertRedirect(route('users.changepassword'))
            ->assertSessionHasErrors(['oldpass' => 'That isn’t your current password.']);
    }

    public function test_the_reset_link_follows_the_same_rule(): void
    {
        $user  = $this->makeUser(User::TYPE_USER);
        $token = Password::broker()->createToken($user);

        $this->from(route('password.reset', $token))
            ->post(route('password.update'), [
                'token' => $token, 'email' => $user->email,
                'password' => 'short', 'password_confirmation' => 'short',
            ])
            ->assertSessionHasErrors(['password' => 'Use at least 10 characters.']);

        $this->post(route('password.update'), [
            'token' => $token, 'email' => $user->email,
            'password' => self::PHRASE, 'password_confirmation' => self::PHRASE,
        ])->assertSessionHasNoErrors();

        $this->assertTrue(Hash::check(self::PHRASE, $user->fresh()->password));
    }

    public function test_an_admin_reset_emails_a_link_and_leaves_the_password_alone(): void
    {
        Notification::fake();
        $admin = $this->makeUser(User::TYPE_ADMIN);
        $user  = $this->makeUser(User::TYPE_USER);

        $this->actingAs($admin)
            ->from(route('users.index'))
            ->post(route('users.resetpassword'), ['id' => $user->id])
            ->assertRedirect(route('users.index'));

        Notification::assertSentTo($user, ResetPassword::class);
        $this->assertTrue(Hash::check('password', $user->fresh()->password));
    }

    public function test_only_people_who_manage_users_can_send_a_reset_link(): void
    {
        Notification::fake();
        $rep  = $this->makeUser(User::TYPE_USER);
        $user = $this->makeUser(User::TYPE_USER);

        $this->actingAs($rep)->post(route('users.resetpassword'), ['id' => $user->id]);

        Notification::assertNothingSent();
    }

    private function makeUser(int $type): User
    {
        return User::withoutEvents(fn () => User::factory()->create([
            'type'   => $type,
            'status' => 1,
        ]));
    }
}
