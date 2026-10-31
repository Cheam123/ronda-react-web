<?php

namespace App\Http\Resources\Dashboard;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * AdminDashboardService::summary() for the admin dashboard, with its dates
 * and times formatted for display in the app's timezone.
 *
 * @property array $resource
 */
class AdminDashboardResource extends JsonResource
{
    public function toArray($request): array
    {
        $summary = $this->resource;
        $now     = Carbon::parse($summary['generated_at']);

        $summary['generated_label'] = $now->format('g:i a');
        $summary['date_label']      = $now->format('l, j F Y');

        $summary['sales']['daily'] = array_map(fn (array $day) => $day + [
            'day'   => Carbon::parse($day['date'])->format('j'),
            'label' => Carbon::parse($day['date'])->format('D j M'),
        ], $summary['sales']['daily']);
        $summary['sales']['month_label'] = $now->format('F');

        $oldest = $summary['approvals']['oldest_at'];
        $summary['approvals']['oldest_label'] = $oldest ? Carbon::parse($oldest)->diffForHumans($now, ['parts' => 1, 'syntax' => Carbon::DIFF_ABSOLUTE]) : null;

        $summary['activity'] = array_map(fn (array $event) => $event + [
            'when' => $this->whenLabel(Carbon::parse($event['at']), $now),
        ], $summary['activity']);

        // "Wednesday, 30 Sep"
        $summary['missed_jobs'] = array_map(fn (array $job) => $job + [
            'last_label' => $job['last_run'] ? Carbon::parse($job['last_run'])->format('l, j M') : null,
        ], $summary['missed_jobs']);

        return $summary;
    }

    /** 7:31 am today, "Yesterday, 6:12 pm", or "28 Sep, 3:15 pm". */
    private function whenLabel(Carbon $at, Carbon $now): string
    {
        if ($at->isSameDay($now)) {
            return $at->format('g:i a');
        }

        if ($at->isSameDay($now->copy()->subDay())) {
            return 'Yesterday, ' . $at->format('g:i a');
        }

        return $at->format('j M, g:i a');
    }
}
