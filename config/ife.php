<?php

/*
|--------------------------------------------------------------------------
| Field operations settings
|--------------------------------------------------------------------------
| Tunables for the at-risk check, suggestions and the AI features. Every value can be overridden from .env.
*/

return [

    /* Currency prefix for order values. */
    'currency' => env('APP_CURRENCY', 'RM'),

    /*
     | A New / In Progress task is "at risk" when it is not overdue yet but
     | is due within `hours`, or has used up `elapsed` of its start -> due
     | window. See App\Services\TaskRisk.
     */
    'risk' => [
        'hours'   => (float) env('TASK_RISK_HOURS', 24),
        'elapsed' => (float) env('TASK_RISK_ELAPSED', 0.75),
    ],

    /*
     | What suggestions are built from: who an outlet serves, and what is
     | around it. Drinks are tagged with the same customer groups.
     */
    'recommendation' => [
        // The 7 customer groups, keyed by area kind. Drinks are tagged with
        // them, and a rep can pick an outlet's main customers from them.
        'customer_groups' => [
            'university'  => 'Students',
            'office'      => 'Office workers',
            'residential' => 'Residents and families',
            'tourist'     => 'Tourists',
            'retail'      => 'Shoppers',
            'transit'     => 'Commuters',
            'industrial'  => 'Factory and warehouse workers',
            'recreation'  => 'Gym-goers and park visitors',
        ],

        // Menu scans: how a read menu is matched and which drinks become ideas.
        'menu' => [
            // How many drink ideas a scan gives, and the lowest score an idea may have.
            'idea_limit' => (int) env('MENU_IDEA_LIMIT', 3),
            'min_score'  => (float) env('MENU_MIN_SCORE', 0.5),
            // How much each part of an idea's score weighs. The area around the
            // outlet and what the owner told the rep count double; a part not
            // listed weighs 1.
            'weights' => ['type' => 1, 'customers' => 1, 'area' => 2, 'needs' => 2, 'price' => 1, 'easy' => 1, 'new' => 1],
            // A Declined drink stays off an outlet's ideas this long.
            'decline_days' => (int) env('MENU_DECLINE_DAYS', 90),
            // A product ordered within this many days counts as "already buys".
            'bought_days'  => (int) env('MENU_BOUGHT_DAYS', 180),
            // The middle drink price on a menu, or the rep's typical drink
            // price, in RM. Below the first is budget, above the second is
            // premium, between is mid-range.
            // These are the author's estimates for the Klang Valley.
            'price_levels' => ['budget_below' => 8, 'premium_above' => 14],
            // Who reads menu photos: "textract" (Amazon Textract on the server,
            // paid) or "phone" (Google ML Kit on the phone, free and offline).
            // With textract and its key set, every menu photo is read here,
            // from the phone or uploaded on the web; the phone's own reading is
            // used only if Textract fails. Without the key the phone reads.
            'reader' => env('MENU_READER', 'textract'),
            'textract' => [
                // An IAM user's access key allowed only textract:AnalyzeDocument.
                // Textract takes no API key of its own. Its own names, so the
                // server's AWS_ACCESS_KEY_ID (S3) stays separate.
                'key'    => env('TEXTRACT_KEY', env('AWS_ACCESS_KEY_ID')),
                'secret' => env('TEXTRACT_SECRET', env('AWS_SECRET_ACCESS_KEY')),
                'region' => env('TEXTRACT_REGION', 'ap-southeast-1'),
                // Photos read per calendar month at most, to protect the credits
                // (about USD 4 per 1,000 photos with the layout feature).
                'monthly_photos' => (int) env('TEXTRACT_MONTHLY_PHOTOS', 300),
            ],
            // Words on a menu that don't identify a drink.
            'ignored_words' => [
                'hot', 'iced', 'ice', 'cold', 'regular', 'large', 'small', 'medium',
                'panas', 'ais', 'sejuk', 'kosong', 'cup', 'and', 'with', 'the', 'of',
            ],
        ],

        'area' => [
            // An area type with at least `present_share` of the weighted places
            // around an outlet is Present, from `some_share` Some presence.
            'present_share' => 0.25,
            'some_share'    => 0.10,
            // Each place counts e^(-distance / decay_metres): 200 m away counts
            // 0.67, 1 km away 0.14. Seeded places have no distance and count 1.
            'decay_metres'  => 500,
            // How many of the nearest places are kept to show on the outlet.
            'places_kept'   => 30,

            // Live nearby places within `radius` metres from Amazon Location
            // Service, the only live source. On once AREA_AMAZON_KEY is set;
            // without it, or when Amazon can't be reached, the seeded list
            // answers. It sends outlet coordinates to Amazon.
            'live' => [
                'enabled' => (bool) env('AREA_LIVE_LOOKUP', true),
                'radius'  => (int) env('AREA_LIVE_RADIUS', 1000),
                // A monthly batch refresh of every outlet. Off: every refresh is paid for.
                'monthly_refresh' => (bool) env('AREA_LIVE_MONTHLY_REFRESH', false),
            ],

            // Amazon Location Service. The key is an
            // Amazon Location API key allowed only geo-places:SearchNearby. The
            // results are stored, so each request is charged at the Stored price
            // ($4 per 1,000 in Singapore, November 2026): 4 to 12 an outlet.
            'amazon' => [
                'key'       => env('AREA_AMAZON_KEY'),
                // Singapore and Malaysia use GrabMaps data; Singapore needs no opt-in.
                'region'    => env('AREA_AMAZON_REGION', 'ap-southeast-1'),
                'timeout'   => (int) env('AREA_AMAZON_TIMEOUT', 20),
                // Pages of 100 places for each of the 4 groups of categories.
                'max_pages' => (int) env('AREA_AMAZON_MAX_PAGES', 3),
            ],

            // Nearby place category => the area type it points to.
            'place_categories' => [
                'office_building' => 'office',
                'bank'            => 'office',
                'apartment'       => 'residential',
                'school'          => 'residential',
                'university'      => 'university',
                'college'         => 'university',
                'hostel'          => 'university',
                'hotel'           => 'tourist',
                'attraction'      => 'tourist',
                'factory'         => 'industrial',
                'warehouse'       => 'industrial',
                'mall'            => 'retail',
                'shop'            => 'retail',
                'shop_lot'        => 'retail',
                'market'          => 'retail',
                'train_station'   => 'transit',
                'bus_station'     => 'transit',
                'gym'             => 'recreation',
                'park'            => 'recreation',
                'cinema'          => 'recreation',
            ],

            // Places that sell food and drink: counted as competition, never
            // an area type, so they don't swamp the rest of the shares.
            'competitor_categories' => ['cafe', 'restaurant', 'fast_food'],

            // Area type => its name on the outlet page.
            'area_labels' => [
                'university'  => 'University',
                'residential' => 'Residential',
                'retail'      => 'Commercial',
                'office'      => 'Office',
                'tourist'     => 'Tourist',
                'transit'     => 'Transport',
                'industrial'  => 'Industrial',
                'recreation'  => 'Recreation',
            ],

            // Place category => how a person reads it.
            'place_labels' => [
                'university'      => 'University',
                'college'         => 'College',
                'hostel'          => 'Student hostel',
                'school'          => 'School',
                'apartment'       => 'Apartments',
                'office_building' => 'Office building',
                'bank'            => 'Bank',
                'hotel'           => 'Hotel',
                'attraction'      => 'Attraction',
                'factory'         => 'Factory',
                'warehouse'       => 'Warehouse',
                'mall'            => 'Shopping mall',
                'shop'            => 'Shop',
                'shop_lot'        => 'Shop lot',
                'market'          => 'Market',
                'train_station'   => 'Train station',
                'bus_station'     => 'Bus station',
                'gym'             => 'Gym or sports centre',
                'park'            => 'Park',
                'cinema'          => 'Cinema',
                'cafe'            => 'Café',
                'restaurant'      => 'Restaurant',
                'fast_food'       => 'Fast food',
            ],
        ],
    ],

    /*
     | The outlet map picker (web and phone): Amazon Location Service.
     | `map_key` loads the map tiles in the browser and the app's map page, so
     | it is visible to users: an API key allowed only geo-maps:GetTile and
     | locked to https://ronda.asia/* as a referrer. `places_key` stays on the
     | server, for searching and for the address at a pin: allowed
     | geo-places:Suggest, GetPlace and ReverseGeocode (the area lookup's key
     | works once those are ticked, so it is the default). Without map_key the
     | forms keep the plain Stamp location button.
     */
    'maps' => [
        'region'     => env('AMAZON_LOCATION_REGION', env('AREA_AMAZON_REGION', 'ap-southeast-1')),
        'map_key'    => env('AMAZON_MAP_KEY'),
        'places_key' => env('AMAZON_PLACES_KEY', env('AREA_AMAZON_KEY')),
        // Standard | Monochrome | Hybrid | Satellite
        'style'      => env('AMAZON_MAP_STYLE', 'Standard'),
        // Searches favour places near the map, and stay in Malaysia.
        'country'    => 'MYS',
        // [lng, lat] the map opens on before a pin is placed: Kuala Lumpur.
        'center'     => [101.6869, 3.1390],
        'timeout'    => (int) env('AMAZON_LOCATION_TIMEOUT', 10),
    ],

    /*
     | Claude (daily digest and the rep assistant on the outlet page). By
     | default it is called through the Claude API with a key from the Claude
     | Console (ANTHROPIC_API_KEY). Set CLAUDE_PROVIDER=bedrock to use Claude
     | on Amazon Bedrock instead, with a Bedrock API key or an access key
     | pair. Leave the credentials empty to run without AI: the features
     | then fall back to a plain template, and Ask Ronda says it is not set
     | up. `model` defaults to claude-opus-5-5 (anthropic.claude-opus-5 on
     | Bedrock). `assistant_effort` is how hard Claude thinks for the rep
     | assistant's quick answers (low | medium | high).
     */
    'claude' => [
        'enabled'    => (bool) env('CLAUDE_ENABLED', true),
        'provider'   => env('CLAUDE_PROVIDER', 'anthropic'),
        'api_key'    => env('ANTHROPIC_API_KEY'),
        'model'      => env('CLAUDE_MODEL'),
        'max_tokens' => (int) env('CLAUDE_MAX_TOKENS', 16000),

        'assistant_effort' => env('CLAUDE_ASSIST_EFFORT', 'low'),

        'bedrock' => [
            'region'  => env('BEDROCK_REGION', env('AWS_DEFAULT_REGION', 'us-east-1')),
            'api_key' => env('AWS_BEARER_TOKEN_BEDROCK'),
            'key'     => env('AWS_ACCESS_KEY_ID'),
            'secret'  => env('AWS_SECRET_ACCESS_KEY'),
            'session' => env('AWS_SESSION_TOKEN'),
        ],
    ],
];
