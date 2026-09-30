<?php

namespace App\Http\Controllers\Auth;

use App\Models\User;
use App\Http\Controllers\Controller;
use App\Providers\RouteServiceProvider;
use Illuminate\Foundation\Auth\AuthenticatesUsers;
use Illuminate\Session\Store;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;



class LoginController extends Controller
{
    /*
    |--------------------------------------------------------------------------
    | Login Controller
    |--------------------------------------------------------------------------
    |
    | This controller handles authenticating users for the application and
    | redirecting them to your home screen. The controller uses a trait
    | to conveniently provide its functionality to your applications.
    |
    */

    use AuthenticatesUsers;

    /**
     * Where to redirect users after login.
     *
     * @var string
     */
    protected $redirectTo = RouteServiceProvider::HOME;
    protected $session;

    /**
     * Create a new controller instance.
     *
     * @return void
     */
    public function __construct(Store $session)
    {
        $this->session = $session;
        $this->middleware('guest')->except('logout');
    }

    public function showLoginForm()
    {
        return Inertia::render('Auth/Login');
    }

    protected function authenticated()
    {
        \Auth::logoutOtherDevices(request('password'));
        return redirect('/index');
    }

    public function login(Request $request)
    {
        if ($this->hasTooManyLoginAttempts($request)) {
            $this->fireLockoutEvent($request);
            return $this->sendLockoutResponse($request);
        }

        if(Auth::attempt(['email' => $request->email, 'password' => $request->password, 'status' => 1])) {
            $user = User::where('email',$request->email)->first();
            if (null === $user->email_verified_at) {
                $user->email_verified_at = now();
            }
            $user->last_login_date = now();
            $user->save();

            $this->session->put('lastActivityTime', time());
            return $this->authenticated();
            
        }  else {
            $this->incrementLoginAttempts($request);
            $user = User::where('email',$request->email)->first();
            $message = '';

            if (isset($user) === false) {
                $message = 'Opps! You have entered invalid credentials (1).';
            } else {
                if ($user->status != 1) {
                    $message = 'Opps! Your account has been blocked (2).';
                } else {
                    $message = 'Opps! You have entered invalid credentials (3).';
                }
            }
            
            return redirect()->back()->withInput()->withErrors(['message' => $message]);
        }
    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
        return redirect('/login');
    }

    /**
     * Handle a login request to the application from a mobile client.
     * By Jayson Cheam on 3/6/2025
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\JsonResponse
     */
     public function mobileLogin(Request $request)
     {
        try {
            if (!$request->input('email') || !$request->input('password')) {
                return $this->response_ok([], 'Email and password are required');
            }

          // Attempt authentication
            if (Auth::attempt([
                    'email'     => $request->input('email'),
                    'password'  => $request->input('password'),
                    'status'    => 1
                ])) {
                    $user = User::where('email', $request->input('email'))->first();
                    
                    // Update email verification and last login
                    if (is_null($user->email_verified_at)) {
                        $user->email_verified_at = now();
                    }
                    $user->last_login_date = now();
                    $user->save();
    
                    // Generate API token
                    $token = $user->createToken('MobileAuth')->plainTextToken;
    
                    // Use response_success to include data
                    return $this->response_success([
                        'token' => $token,
                        'user'  => $user
                    ], 'Login successful');
                }
    
                // Handle failed authentication
                $user = User::where('email', $request->input('email'))->first();
                $message = $user 
                    ? ($user->status != 1 
                        ? 'Your account has been blocked'
                        : 'Invalid credentials')
                    : 'Invalid credentials';
    
                return $this->response_ok([], $message);
    
            } catch (\Exception $e) {
                return $this->response_failed('Server error: ' . $e->getMessage());
            }
     }

    /**
    * Handle a logout request to the application from a mobile client.
    * By Jayson Cheam on 3/6/2025
    * @param  \Illuminate\Http\Request  $request
    * @return \Illuminate\Http\JsonResponse
    */
    public function mobileLogout(Request $request)
    {
        try {
            $user = Auth::guard('sanctum')->user();

            if (!$user) {
                return $this->response_failed('User not authenticated');
            }

            // Get current token via the request
            $token = $user->currentAccessToken();

            if (!$token) {
                return $this->response_failed('No valid token found');
            }

            $token->delete();

            return $this->response_success([], 'Logout successful');

        } catch (\Exception $e) {
            return $this->response_failed('Server error: ' . $e->getMessage());
        }
    }
}