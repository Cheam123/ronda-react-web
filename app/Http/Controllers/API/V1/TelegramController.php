<?php

namespace App\Http\Controllers\API\V1;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use App\Support\Collection;
use App\Http\Controllers\Controller;
use App\Helpers\Helper;
use App\Models\User;
use App\Models\Client;
use App\Models\Leads;
use App\Models\Recruitment;
use App\Models\Tasks;
use App\Models\GeneralSetting;
use App\Jobs\TelegramNotification;
use Elegant\Sanitizer\Sanitizer;
use RealRashid\SweetAlert\Facades\Alert;
use Ixudra\Curl\Facades\Curl;
use Inertia\Inertia;

class TelegramController extends Controller
{
    public function callback(Request $request)
    {
        // WebHook   : https://xabaras.medium.com/setting-your-telegram-bot-webhook-the-easy-way-c7577b2d6f72
        // 1. create : https://api.telegram.org/bot{my_bot_token}/setWebhook?url={url_to_send_updates_to}
        // 2. delete : https://api.telegram.org/bot{my_bot_token}/setWebhook?url=
        // 3. info   : https://api.telegram.org/bot{my_bot_token}/getWebhookInfo

        // SPTDEV (domain : shopplustech.com)
        // 1. create : https://api.telegram.org/bot8192925571:AAFTRaClPTiJf82XlCx1CcB68V1zHkCJ3Sg/setWebhook?url=https://life.eciatto.com/webhook/telegram/callback&drop_pending_updates=true
        // 2. delete : https://api.telegram.org/bot8192925571:AAFTRaClPTiJf82XlCx1CcB68V1zHkCJ3Sg/setWebhook?url=
        // 3. info   : https://api.telegram.org/bot8192925571:AAFTRaClPTiJf82XlCx1CcB68V1zHkCJ3Sg/getWebhookInfo
        // 4.        : https://api.telegram.org/bot8192925571:AAFTRaClPTiJf82XlCx1CcB68V1zHkCJ3Sg/getWebhookUpdates

        // Note      : https://core.telegram.org/bots/samples
        //           : https://core.telegram.org/bots/api
        //           : https://pipedream.com

        // $request = file_get_contents( 'php://input' );
        // $update  = json_decode( $request, TRUE );
        
        // if( !$update ) {
        //     // Some Error output (request is not valid JSON)
        // } else if( !isset($update['update_id']) || !isset($update['message']) ) {
        //     // Some Error output (request has not message)
        // } else {
        //     $chatId  = $update['message']['chat']['id'];
        //     $message = $update['message']['text'];
        
        //     switch( $message )
        //     {
        //         // Process your message here
        //     }
        // }

        $update = json_decode(file_get_contents('php://input'), TRUE);
        Log::info('Telegram Callback Response: Start', $update);

        if (isset($update)) {

            $botToken = GeneralSetting::where('key', 'telegram_api')->first()->value;
            $botAPI   = "https://api.telegram.org/bot" . $botToken;

            if (isset($update['message'])) {

                $name    = $update['message']['chat']['first_name'] . ' ' . (isset($update['message']['chat']['last_name']) ? $update['message']['chat']['last_name'] : '');
                $chat_id = $update['message']['chat']['id'];

                if (isset($update['message']['text'])) {
                    if ($update['message']['text'] == '/register') {

                        /* Request contact info from user */
                        /* Once user click share contact, system will this phone number in the users table, then update the chat_id as telegram_chat_id for the user with this phone number. */
                        $data = http_build_query([
                            'text'       => 'Hi ' . $name . ', please send us your phone number to register at the system.',
                            'parse_mode' => 'Markdown',
                            'chat_id'    => $chat_id
                        ]);

                        /* Keyboard setup */
                        $keyboard = json_encode([
                            "keyboard" => [
                                [ /* row 1 */
                                    [ /* column 1 */
                                        "text" => "My phone number",
                                        "request_contact" => true
                                    ]
                                ]
                            ],
                            "one_time_keyboard" => true,
                            "resize_keyboard" => true
                        ]);

                        /* Send keyboard */
                        file_get_contents($botAPI . "/sendMessage?{$data}&reply_markup={$keyboard}");
                    
                    }
                }

                // Update User Telegram Chat Id into database
                if (isset($update['message']['contact'])) {

                    $contact = $update['message']['contact']['phone_number'];
                    $contact = substr($contact, 0, 1) != '6' ? $contact : substr($contact, 1, strlen($contact)-1);
                    $users   = User::where('mobile', $contact)
                                    ->where('status', 1)
                                    ->get();

                    if ($users->count() > 0) {

                        $users->each(function ($u) use ($chat_id) {
                            $u->telegram_chat_id = $chat_id;
                            $u->save();
                        });

                        $data = http_build_query([
                            'text'       => 'Hi ' . $name . ', you have successfully register your telegram account.',
                            'parse_mode' => 'Markdown',
                            'chat_id'    => $chat_id
                        ]);
                        file_get_contents($botAPI . "/sendMessage?{$data}");

                    } else {  
                        
                        $data = http_build_query([
                            'text'       => 'Hi ' . $name . ', kindly inform your HR to update your mobile phone into the system before you proceed on the telegram register process.',
                            'parse_mode' => 'Markdown',
                            'chat_id'    => $chat_id
                        ]);
                        file_get_contents($botAPI . "/sendMessage?{$data}");
                    }

                }
            }

            $webhook  = GeneralSetting::where('key', 'telegram_api_webhook_url')->first()->value;
            file_get_contents($botAPI . "/setWebhook?url=". $webhook);
            
            Log::info('Telegram Callback Response: End', []);

            return response()->json([], 200);
        }
    }

