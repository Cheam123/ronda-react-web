<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Models\Tasks;
use App\Models\TaskUsers;
use App\Models\Reminders;

use App\Models\GeneralSetting;
use App\Jobs\TelegramNotification;
use App\Helpers\Helper;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Ixudra\Curl\Facades\Curl;
use Carbon\Carbon;
use Config;
use Auth;

class TaskReminder extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'notification:task-reminder-alert';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Task Reminder Alert';

    /**
     * Create a new command instance.
     *
     * @return void
     */
    public function __construct()
    {
        parent::__construct();
    }

    /**
     * Execute the console command.
     *
     * @return int
     */
    public function handle()
    {
        // Reminders go out on Telegram, which is off for now (config telegram.enabled).
        if (!config('telegram.enabled')) {
            $this->info('The Telegram bot is switched off, so no reminders are sent.');

            return 0;
        }

        $this->info("Task Reminder: " . Carbon::now());

        $token = GeneralSetting::where('key', 'telegram_api')->first()->value;
        $start = Carbon::now()->addMinutes(-5)->format('H:i:s');
        $end   = Carbon::now()->format('H:i:s');

        $reminders = Reminders::with('user', 'task')
                                ->where('notify',0)
                                ->whereNotNull('task_id')
                                ->where('reminder_date', Carbon::now()->format('Y-m-d'))
                                ->where('reminder_time', '>=', $start)
                                ->where('reminder_time', '<=', $end)
                                ->get();

        foreach($reminders as $t) {
            $message =  
            "<b><u>Reminder</u></b> \n" .
            "Task: " . $t->task->task_reference . " \n" .
            "Title: " . $t->task->title . " \n\n" .
            "Message: \n" .
            $t->message;

            if (isset($t->user->telegram_chat_id)) {
                $url  = 'https://api.telegram.org/bot'.$token.'/sendMessage?chat_id='.$t->user->telegram_chat_id.'&text='.urlencode($message).'&parse_mode=html';
                Curl::to($url)->returnResponseObject()->get();
            }

            $t->notify = 1;
            $t->update();
        }
    }
}
