<?php

namespace App\Http\Middleware;

use Illuminate\Http\Middleware\TrustProxies as Middleware;
use Illuminate\Http\Request;

class TrustProxies extends Middleware
{
    /**
     * The trusted proxies for this application.
     *
     * @var array<int, string>|string|null
     */
    protected $proxies;

    /**
     * The headers that should be used to detect proxies.
     *
     * @var int
     */
    protected $headers = Request::HEADER_X_FORWARDED_FOR | Request::HEADER_X_FORWARDED_HOST | Request::HEADER_X_FORWARDED_PORT | Request::HEADER_X_FORWARDED_PROTO | Request::HEADER_X_FORWARDED_AWS_ELB;

    /**
     * The proxies from config app.trusted_proxies (TRUSTED_PROXIES), as the
     * framework reads them. Behind CloudFront use REMOTE_ADDR: only the
     * caller (CloudFront) is trusted, so the visitor's address is the one
     * CloudFront adds last and a visitor's own X-Forwarded-For can't fake it.
     * Avoid "*": it trusts every address in the header. Empty: no proxies,
     * so X-Forwarded-* headers are ignored.
     *
     * @return array<int, string>|string|null
     */
    protected function proxies()
    {
        $configured = trim((string) config('app.trusted_proxies'));

        return $configured !== '' ? $configured : parent::proxies();
    }
}
