<?php

namespace Tests\Feature;

use App\Http\Middleware\TrustProxies;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Tests\TestCase;

/** The app behind CloudFront: reached over HTTP, but every link stays https. */
class BehindCloudFrontTest extends TestCase
{
    private function through(array $server): Request
    {
        $request = Request::create('http://ronda.test/login', 'GET', [], [], [], $server + ['REMOTE_ADDR' => '130.176.1.1']);
        $seen    = null;
        (new TrustProxies())->handle($request, function (Request $request) use (&$seen) {
            $seen = $request;

            return response('');
        });

        return $seen;
    }

    public function test_forwarded_headers_are_ignored_unless_proxies_are_trusted(): void
    {
        config(['app.trusted_proxies' => null]);
        $request = $this->through(['HTTP_X_FORWARDED_PROTO' => 'https', 'HTTP_X_FORWARDED_FOR' => '203.0.113.9']);

        $this->assertFalse($request->isSecure());
        $this->assertSame('130.176.1.1', $request->ip());
    }

    public function test_with_cloudfront_trusted_the_visitor_and_https_come_through(): void
    {
        config(['app.trusted_proxies' => 'REMOTE_ADDR']);
        // A visitor's own X-Forwarded-For comes first; CloudFront adds the real address last.
        $request = $this->through(['HTTP_X_FORWARDED_PROTO' => 'https', 'HTTP_X_FORWARDED_FOR' => '198.51.100.7, 203.0.113.9']);

        $this->assertTrue($request->isSecure());
        $this->assertSame('203.0.113.9', $request->ip(), 'the faked address is ignored');

        config(['app.trusted_proxies' => '10.0.0.5, 130.176.1.1']);
        $this->assertSame('203.0.113.9', $this->through(['HTTP_X_FORWARDED_FOR' => '203.0.113.9'])->ip());
    }

    public function test_an_https_app_url_makes_every_link_https(): void
    {
        config(['app.url' => 'https://ronda.example']);
        (new \App\Providers\AppServiceProvider($this->app))->boot();

        $this->assertStringStartsWith('https://', url('/login'));
        $this->assertStringStartsWith('https://', route('login'));
    }
}
