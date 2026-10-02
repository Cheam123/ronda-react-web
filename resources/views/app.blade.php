<!doctype html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="description" content="Ronda: your simple, reliable partner for every F&amp;B field team round.">
    <meta name="theme-color" content="#0D729E">

    <link rel="icon" href="{{ asset('assets/brand/favicon.ico') }}" sizes="any">
    <link rel="apple-touch-icon" href="{{ asset('assets/brand/apple-touch-icon.png') }}">
    <link rel="manifest" href="{{ asset('site.webmanifest') }}">

    {{-- Typefaces of the redesigned pages (resources/scss/ronda/_surface.scss). --}}
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Instrument+Sans:wght@400;500;600;700&family=Instrument+Serif&display=swap">

    @routes
    @viteReactRefresh
    @vite(['resources/js/app.tsx', "resources/js/Pages/{$page['component']}.tsx"])
    @inertiaHead
</head>
<body>
    @inertia
</body>
</html>
