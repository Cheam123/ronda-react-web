<?php

namespace App\Services;

use Illuminate\Auth\Passwords\PasswordBrokerManager;
use Illuminate\Support\Str;
use App\Services\CustomDatabaseTokenRepository;

class CustomPasswordBrokerManager extends PasswordBrokerManager
{
    /**
     * Create a token repository instance based on the given configuration.
     *
     * @param  array $config
     * @return \Illuminate\Auth\Passwords\TokenRepositoryInterface
     */
    protected function createTokenRepository(array $config)
    {
        $key = $this->app['config']['app.key'];

        if (Str::startsWith($key, 'base64:')) {
            $key = base64_decode(substr($key, 7));
        }

        $connection = isset($config['connection']) ? $config['connection'] : null;

        return new CustomDatabaseTokenRepository(
            $this->app['db']->connection($connection),
            $this->app['hash'],
            $config['table'],
            $key,
            // DatabaseTokenRepository takes seconds since Laravel 12; config('auth.passwords.*.expire') is in minutes.
            ($config['expire'] ?? 60) * 60,
            $config['throttle'] ?? 0
        );
    }
}

