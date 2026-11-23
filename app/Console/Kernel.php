<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

use App\Console\Commands\ClearZipStorage;
use App\Console\Commands\ResetAppSubmitCount;

class Kernel extends ConsoleKernel
{
    /**
     * The Artisan commands provided by your application.
     *
     * @var array
     */
    protected $commands = [
        //
    ];

    /**
     * Define the application's command schedule.
     *
     * @param  \Illuminate\Console\Scheduling\Schedule  $schedule
     * @return void
     */
    protected function schedule(Schedule $schedule)
    {
        // $schedule->command('telegram:reset-telegram-pending-update-count')->dailyAt('00:35');
        // $schedule->command('user:reset-telegram-chat-id')->dailyAt('01:00');
        $schedule->command('zip:clear')->dailyAt('01:30');
        // Attachments upload before a form is submitted, so abandoning a
        // half-filled form leaves the bytes behind with nothing pointing at them.
        $schedule->command('form:clear-orphan-uploads')->dailyAt('01:45');
        $schedule->command('task:reset-submit-count')->dailyAt('02:15');
        // Morning briefing for managers on the dashboard.
        $schedule->command('digest:daily')->dailyAt('07:00');
        // Flags tasks at risk / overdue and pushes the new ones to managers.
        $schedule->command('tasks:check-risk')->hourly();
        // Nearby places change: outlets profiled over a month ago are looked up again on Amazon Location.
        // Off unless asked for, since every lookup is paid for.
        if (\App\Services\Recommendation\Area\AmazonPlaceLookup::live() && config('ife.recommendation.area.live.monthly_refresh')) {
            $schedule->command('area:profile --live --stale=30')->monthlyOn(1, '03:00');
        }
    }

    /**
     * Register the commands for the application.
     *
     * @return void
     */
    protected function commands()
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
