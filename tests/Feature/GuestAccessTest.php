<?php

namespace Tests\Feature;

use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

/**
 * What a signed-out visitor can and cannot reach.
 */
class GuestAccessTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        // The pages load their assets through Vite; the tests need no build.
        $this->withoutVite();
    }

    public function test_guests_are_sent_to_the_login_page(): void
    {
        $this->get('/')->assertRedirect(route('login'));
        $this->get('/v1/task/manage/index')->assertRedirect(route('login'));
    }

    public function test_the_login_page_renders_the_react_page(): void
    {
        $this->get(route('login'))
            ->assertOk()
            ->assertInertia(fn (Assert $page) => $page->component('Auth/Login'));
    }

    public function test_accounts_cannot_be_self_registered(): void
    {
        $this->get('/register')->assertNotFound();
        $this->post('/register', [
            'name'                  => 'Stranger',
            'email'                 => 'stranger@example.com',
            'password'              => 'secret123',
            'password_confirmation' => 'secret123',
        ])->assertNotFound();
    }

    public function test_the_legal_pages_are_public(): void
    {
        foreach (['legal.privacy', 'legal.terms', 'legal.accountDeletion'] as $name) {
            $this->get(route($name))->assertOk();
        }
    }
}
