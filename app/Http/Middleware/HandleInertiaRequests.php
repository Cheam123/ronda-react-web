<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\FormApprovalService;
use Illuminate\Http\Request;
use Inertia\Middleware;

/**
 * Props every React page receives: who is signed in and what they may do,
 * the navigation badges, and the session flashes the controllers set.
 */
class HandleInertiaRequests extends Middleware
{
    /**
     * The root template loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    public function share(Request $request): array
    {
        return array_merge(parent::share($request), [
            'app'        => [
                'name'     => config('app.name'),
                'currency' => config('ife.currency', 'RM'),
            ],
            // Sent back as X-CSRF-TOKEN on every request (see bootstrap.ts).
            // The XSRF-TOKEN cookie cannot be used: EncryptCookies runs twice
            // in the Kernel, so the cookie value never decrypts to the token.
            'csrfToken'  => fn () => csrf_token(),
            'auth'       => fn () => $this->auth($request),
            'navigation' => fn () => $this->navigation($request),
            'flash'      => fn () => $this->flash($request),
        ]);
    }

    /**
     * The signed-in user, trimmed to what the UI needs. The full model is
     * never sent: its appended attributes run queries on every serialise.
     */
    private function auth(Request $request): array
    {
        /** @var User|null $user */
        $user = $request->user('web');

        if (!$user) {
            return ['user' => null, 'can' => []];
        }

        return [
            'user' => [
                'id'        => $user->id,
                'name'      => $user->name,
                'email'     => $user->email,
                'gender'    => $user->gender,
                'type'      => $user->type,
                'typeLabel' => User::getUserType($user->type),
            ],
            'can'  => $user->abilities(),
        ];
    }

    private function navigation(Request $request): array
    {
        $user = $request->user('web');

        return [
            'formTaskCount' => $user ? FormApprovalService::pendingCountFor($user->id) : 0,
        ];
    }

    /**
     * Session flashes. `alert` is the SweetAlert the controllers queue with
     * alert()->success(...); the page fires it on arrival. `needsAssignee` is
     * a form action the server refused until someone picks the next handler
     * (see FormController): {name, action, fields}.
     */
    private function flash(Request $request): array
    {
        $session = $request->session();
        $alert   = $session->pull('alert.config');

        return [
            'success'       => $session->get('success'),
            'error'         => $session->get('error'),
            'status'        => $session->get('status'),
            'alert'         => $alert ? json_decode($alert, true) : null,
            'needsAssignee' => $session->get('needs_assignee'),
        ];
    }
}