    public function unauthorize($botAPI, $chat_id)
    {
        $data = http_build_query([
            'text'       => 'You do not have the authority on this request.',
            'parse_mode' => 'Markdown',
            'chat_id'    => $chat_id
        ]);
        file_get_contents($botAPI . "/sendMessage?{$data}");
    }

    public function telegram_test(Request $request) 
    {
        $mode = GeneralSetting::where('key','simulate_telegram_message')->first()->value;
        if ($mode == 0) {

            $runJob = (new TelegramNotification($request->id, 'test', '', $request->msg['value']));
            dispatch($runJob);

        } else {

            $tm = TaskComment::where('id',$mode)->first()->message;
            $runJob = (new TelegramNotification($request->id, 'test', '', strip_tags($tm)));
            dispatch($runJob);
        }

        alert()->success(trans('translation.success'), trans('translation.please_verify'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
        return redirect()->back();
    }

    public function turn_on_telegram_webhook(Request $request) 
    {
        $token   = GeneralSetting::where('key', 'telegram_api')->first()->value;
        $botAPI  = "https://api.telegram.org/bot" . $token;
        $webhook = GeneralSetting::where('key', 'telegram_api_webhook_url')->first()->value;
        file_get_contents($botAPI . "/setWebhook?url=". $webhook);

        alert()->success('Telegram Webhook Turn On')->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
        return redirect()->back();
    }

    public function turn_off_telegram_webhook(Request $request) 
    {
        $token  = GeneralSetting::where('key', 'telegram_api')->first()->value;
        $botAPI = "https://api.telegram.org/bot" . $token;

        file_get_contents($botAPI . "/setWebhook?url=");

        alert()->success('Telegram Webhook Turn Off')->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
        return redirect()->back();
    }

    public function telegram_message() 
    {
        $i           = 0;
        $data        = [];
        $token       = GeneralSetting::where('key', 'telegram_api')->first()->value;
        $url         = 'https://api.telegram.org/bot'.$token.'/getUpdates';
        $response    = Curl::to($url)->returnResponseObject()->get();
        $parsed_json = json_decode($response->content);

        if (isset($parsed_json->result)) {
            if (count($parsed_json->result) > 0) {
                krsort($parsed_json->result);
                foreach ($parsed_json->result as $item) {
                    if (isset($item->message)) {
                        $data[$i]['name']       = $item->message->chat->first_name . ' ' . (isset($item->message->chat->last_name) ? $item->message->chat->last_name : '');
                        $data[$i]['chat_id']    = $item->message->chat->id;
                        $data[$i]['date']       = date('Y M d h:i:s A', $item->message->date);
                        $data[$i]['text']       = isset($item->message->text) ? $item->message->text : (isset($item->message->sticker->file_id) ? $item->message->sticker->file_id : '');
                        $i = $i+1;
                    }
                }
            }
        }

        $collection  = (new Collection($data));
        $tmenu_part1 = 'Telegrame Chat ID';

        return Inertia::render('Telegram/Index', [
            'messages'    => $collection->values()->all(),
            'tmenu_part1' => $tmenu_part1,
        ]);
    }
}
