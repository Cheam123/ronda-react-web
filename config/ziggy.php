<?php

/*
|--------------------------------------------------------------------------
| Ziggy
|--------------------------------------------------------------------------
| Named routes the React front end may build URLs for with route(). The
| mobile API, webhooks and debug tooling are left out: the browser never
| calls them and there is no reason to publish their paths.
*/

return [
    'except' => [
        'mobile.*',
        'telegram.*',
        'debugbar.*',
        'ignition.*',
        'sanctum.*',
    ],
];
