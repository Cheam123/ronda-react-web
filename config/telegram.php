<?php

return [
    // The Telegram bot (task alerts, the chat ID page, the webhook) is off for
    // now. Off: its pages and webhook answer 404, nothing is sent, and the
    // chat ID field and "users without Telegram" to-do are hidden.
    'enabled' => (bool) env('TELEGRAM_ENABLED', false),

    'bot_token' => env('TELEGRAM_BOT_TOKEN'),
];
