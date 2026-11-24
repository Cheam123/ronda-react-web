<?php

namespace App\Console\Commands;

use App\Models\GeneralSetting;
use Illuminate\Console\Command;

class ResetTelegramPendingUpdateCount extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'telegram:reset-telegram-pending-update-count';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Reset telegram pending update count.';

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
        if (!config('telegram.enabled')) {
            $this->info('The Telegram bot is switched off.');

            return 0;
        }

        $botToken = GeneralSetting::where('key', 'telegram_api')->first()->value;
        $webhook  = GeneralSetting::where('key', 'telegram_api_webhook_url')->first()->value;
        
        // https://api.telegram.org/bot5847205589:AAFAs2F7uBykILBpj0HaoyngaH0P6A1zdRI/setWebhook?url=https://portalticket4u.shopplustech.com/webhook/telegram/callback&drop_pending_updates=true
        $botAPI   = "https://api.telegram.org/bot" . $botToken;

        sleep(1);
        file_get_contents($botAPI . "/setWebhook?url=". $webhook);
        
        $this->info('Reset telegram pending update count completed!');
    }
}
