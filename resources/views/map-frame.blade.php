<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
    <meta name="robots" content="noindex">
    <title>Outlet map</title>
    {{-- The phone app's map picker shows this page in a WebView and talks to it
         through window.ReactNativeWebView (see resources/js/map-frame.ts). --}}
    <style>
        html, body, #map { margin: 0; width: 100%; height: 100%; }
        body { background: #e8eef2; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
        .map-frame__off { display: flex; align-items: center; justify-content: center; height: 100%; padding: 24px; box-sizing: border-box; color: #3b4b57; text-align: center; }
    </style>
    @if ($map)
        <script>window.RONDA_MAP = @json($map);</script>
        @vite('resources/js/map-frame.ts')
    @endif
</head>
<body>
    @if ($map)
        <div id="map"></div>
    @else
        <div class="map-frame__off">The map isn't set up yet. Use Stamp location instead.</div>
    @endif
</body>
</html>
