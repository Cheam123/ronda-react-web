{{--
    Shared chrome for the public legal pages. Server-rendered on purpose:
    signed-out visitors and the Play Console's crawler must get the text
    without running the React app.
--}}
<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>@yield('title') | {{ config('app.name') }}</title>
    <meta name="description" content="Ronda: your simple, reliable partner for every F&amp;B field team round.">
    <meta name="theme-color" content="#0D729E">

    <link rel="icon" href="{{ asset('assets/brand/favicon.ico') }}" sizes="any">
    <link rel="apple-touch-icon" href="{{ asset('assets/brand/apple-touch-icon.png') }}">
    <link rel="manifest" href="{{ asset('site.webmanifest') }}">

    @vite('resources/scss/legal.scss')
</head>
<body>
    <div class="legal-page">
        <div class="legal-wrap">

            <img src="{{ asset('assets/brand/ronda-logo.svg') }}" alt="Ronda" class="legal-brand">

            <div class="legal-card">
                <h1>@yield('legal-heading')</h1>
                <p class="legal-effective">Last updated: 28 September 2026</p>

                @yield('legal-content')
            </div>

            <div class="legal-footer">
                <a href="{{ route('legal.privacy') }}">Privacy Policy</a>
                <span>&middot;</span>
                <a href="{{ route('legal.terms') }}">Terms of Service</a>
                <span>&middot;</span>
                <a href="{{ route('legal.accountDeletion') }}">Delete My Account</a>
            </div>

        </div>
    </div>
</body>
</html>
