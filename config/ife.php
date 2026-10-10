<?php

/*
|--------------------------------------------------------------------------
| Field operations settings
|--------------------------------------------------------------------------
| Tunables for the at-risk check, the recommendation engine and the AI
| features. Every value can be overridden from .env.
*/

return [

    /* Currency prefix for order values and recommendation estimates. */
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
     | KNN + Gower product recommendations. See
     | App\Services\Recommendation\RecommendationService.
     */
    'recommendation' => [
        'k'             => (int) env('RECOMMENDATION_K', 5),
        'limit'         => (int) env('RECOMMENDATION_LIMIT', 10),
        'min_support'   => (float) env('RECOMMENDATION_MIN_SUPPORT', 0.3),
        'lookback_days' => (int) env('RECOMMENDATION_LOOKBACK_DAYS', 180),
    ],

    /*
     | Claude on Amazon Bedrock (daily digest, recommendation explanations
     | and the rep assistant on the outlet page). Leave the credentials empty
     | to run without AI: the features then fall back to a plain template,
     | and Ask Ronda says it is not set up. `api_key` is a Bedrock API key;
     | use it or the access key pair. `assistant_effort` is how hard Claude
     | thinks for the rep assistant's quick answers (low | medium | high).
     */
    'bedrock' => [
        'enabled'    => (bool) env('BEDROCK_ENABLED', true),
        'region'     => env('BEDROCK_REGION', env('AWS_DEFAULT_REGION', 'us-east-1')),
        'model'      => env('BEDROCK_MODEL_ID', 'anthropic.claude-opus-5'),
        'api_key'    => env('AWS_BEARER_TOKEN_BEDROCK'),
        'key'        => env('AWS_ACCESS_KEY_ID'),
        'secret'     => env('AWS_SECRET_ACCESS_KEY'),
        'session'    => env('AWS_SESSION_TOKEN'),
        'max_tokens' => (int) env('BEDROCK_MAX_TOKENS', 16000),

        'assistant_effort' => env('BEDROCK_ASSIST_EFFORT', 'low'),
    ],
];
