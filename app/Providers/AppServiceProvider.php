<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Pagination\Paginator;
use Illuminate\Support\Collection;
use Illuminate\Pagination\LengthAwarePaginator;

use Config;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        // Menu photos the server reads: Amazon Textract (used only when MENU_READER=textract and a key is set).
        $this->app->bind(\App\Services\Menu\PhotoReader::class, \App\Services\Menu\TextractPhotoReader::class);

        // Seeded places unless the live lookup is on and Amazon Location has its key; live falls back to seeded.
        $this->app->bind(\App\Services\Recommendation\Area\PlaceLookup::class, fn () => \App\Services\Recommendation\Area\AmazonPlaceLookup::live()
            ? new \App\Services\Recommendation\Area\FallbackPlaceLookup(
                \App\Services\Recommendation\Area\AmazonPlaceLookup::fromConfig(),
                new \App\Services\Recommendation\Area\SeededPlaceLookup()
            )
            : new \App\Services\Recommendation\Area\SeededPlaceLookup());

        $this->app->bind(\App\Services\Recommendation\Area\AreaProfiler::class, fn ($app) => new \App\Services\Recommendation\Area\AreaProfiler(
            $app->make(\App\Services\Recommendation\Area\PlaceLookup::class),
            \App\Services\Recommendation\Area\IncomeTable::groups(),
            config('ife.recommendation.area'),
        ));
    }

    /**
     * Bootstrap any application services.
     *
     * @return void
     */
    public function boot()
    {
        //
        Paginator::useBootstrap();

        /**
         * Paginate a standard Laravel Collection.
         *
         * @param int $perPage
         * @param int $total
         * @param int $page
         * @param string $pageName
         * @return array
         */
        Collection::macro('paginate', function($perPage, $total = null, $page = null, $pageName = 'page') {
            $page = $page ?: LengthAwarePaginator::resolveCurrentPage($pageName);

            return new LengthAwarePaginator(
                $this->forPage($page, $perPage),
                $total ?: $this->count(),
                $perPage,
                $page,
                [
                    'path' => LengthAwarePaginator::resolveCurrentPath(),
                    'pageName' => $pageName,
                ]
            );
        });
    }
}
