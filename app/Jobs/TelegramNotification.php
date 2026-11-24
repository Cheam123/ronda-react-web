<?php

namespace App\Jobs;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Lang;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Models\Tasks;
use App\Models\Leads;
use App\Models\TaskHistory;
use App\Models\TaskComment;
use App\Models\TaskUsers;
use App\Models\DocumentUpload;
use App\Models\GeneralSetting;
use App\Models\Rating;
use App\Models\Notification as NotificationModel;
use App\Helpers\Helper;

use Ixudra\Curl\Facades\Curl;
use Config;
use Auth;

class TelegramNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public      $timeout = 120;
    protected   $mode;
    protected   $messageType;
    protected   $message;
    protected   $infoChanged;
    protected   $task;
    protected   $lead;
    protected   $chat;
    protected   $user;
    
    public function __construct($id = '0', $mode = 'test', $messageType = '', $message = '', $infoChanged = false)
    {
        $this->mode        = $mode;
        $this->message     = $message;
        $this->messageType = $messageType;

        if ($this->mode == 'test') {
            $this->user = User::findOrFail($id);

        } elseif ($this->mode == 'lead') {
            $this->lead = Leads::findOrFail($id);

        } elseif ($this->mode == 'task') {
            $this->task = Tasks::findOrFail($id);

        } elseif ($this->mode == 'chatroom') {
            $this->chat = TaskComment::findOrFail($id);
            
        } elseif ($this->mode == 'u') {
        }
    }

    // https://telegram-bot-sdk.readme.io/reference/sendaudio
    
    public function handle()
    {
        // The Telegram bot is off for now (config telegram.enabled): nothing is sent.
        if (!config('telegram.enabled')) {
            return;
        }

        $token  = GeneralSetting::where('key', 'telegram_api')->first()->value;
        $botAPI = "https://api.telegram.org/bot" . $token;

        // switch ($this->mode) {
        //     case 'test': /* Test message from backend portal */
        //         $text = "<b><u>" . Config('app.name') . "</u></b> (TEST)\n " . $this->message;

        //         if (isset($this->user)) {
        //             if (isset($this->user->telegram_chat_id)) {
        //                 $url = 'https://api.telegram.org/bot'.$token.'/sendMessage?chat_id='.$this->user->telegram_chat_id.'&text='.urlencode($text).'&parse_mode=html';
        //                 Curl::to($url)->returnResponseObject()->get();
        //             }
        //         }
        //         break;
            
        //     case 'lead': /* HQ manager will get notification */
        //         switch ($this->messageType) {
        //             case '0': /* Lead created, send telegram message to everyone in HQ */
        //                 $message  = "<b><u>New Lead</u></b>" . "\n" .
        //                             "Lead Name: " . $this->lead->name . ($this->lead->business_name ? " (" . $this->lead->business_name . ")" : "") . "\n";
        //                             if ($this->lead->business_category) {
        //                                 "Sector: " . Helper::getBusinessCategory($this->lead->business_category);
        //                             }
                        
        //                 $users = User::where('department_id',1)->where('status',1)->get();
        //                 foreach($users as $u) {
        //                     if (isset($u->telegram_chat_id)) {
        //                         if($u->type == 1) {
        //                             sleep(1);
        //                             $url  = 'https://api.telegram.org/bot'.$token.'/sendMessage?chat_id='.$u->telegram_chat_id.'&text='.urlencode($message).'&parse_mode=html';
        //                             Curl::to($url)->returnResponseObject()->get();
        //                         } else {
        //                             if(empty($this->lead->hq_checker)) {
        //                                 sleep(1);
        //                                 $url  = 'https://api.telegram.org/bot'.$token.'/sendMessage?chat_id='.$u->telegram_chat_id.'&text='.urlencode($message).'&parse_mode=html';
        //                                 Curl::to($url)->returnResponseObject()->get();
        //                             }
        //                         }
        //                     }
        //                 }
        //                 break;
        //         }
        //         break;

        //     case 'task':
        //         /**
        //          * ROLE:
        //          *  1:creator
        //          *  2:subscriber
        //          *  3:checker
        //          *  4:owner
        //          *  5:viewer
        //          *  6:sub-subscriber
        //          */
        //         if ($this->task) {
        //             switch ($this->messageType) {
        //                 case '1': /* Task created, send telegram message to creator, subscriber, sub-subscriber, owner, viewer */
        //                     $message  = "<b><u>New Sales Task</u></b>" . "\n" .
        //                                 "<b>Subscriber</b> :" . "\n" . $this->task->users->where('role',2)->first()->user->name . "\n\n";

        //                     $first = true;
        //                     if ($this->task->users->where('role',6)->count() > 0) {
        //                         foreach($this->task->users->where('role',6) as $item) {
        //                             if ($first) {
        //                                 $message = $message . "<b>Sub-Subscriber</b> :" . "\n" . $item->user->name . "\n";
        //                             } else {
        //                                 $message = $message . $item->user->name . "\n";
        //                             }
        //                             $first = false;
        //                         }
        //                         $message = $message . "\n";
        //                     }

        //                     $message  = $message  . "<b>Reference</b> :" . "\n" . $this->task->task_reference . "\n\n" .
        //                                             "<b>Title</b> :" . "\n" .$this->task->title . "\n\n" . 
        //                                             "<b>Lead Name</b> :" . "\n" . $this->task->lead->name . "\n\n";

        //                     if ($this->task->remark) {
        //                         $message  = $message  . "<b>Remark</b> :" . "\n" . $this->task->remark;
        //                     }

        //                     $ids   = array_unique($this->task->users->pluck('user_id')->toArray());
        //                     $users = User::whereIn('id',$ids)->where('status',1)->get();
                            
        //                     foreach($users as $u) {
        //                         $r = TaskUsers::where('task_id',$this->task->id)
        //                                         ->where('user_id',$u->id)
        //                                         ->first();
        //                         if ($r->role != 3) {
        //                             if (isset($u->telegram_chat_id)) {
        //                                 sleep(1);
        //                                 $url  = 'https://api.telegram.org/bot'.$token.'/sendMessage?chat_id='.$u->telegram_chat_id.'&text='.urlencode($message).'&parse_mode=html';
        //                                 Curl::to($url)->returnResponseObject()->get();
        //                             }
        //                         }
        //                     }
        //                     break;

        //                 case '2': /* Task accepted, send telegram message to creator, sub-subscriber, checker, owner, viewer */
        //                     $message  = "<b><u>Sales Task Accepted</u></b>" . "\n" .
        //                                 "<b>Subscriber</b> :" . "\n" . $this->task->users->where('role',2)->first()->user->name . "\n\n";

        //                     $first = true;
        //                     if ($this->task->users->where('role',6)->count() > 0) {
        //                         foreach($this->task->users->where('role',6) as $item) {
        //                             if ($first) {
        //                                 $message = $message . "<b>Sub-Subscriber</b> :" . "\n" . $item->user->name . "\n";
        //                             } else {
        //                                 $message = $message . $item->user->name . "\n";
        //                             }
        //                             $first = false;
        //                         }
        //                         $message = $message . "\n";
        //                     }

        //                     $message  = $message  . "<b>Reference</b> :" . "\n" . $this->task->task_reference . "\n\n" .
        //                                             "<b>Title</b> :" . "\n" .$this->task->title . "\n\n" . 
        //                                             "<b>Lead Name</b> :" . "\n" . $this->task->lead->name . "\n\n";

        //                     if ($this->task->remark) {
        //                         $message  = $message  . "<b>Remark</b> :" . "\n" . $this->task->remark;
        //                     }

        //                     $ids   = array_unique($this->task->users->pluck('user_id')->toArray());
        //                     $users = User::whereIn('id',$ids)->where('status',1)->get();

        //                     foreach($users as $u) {
        //                         $r = TaskUsers::where('task_id',$this->task->id)
        //                                     ->where('user_id',$u->id)
        //                                     ->first();
        //                         if ($r->role != 2) {
        //                             if (isset($u->telegram_chat_id)) {
        //                                 sleep(1);
        //                                 $url  = 'https://api.telegram.org/bot'.$token.'/sendMessage?chat_id='.$u->telegram_chat_id.'&text='.urlencode($message).'&parse_mode=html';
        //                                 Curl::to($url)->returnResponseObject()->get();
        //                             }
        //                         }
        //                     }
        //                     break;

        //                 case '3': /* Task done, send telegram message to creator, checker, sub-subscriber, owner, viewer */
        //                     $message  = "<b><u>Sales Task Done</u></b>" . "\n" .
        //                                 "<b>Subscriber</b> :" . "\n" . $this->task->users->where('role',2)->first()->user->name . "\n\n";

        //                     $first = true;
        //                     if ($this->task->users->where('role',6)->count() > 0) {
        //                         foreach($this->task->users->where('role',6) as $item) {
        //                             if ($first) {
        //                                 $message = $message . "<b>Sub-Subscriber</b> :" . "\n" . $item->user->name . "\n";
        //                             } else {
        //                                 $message = $message . $item->user->name . "\n";
        //                             }
        //                             $first = false;
        //                         }
        //                         $message = $message . "\n";
        //                     }

        //                     $message  = $message  . "<b>Reference</b> :" . "\n" . $this->task->task_reference . "\n\n" .
        //                                             "<b>Title</b> :" . "\n" .$this->task->title . "\n\n" . 
        //                                             "<b>Lead Name</b> :" . "\n" . $this->task->lead->name . "\n\n";

        //                     if ($this->task->remark) {
        //                         $message  = $message  . "<b>Remark</b> :" . "\n" . $this->task->remark;
        //                     }
                            
        //                     $ids   = array_unique($this->task->users->pluck('user_id')->toArray());
        //                     $users = User::whereIn('id',$ids)->where('status',1)->get();

        //                     foreach($users as $u) {
        //                         $r = TaskUsers::where('task_id',$this->task->id)
        //                                     ->where('user_id',$u->id)
        //                                     ->first();
        //                         if ($r->role != 2) {
        //                             if (isset($u->telegram_chat_id)) {
        //                                 sleep(1);
        //                                 $url  = 'https://api.telegram.org/bot'.$token.'/sendMessage?chat_id='.$u->telegram_chat_id.'&text='.urlencode($message).'&parse_mode=html';
        //                                 Curl::to($url)->returnResponseObject()->get();
        //                             }
        //                         }
        //                     }
        //                     break;

        //                 case '4': /* Task verified, send telegram message to creator, subscriber, sub-subscriber, owner, viewer */
        //                     $message  = "<b><u>Sales Task Verified</u></b>" . "\n" .
        //                                 "<b>Subscriber</b> :" . "\n" . $this->task->users->where('role',2)->first()->user->name . "\n\n";

        //                     $first = true;
        //                     if ($this->task->users->where('role',6)->count() > 0) {
        //                         foreach($this->task->users->where('role',6) as $item) {
        //                             if ($first) {
        //                                 $message = $message . "<b>Sub-Subscriber</b> :" . "\n" . $item->user->name . "\n";
        //                             } else {
        //                                 $message = $message . $item->user->name . "\n";
        //                             }
        //                             $first = false;
        //                         }
        //                         $message = $message . "\n";
        //                     }

        //                     $message  = $message  . "<b>Reference</b> :" . "\n" . $this->task->task_reference . "\n\n" .
        //                                             "<b>Title</b> :" . "\n" .$this->task->title . "\n\n" . 
        //                                             "<b>Lead Name</b> :" . "\n" . $this->task->lead->name . "\n\n";

        //                     if ($this->task->remark) {
        //                         $message  = $message  . "<b>Remark</b> :" . "\n" . $this->task->remark;
        //                     }
                            
        //                     $ids   = array_unique($this->task->users->pluck('user_id')->toArray());
        //                     $users = User::whereIn('id',$ids)->where('status',1)->get();

        //                     foreach($users as $u) {
        //                         $r = TaskUsers::where('task_id',$this->task->id)
        //                                     ->where('user_id',$u->id)
        //                                     ->first();
        //                         if ($r->role != 3) {
        //                             if (isset($u->telegram_chat_id)) {
        //                                 sleep(1);
        //                                 $url  = 'https://api.telegram.org/bot'.$token.'/sendMessage?chat_id='.$u->telegram_chat_id.'&text='.urlencode($message).'&parse_mode=html';
        //                                 Curl::to($url)->returnResponseObject()->get();
        //                             }
        //                         }
        //                     }
        //                     break;

        //                 case '5': /* Task completed, send telegram message to creator, subscriber, sub-subscriber, checker, owner, viewer */
        //                     $message  = "<b><u>Sales Task Completed</u></b>" . "\n" .
        //                                 "<b>Subscriber</b> :" . "\n" . $this->task->users->where('role',2)->first()->user->name . "\n\n";

        //                     $first = true;
        //                     if ($this->task->users->where('role',6)->count() > 0) {
        //                         foreach($this->task->users->where('role',6) as $item) {
        //                             if ($first) {
        //                                 $message = $message . "<b>Sub-Subscriber</b> :" . "\n" . $item->user->name . "\n";
        //                             } else {
        //                                 $message = $message . $item->user->name . "\n";
        //                             }
        //                             $first = false;
        //                         }
        //                         $message = $message . "\n";
        //                     }

        //                     $message  = $message  . "<b>Reference</b> :" . "\n" . $this->task->task_reference . "\n\n" .
        //                                             "<b>Title</b> :" . "\n" .$this->task->title . "\n\n" . 
        //                                             "<b>Lead Name</b> :" . "\n" . $this->task->lead->name . "\n\n";

        //                     if ($this->task->remark) {
        //                         $message  = $message  . "<b>Remark</b> :" . "\n" . $this->task->remark;
        //                     }
                            
        //                     $ids   = array_unique($this->task->users->pluck('user_id')->toArray());
        //                     $users = User::whereIn('id',$ids)->where('status',1)->get();

        //                     foreach($users as $u) {
        //                         if (isset($u->telegram_chat_id)) {
        //                             sleep(1);
        //                             $url  = 'https://api.telegram.org/bot'.$token.'/sendMessage?chat_id='.$u->telegram_chat_id.'&text='.urlencode($message).'&parse_mode=html';
        //                             Curl::to($url)->returnResponseObject()->get();
        //                         }
        //                     }

        //                     foreach($this->task->users->whereIn('role',[2,6]) as $item) {
        //                         if (isset($item->user->telegram_chat_id)) {

        //                             $rating = Rating::where('task_id',$this->task->id)->where('user_id',$item->user_id)->first();

        //                             if ($rating) {
        //                                 $message  = "<b><u>Sales Task Rating</u></b>" . "\n" .
        //                                             "<b>Role</b> :" . "\n" . ($item->role == 2 ? "Subscriber" : "Sub-Subscriber") . "\n" .
        //                                             "<b>Reference</b> :" . "\n" .$this->task->task_reference . "\n" .
        //                                             "<b>Title</b> :" . "\n" .$this->task->title . "\n\n" .
        //                                             "<b>Rate</b> :" . "\n" . $rating->rate . "\n" .
        //                                             "<b>Comment</b> :" . "\n" . $rating->comment;

        //                                 sleep(1);
        //                                 $url  = 'https://api.telegram.org/bot'.$token.'/sendMessage?chat_id='.$item->user->telegram_chat_id.'&text='.urlencode($message).'&parse_mode=html';
        //                                 Curl::to($url)->returnResponseObject()->get();
        //                             }
        //                         }
        //                     }
        //                     break;

        //                 case '6': /* Task KIV, send telegram message to creator, subscriber, sub-subscriber, checker, owner, viewer */
        //                     $message  = "<b><u>Sales Task KIV</u></b>" . "\n" .
        //                                 "<b>Subscriber</b> :" . "\n" . $this->task->users->where('role',2)->first()->user->name . "\n\n";

        //                     $first = true;
        //                     if ($this->task->users->where('role',6)->count() > 0) {
        //                         foreach($this->task->users->where('role',6) as $item) {
        //                             if ($first) {
        //                                 $message = $message . "<b>Sub-Subscriber</b> :" . "\n" . $item->user->name . "\n";
        //                             } else {
        //                                 $message = $message . $item->user->name . "\n";
        //                             }
        //                             $first = false;
        //                         }
        //                         $message = $message . "\n";
        //                     }

        //                     $message  = $message  . "<b>Reference</b> :" . "\n" . $this->task->task_reference . "\n\n" .
        //                                             "<b>Title</b> :" . "\n" .$this->task->title . "\n\n" . 
        //                                             "<b>Lead Name</b> :" . "\n" . $this->task->lead->name . "\n\n";

        //                     if ($this->task->remark) {
        //                         $message  = $message  . "<b>Remark</b> :" . "\n" . $this->task->remark;
        //                     }
                            
        //                     $ids   = array_unique($this->task->users->pluck('user_id')->toArray());
        //                     $users = User::whereIn('id',$ids)->where('status',1)->get();

        //                     foreach($users as $u) {
        //                         if (isset($u->telegram_chat_id)) {
        //                             sleep(1);
        //                             $url  = 'https://api.telegram.org/bot'.$token.'/sendMessage?chat_id='.$u->telegram_chat_id.'&text='.urlencode($message).'&parse_mode=html';
        //                             Curl::to($url)->returnResponseObject()->get();
        //                         }
        //                     }
        //                     break;

        //                 case '7': /* Task rejected, send telegram message to creator, subscriber, sub-subscriber, checker, owner, viewer */
        //                     $message  = "<b><u>Sales Task Rejected</u></b>" . "\n" .
        //                                 "<b>Subscriber</b> :" . "\n" . $this->task->users->where('role',2)->first()->user->name . "\n\n";

        //                     $first = true;
        //                     if ($this->task->users->where('role',6)->count() > 0) {
        //                         foreach($this->task->users->where('role',6) as $item) {
        //                             if ($first) {
        //                                 $message = $message . "<b>Sub-Subscriber</b> :" . "\n" . $item->user->name . "\n";
        //                             } else {
        //                                 $message = $message . $item->user->name . "\n";
        //                             }
        //                             $first = false;
        //                         }
        //                         $message = $message . "\n";
        //                     }

        //                     $message  = $message  . "<b>Reference</b> :" . "\n" . $this->task->task_reference . "\n\n" .
        //                                             "<b>Title</b> :" . "\n" .$this->task->title . "\n\n" . 
        //                                             "<b>Lead Name</b> :" . "\n" . $this->task->lead->name . "\n\n";

        //                     if ($this->task->remark) {
        //                         $message  = $message  . "<b>Remark</b> :" . "\n" . $this->task->remark;
        //                     }
                            
        //                     $ids   = array_unique($this->task->users->pluck('user_id')->toArray());
        //                     $users = User::whereIn('id',$ids)->where('status',1)->get();

        //                     foreach($users as $u) {
        //                         if (isset($u->telegram_chat_id)) {
        //                             sleep(1);
        //                             $url  = 'https://api.telegram.org/bot'.$token.'/sendMessage?chat_id='.$u->telegram_chat_id.'&text='.urlencode($message).'&parse_mode=html';
        //                             Curl::to($url)->returnResponseObject()->get();
        //                         }
        //                     }
        //                     break;

        //                 case '8': /* Task fallback, send telegram message to creator, subscriber, sub-subscriber, owner, viewer */
        //                     $message  = "<b><u>Sales Task Fallback</u></b>" . "\n" .
        //                                 "<b>Subscriber</b> :" . "\n" . $this->task->users->where('role',2)->first()->user->name . "\n\n";

        //                     $first = true;
        //                     if ($this->task->users->where('role',6)->count() > 0) {
        //                         foreach($this->task->users->where('role',6) as $item) {
        //                             if ($first) {
        //                                 $message = $message . "<b>Sub-Subscriber</b> :" . "\n" . $item->user->name . "\n";
        //                             } else {
        //                                 $message = $message . $item->user->name . "\n";
        //                             }
        //                             $first = false;
        //                         }
        //                         $message = $message . "\n";
        //                     }

        //                     $message  = $message  . "<b>Reference</b> :" . "\n" . $this->task->task_reference . "\n\n" .
        //                                             "<b>Title</b> :" . "\n" .$this->task->title . "\n\n" . 
        //                                             "<b>Lead Name</b> :" . "\n" . $this->task->lead->name . "\n\n";

        //                     if ($this->task->remark) {
        //                         $message  = $message  . "<b>Remark</b> :" . "\n" . $this->task->remark;
        //                     }
                            
        //                     $ids   = array_unique($this->task->users->pluck('user_id')->toArray());
        //                     $users = User::whereIn('id',$ids)->where('status',1)->get();

        //                     foreach($users as $u) {
        //                         $r = TaskUsers::where('task_id',$this->task->id)
        //                                     ->where('user_id',$u->id)
        //                                     ->first();
        //                         if ($r->role != 3) {
        //                             if (isset($u->telegram_chat_id)) {
        //                                 sleep(1);
        //                                 $url  = 'https://api.telegram.org/bot'.$token.'/sendMessage?chat_id='.$u->telegram_chat_id.'&text='.urlencode($message).'&parse_mode=html';
        //                                 Curl::to($url)->returnResponseObject()->get();
        //                             }
        //                         }
        //                     }
        //                     break;

        //                 case '9': /* Task detail updated, send telegram message to creator, subscriber, sub-subscriber, owner, viewer */
        //                     $message  = "<b><u>Sales Task Detail Updated</u></b>" . "\n" .
        //                                 "<b>Subscriber</b> :" . "\n" . $this->task->users->where('role',2)->first()->user->name . "\n\n";

        //                     $first = true;
        //                     if ($this->task->users->where('role',6)->count() > 0) {
        //                         foreach($this->task->users->where('role',6) as $item) {
        //                             if ($first) {
        //                                 $message = $message . "<b>Sub-Subscriber</b> :" . "\n" . $item->user->name . "\n";
        //                             } else {
        //                                 $message = $message . $item->user->name . "\n";
        //                             }
        //                             $first = false;
        //                         }
        //                         $message = $message . "\n";
        //                     }

        //                     $message  = $message  . "<b>Reference</b> :" . "\n" . $this->task->task_reference . "\n\n" .
        //                                             "<b>Title</b> :" . "\n" .$this->task->title . "\n\n" . 
        //                                             "<b>Lead Name</b> :" . "\n" . $this->task->lead->name . "\n\n";

        //                     if ($this->task->remark) {
        //                         $message  = $message  . "<b>Remark</b> :" . "\n" . $this->task->remark;
        //                     }
                            
        //                     if($this->infoChanged) {
        //                         $message  = $message . "\n\n" .
        //                                     "There is changes on subscriber, sub-subscriber, owner or viewer. Please login to the system for more information";
        //                     }

        //                     if($this->message) {
        //                         $message  = $message . "\n\n" .
        //                                 "<b>Info Update Purpose</b> :" . "\n" . $this->message;
        //                     }
                            
        //                     $ids   = array_unique($this->task->users->pluck('user_id')->toArray());
        //                     $users = User::whereIn('id',$ids)->where('status',1)->get();

        //                     foreach($users as $u) {
        //                         $r = TaskUsers::where('task_id',$this->task->id)
        //                                     ->where('user_id',$u->id)
        //                                     ->first();
        //                         if ($r->role != 3) {
        //                             if (isset($u->telegram_chat_id)) {
        //                                 sleep(1);
        //                                 $url  = 'https://api.telegram.org/bot'.$token.'/sendMessage?chat_id='.$u->telegram_chat_id.'&text='.urlencode($message).'&parse_mode=html';
        //                                 Curl::to($url)->returnResponseObject()->get();
        //                             }
        //                         }
        //                     }
        //                     break;

        //                 case '10':
        //                     $message  = "<b><u>Sales Task Deleted</u></b>" . "\n" .
        //                                 "<b>Subscriber</b> :" . "\n" . $this->task->users->where('role',2)->first()->user->name . "\n\n";

        //                     $first = true;
        //                     if ($this->task->users->where('role',6)->count() > 0) {
        //                         foreach($this->task->users->where('role',6) as $item) {
        //                             if ($first) {
        //                                 $message = $message . "<b>Sub-Subscriber</b> :" . "\n" . $item->user->name . "\n";
        //                             } else {
        //                                 $message = $message . $item->user->name . "\n";
        //                             }
        //                             $first = false;
        //                         }
        //                         $message = $message . "\n";
        //                     }

        //                     $message  = $message  . "<b>Reference</b> :" . "\n" . $this->task->task_reference . "\n\n" .
        //                                             "<b>Title</b> :" . "\n" .$this->task->title . "\n\n" . 
        //                                             "<b>Lead Name</b> :" . "\n" . $this->task->lead->name . "\n\n";

        //                     if ($this->task->remark) {
        //                         $message  = $message  . "<b>Remark</b> :" . "\n" . $this->task->remark;
        //                     }
                            
        //                     $ids   = array_unique($this->task->users->pluck('user_id')->toArray());
        //                     $users = User::whereIn('id',$ids)->where('status',1)->get();

        //                     foreach($users as $u) {
        //                         $r = TaskUsers::where('task_id',$this->task->id)
        //                                         ->where('user_id',$u->id)
        //                                         ->first();

        //                         if (isset($u->telegram_chat_id)) {
        //                             sleep(1);
        //                             $url  = 'https://api.telegram.org/bot'.$token.'/sendMessage?chat_id='.$u->telegram_chat_id.'&text='.urlencode($message).'&parse_mode=html';
        //                             Curl::to($url)->returnResponseObject()->get();
        //                         }
        //                     }

        //                     break;
        //             }
        //         }
        //         break;

        //     case 'chatroom':
        //         if ($this->chat) {
        //             switch ($this->messageType) {
        //                 case '1': // create chat message
        //                     $member = TaskUsers::where('task_id', $this->chat->task_id)->get();

        //                     $ids   = array_unique($member->pluck('user_id')->toArray());
        //                     $users = User::whereIn('id',$ids)->where('status',1)->get();

        //                     $users->each(function ($s) use ($botAPI) {
        //                         if ($s->id != $this->chat->submit_by) {
        //                             $existing_notification = NotificationModel::where([
        //                                 'notifiable_type'   => get_class($s),
        //                                 'notifiable_id'     => $s->id,
        //                                 'content_type'      => get_class($this->chat),
        //                                 'content_id'        => $this->chat->id,
        //                                 'read_at'           => null,
        //                             ])->first();

        //                             if (!$existing_notification) {
        //                                 if ($s->telegram_chat_id) {    
        //                                     $message = "\n" . "You have a new comment from _" . $this->chat->submitBy->name . "_ for below task. " . "\n\n";
        //                                     $message = $message . "__*Sales Task Reference*__ : " . "\n" . $this->chat->task->task_reference . "\n\n";
        //                                     $message = $message . "__*Lead*__ : " . "\n" . $this->chat->task->lead->name . ($this->chat->task->lead->business_name ? " (" . $this->chat->task->lead->business_name . ")" : "") . "\n\n";
        //                                     $message = $message . "__*Subscriber*__ : " . "\n" . $this->chat->task->users->where('role',2)->first()->user->name . "\n\n";

        //                                     $first = true;
        //                                     if ($this->chat->task->users->where('role',6)->count() > 0) {
        //                                         foreach($this->chat->task->users->where('role',6) as $item) {
        //                                             if ($first) {
        //                                                 $message = $message . "__*Sub-Subscriber*__ : " . "\n" . $item->user->name . "\n";
        //                                             } else {
        //                                                 $message = $message . $item->user->name . "\n";
        //                                             }
        //                                             $first = false;
        //                                         }
        //                                         $message = $message . "\n";
        //                                     }

        //                                     if (str_replace('&nbsp;','',strip_tags($this->chat->message)) == '') {
        //                                     } else {
        //                                         $message = $message . "__*Message*__ : " . "\n" . str_replace('&nbsp;','',strip_tags($this->chat->message)) . "\n\n";
        //                                     }

        //                                     // if ($this->chat->documentUploads->count() > 0) {
        //                                     //     foreach($this->chat->documentUploads as $d) {
        //                                     //         $message = $message . $d->file_full_path . "\n\n";
        //                                     //     }
        //                                     // }

        //                                     $data = http_build_query([
        //                                         'text'       => $message,
        //                                         'parse_mode' => 'Markdown',
        //                                         'chat_id'    => $s->telegram_chat_id
        //                                     ]);
            
        //                                     /* Send message */
        //                                     $response1 = file_get_contents($botAPI . "/sendMessage?{$data}");
            
        //                                     $notification = new NotificationModel();
        //                                     $notification->id               = $s->id .'-'. uniqid();
        //                                     $notification->data             = json_encode([]);
        //                                     $notification->type             = get_class($this->chat);
        //                                     $notification->notifiable_type  = get_class($s);
        //                                     $notification->notifiable_id    = $s->id;
        //                                     $notification->content_type     = get_class($this->chat);
        //                                     $notification->content_id       = $this->chat->id;
        //                                     $notification->read_at          = null;
                                            
        //                                     $info = json_decode($response1);
        //                                     $notification->telegram_send_message_id = $info->result->message_id;
        //                                     $notification->save();
        //                                 }
        //                             }
        //                         }
        //                     });
        //                     break;

        //                 case '2': // delete chat message
        //                     $member = TaskUsers::where('task_id', $this->chat->task_id)->get();

        //                     $ids   = array_unique($member->pluck('user_id')->toArray());
        //                     $users = User::whereIn('id',$ids)->where('status',1)->get();

        //                     $users->each(function ($s) use ($botAPI) {
        //                             $existing_notification = NotificationModel::where([
        //                                 'notifiable_type'   => get_class($s),
        //                                 'notifiable_id'     => $s->id,
        //                                 'content_type'      => get_class($this->chat),
        //                                 'content_id'        => $this->chat->id,
        //                                 'read_at'           => null,
        //                             ])->first();

        //                             if ($existing_notification) {
        //                                 if ($existing_notification->telegram_send_message_id) {
        //                                     $data = http_build_query([
        //                                         'message_id' => $existing_notification->telegram_send_message_id,
        //                                         'chat_id'    => $s->telegram_chat_id
        //                                     ]);

        //                                     /* Send message */
        //                                     file_get_contents($botAPI . "/deleteMessage?{$data}");

        //                                     $existing_notification->delete();
        //                                 }
        //                             }
        //                     });
        //                     break;
        //             }
        //         }
        //         break;
        // }

        // $webhook  = GeneralSetting::where('key', 'telegram_api_webhook_url')->first()->value;
        // file_get_contents($botAPI . "/setWebhook?url=". $webhook);
    }
}