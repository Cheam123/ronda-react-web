<?php

namespace App\Console\Commands;

use App\Models\Leads;
use App\Services\Recommendation\Area\AmazonPlaceLookup;
use App\Services\Recommendation\Area\AreaProfiler;
use App\Services\Recommendation\Area\FallbackPlaceLookup;
use App\Services\Recommendation\Area\SeededPlaceLookup;
use Illuminate\Console\Command;

class ProfileOutletAreas extends Command
{
    protected $signature = 'area:profile
        {--lead=* : Only these lead ids (default: every outlet)}
        {--live : Look up places again on Amazon Location Service, within the configured radius, falling back to the seeded list}
        {--stale= : Only outlets never profiled, or profiled more than this many days ago}';

    protected $description = 'Work out each outlet\'s nearby places, area scores and area types';

    /** Seconds between outlets in a live run, to stay under Amazon's request rate. */
    private const LIVE_PAUSE = 1;

    private const SOURCE_NAMES = ['amazon' => 'Amazon Location', 'seeded' => 'seeded list (live lookup failed)'];

    public function handle(AreaProfiler $profiler): int
    {
        $ids   = array_filter(array_map('intval', (array) $this->option('lead')));
        $live  = (bool) $this->option('live');
        $stale = $this->option('stale') !== null ? max(0, (int) $this->option('stale')) : null;

        if ($live) {
            if (!AmazonPlaceLookup::configured()) {
                $this->error('A live lookup needs AREA_AMAZON_KEY in .env (an Amazon Location API key).');

                return self::INVALID;
            }

            $this->warn('Live lookup: outlet coordinates are sent to ' . AmazonPlaceLookup::destination() . '.');
            $profiler = new AreaProfiler(
                new FallbackPlaceLookup(AmazonPlaceLookup::fromConfig(), new SeededPlaceLookup()),
                config('ife.recommendation.area'),
            );
        }

        $counts = ['seeded' => 0, 'amazon' => 0, 'none' => 0];

        Leads::query()
            ->when($ids, fn ($query) => $query->whereIn('id', $ids))
            ->when($stale !== null, fn ($query) => $query->where(fn ($inner) => $inner
                ->whereNull('area_profiled_at')
                ->orWhere('area_profiled_at', '<', now()->subDays($stale))))
            ->select(['id', 'latitude', 'longitude', 'nearby_counts', 'area_details', 'area_source'])
            ->chunkById(200, function ($leads) use ($profiler, $live, &$counts) {
                foreach ($leads as $lead) {
                    $input = $lead->only(['latitude', 'longitude', 'nearby_counts', 'area_details', 'area_source']);

                    // A live run fetches places again; otherwise the places already found are kept.
                    $fetch = $live && $lead->latitude !== null && $lead->longitude !== null;
                    if ($fetch) {
                        $input['nearby_counts'] = null;
                        $input['area_details']  = null;
                    }

                    $profile = $profiler->profile($input);

                    Leads::withoutTimestamps(fn () => Leads::whereKey($lead->id)->update(Leads::areaColumns($profile)));

                    $counts[$profile['area_source']]++;

                    if ($fetch) {
                        $this->line(sprintf('  #%d %s', $lead->id, self::SOURCE_NAMES[$profile['area_source']] ?? $profile['area_source']));
                        sleep(self::LIVE_PAUSE);
                    }
                }
            });

        $this->info(sprintf(
            'Profiled %d outlet(s): %d with Amazon Location places, %d with seeded places, %d with none.',
            array_sum($counts),
            $counts['amazon'],
            $counts['seeded'],
            $counts['none']
        ));

        return self::SUCCESS;
    }
}
