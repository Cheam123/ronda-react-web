<?php

namespace App\Exceptions;

use Illuminate\Foundation\Exceptions\Handler as ExceptionHandler;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Throwable;

class Handler extends ExceptionHandler
{
    /**
     * HTTP errors the web app shows as its own error page. Anything else
     * (and everything while debugging) keeps Laravel's default rendering.
     */
    private const INERTIA_ERROR_STATUSES = [401, 403, 404, 429, 500, 503];

    /**
     * A list of the exception types that are not reported.
     *
     * @var array
     */
    protected $dontReport = [
        //
    ];

    /**
     * A list of the inputs that are never flashed for validation exceptions.
     *
     * @var array
     */
    protected $dontFlash = [
        'password',
        'password_confirmation',
    ];

    /**
     * Register the exception handling callbacks for the application.
     *
     * @return void
     */
    public function register()
    {
        $this->reportable(function (Throwable $e) {
            //
        });
    }

    /**
     * Render errors for browser requests through the React error page so an
     * Inertia visit never lands on a raw HTML error document. JSON callers
     * (the mobile app, AJAX endpoints) keep Laravel's JSON errors.
     */
    public function render($request, Throwable $e)
    {
        $response = parent::render($request, $e);

        if (!$this->rendersForBrowser($request)) {
            return $response;
        }

        $status = $response->getStatusCode();

        // CSRF token expired mid-visit: send the user back to try again
        // instead of showing an error page they can do nothing with.
        if ($status === 419 && $request->header('X-Inertia')) {
            return back()->with('error', 'The page expired, please try again.');
        }

        if (config('app.debug') || !in_array($status, self::INERTIA_ERROR_STATUSES, true)) {
            return $response;
        }

        return Inertia::render('Errors/Status', ['status' => $status])
            ->toResponse($request)
            ->setStatusCode($status);
    }

    private function rendersForBrowser(Request $request): bool
    {
        return !$request->expectsJson() && !$request->is('api/*', 'webhook/*');
    }
}
