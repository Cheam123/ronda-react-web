<?php

namespace App\Listeners;

use App\Events\UserCreated;
use App\Jobs\fireEmailNotification;
use App\Support\PasswordPolicy;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Hash;

class GenerateRandomPassword
{
    /**
     * Create the event listener.
     *
     * @return void
     */
    public function __construct()
    {
        //
    }

    /**
     * Handle the event.
     *
     * @param  UserCreated  $event
     * @return void
     */
    public function handle(UserCreated $event)
    {
        //
        $user = $event->user;

        // Comfortably over the password rule's floor; they can change it once signed in.
        $password = Str::random(PasswordPolicy::MIN + 2);

        $user->password = Hash::make($password);

        if (!$user->save()) {
            abort(500, 'Error saving password for user.');
        }

        $runJob = (new fireEmailNotification('1', $user, $password));
        dispatch($runJob);
    }
}
