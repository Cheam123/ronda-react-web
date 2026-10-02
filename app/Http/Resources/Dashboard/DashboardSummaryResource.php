<?php

namespace App\Http\Resources\Dashboard;

use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Carbon;

/**
 * DashboardService::summary() for the dashboard page, with its timestamps
 * formatted for display in the app's timezone.
 *
 * @property array $resource
 */
class DashboardSummaryResource extends JsonResource
{
    public function toArray($request): array
    {
        $summary = $this->resource;

        $summary['visits']['daily'] = array_map(fn (array $day) => $day + [
            'label' => Carbon::parse($day['date'])->format('D j M'),
        ], $summary['visits']['daily']);

        return array_merge($summary, [
            'generated_label' => Carbon::parse($summary['generated_at'])->format('j M Y, g:i A'),
            'time_label'      => Carbon::parse($summary['generated_at'])->format('g:i A'),
            'date_label'      => Carbon::parse($summary['generated_at'])->format('l, j F Y'),
            'trend'           => array_map(fn (array $day) => $day + [
                'label' => Carbon::parse($day['date'])->format('D j M'),
            ], $summary['trend']),
            'attention'       => array_map(fn (array $item) => $item + [
                'due_label' => $item['due_at'] ? Carbon::parse($item['due_at'])->format('j M, g:i A') : '',
            ], $summary['attention']),
        ]);
    }
}
