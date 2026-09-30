<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Foundation\Auth\SendsPasswordResetEmails;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use App\Models\User;
use Inertia\Inertia;

class ForgotPasswordController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Password Reset Controller
    |--------------------------------------------------------------------------
    |
    | This controller is responsible for handling password reset emails and
    | includes a trait which assists in sending these notifications from
    | your application to your users. Feel free to explore this trait.
    |
    */

    // use SendsPasswordResetEmails;

    /**
     * Display the form to request a password reset link.
     *
     * @return \Inertia\Response
     */
    public function showLinkRequestForm()
    {
        return Inertia::render('Auth/ForgotPassword');
    }

    /**
     * Send a reset link to the given user.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\RedirectResponse|\Illuminate\Http\JsonResponse
     */
    public function sendResetLinkEmail(Request $request)
    {
        $this->validateEmail($request);

        // We will send the password reset link to this user. Once we have attempted
        // to send the link, we will examine the response then see the message we
        // need to show to the user. Finally, we'll send out a proper response.
        $response = $this->broker()->sendResetLink(
            $this->credentials($request)
        );

        return $response == Password::RESET_LINK_SENT
                    ? $this->sendResetLinkResponse($request, $response)
                    : $this->sendResetLinkFailedResponse($request, $response);
    }

    /**
     * Validate the email for the given request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return void
     */
    // protected function validateMobile(Request $request)
    // {
    //     $request->validate(['mobile' => 'required']);
    // }
    protected function validateEmail(Request $request)
    {
        $request->validate(['email' => 'required']);
    }

    /**
     * Get the needed authentication credentials from the request.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return array
     */
    protected function credentials(Request $request)
    {
        $mycredentials = ['email'=>$request->get('email')];
        return $mycredentials;
    }

    /**
     * Get the response for a successful password reset link.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  string  $response
     * @return \Illuminate\Http\RedirectResponse|\Illuminate\Http\JsonResponse
     */
    protected function sendResetLinkResponse(Request $request, $response)
    {
        return $request->wantsJson()
                    ? new JsonResponse(['message' => trans($response)], 200)
                    : back()->with('status', trans($response));
    }

    /**
     * Get the response for a failed password reset link.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  string  $response
     * @return \Illuminate\Http\RedirectResponse
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    protected function sendResetLinkFailedResponse(Request $request, $response)
    {
        if ($request->wantsJson()) {
            throw ValidationException::withMessages([
                'email' => [trans($response)],
            ]);
        }

        return back()
                ->withInput($request->only('email'))
                ->withErrors(['email' => trans($response)]);
    }

    /**
     * Get the broker to be used during password reset.
     *
     * @return \Illuminate\Contracts\Auth\PasswordBroker
     */
    public function broker()
    {
        return Password::broker();
    }

    /**
     * Send a password reset link to a mobile client.
     *
     * Same broker, same token table and same email as the web — the link in
     * that mail opens the web reset page. An app that can capture the token
     * out of the link may finish through ResetPasswordController@mobileReset
     * instead, without leaving the app.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function mobileSendResetLink(Request $request)
    {
        try {
            $this->validateEmail($request);

            // Not credentials(): that reads through $request->get(), which only
            // sees a JSON body because capture() swaps the parameter bag in.
            // input() reads the body whatever shape it arrives in.
            $response = $this->broker()->sendResetLink(
                ['email' => $request->input('email')]
            );

            // INVALID_USER and RESET_THROTTLED both land here. trans() gives
            // them the same wording the web shows, from lang/en/passwords.php.
            if ($response !== Password::RESET_LINK_SENT) {
                return $this->response_failed(trans($response));
            }

            return $this->response_ok([], trans($response));
        } catch (ValidationException $e) {
            return $this->response_failed('Validation failed.', $e->errors());
        } catch (\Throwable $e) {
            Log::error('Mobile sendResetLink failed', ['error' => $e->getMessage()]);
            return $this->response_failed('Failed to send password reset link.', $e->getMessage());
        }
    }
}
