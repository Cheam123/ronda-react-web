<?php

namespace App\Jobs;

use App\Models\Leads;
use App\Services\Recommendation\Area\AreaProfiler;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Re-profiles an outlet's area after its location changes. It is
 * dispatched after the response, so saving an outlet doesn't wait for the
 * live place lookup. Never throws: this must not break saving an outlet.
 */
class ProfileOutletArea implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public $timeout = 60;

    public function __construct(public int $leadId)
    {
        $this->afterCommit = true;
    }

    public function handle(AreaProfiler $profiler): void
    {
        try {
            $lead = Leads::find($this->leadId);
            if ($lead === null) {
                return;
            }

            // A moved outlet needs fresh places, so the old counts are not reused.
            $profile = $profiler->profile([
                'latitude'  => $lead->latitude,
                'longitude' => $lead->longitude,
            ]);

            Leads::withoutTimestamps(fn () => Leads::whereKey($lead->id)->update(Leads::areaColumns($profile)));
        } catch (\Throwable $e) {
            Log::warning('ProfileOutletArea failed', ['lead_id' => $this->leadId, 'error' => $e->getMessage()]);
        }
    }
}
