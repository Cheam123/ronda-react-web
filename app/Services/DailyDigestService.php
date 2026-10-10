<?php

namespace App\Services;

use App\Models\DailyDigest;
use App\Services\Ai\ClaudeClient;
use App\Services\Ai\Voice;
use Illuminate\Support\Arr;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;

/**
 * The Morning Round-Up (the manager daily brief): today's team figures
 * (from DashboardService) turned into a short briefing by Claude on Bedrock.
 *
 * When Bedrock is not configured, or the call fails, the same figures are
 * written up by a plain template instead, so the dashboard always has one.
 * `source` on the row records which one wrote it.
 *
 * Output is plain text in a fixed shape (section labels ending in ":",
 * bullets starting "- ") that resources/views/page/dashboard renders.
 * The voice follows brand-voice.md; its AI voice block opens the prompt.
 */
class DailyDigestService
{
    private const SYSTEM = Voice::BLOCK . "\n\n" . <<<'TXT'
Here you write the Morning Round-Up: the brief managers read on the Ronda HQ dashboard before the day starts. It must be quick to scan and point at what needs their attention today.

Work only from the figures you are given; do not invent numbers, names or causes. If a figure is zero or a list is empty, say so briefly or leave it out rather than padding. Refer to people by the names in the data. Describe tasks as at risk or overdue; never blame a person. Say "outlet", not "lead". Write numbers as numerals, money as "RM 1,234.00", dates as "28 Sep 2026" and times as "2:30 PM".

Write plain text in exactly these sections, each label on its own line:
Summary:
Focus alerts:
Team:
Focus today:
Under Summary, open with a short, warm good-morning line, then write two or three sentences. Under the other labels write bullet lines starting with "- " (at most five per section). Do not use markdown symbols such as #, * or **.
TXT;

    public function __construct(
        private DashboardService $dashboard,
        private ClaudeClient $claude,
    ) {
    }

    /** Writes (or rewrites) the digest for the given day, default today. */
    public function generate(?Carbon $now = null): DailyDigest
    {
        $now   = $now ? $now->copy() : Carbon::now();
        $stats = $this->dashboard->summary(null, $now);
        $facts = $this->facts($stats);

        $content = null;
        $row     = [
            'source'        => 'template',
            'model'         => null,
            'input_tokens'  => null,
            'output_tokens' => null,
            'error'         => null,
        ];

        if ($this->claude->isConfigured()) {
            try {
                $result  = $this->claude->complete(self::SYSTEM, $this->prompt($facts, $now));
                $content = $result['text'];
                $row     = [
                    'source'        => 'bedrock',
                    'model'         => $result['model'],
                    'input_tokens'  => $result['input_tokens'],
                    'output_tokens' => $result['output_tokens'],
                    'error'         => null,
                ];
            } catch (\Throwable $e) {
                Log::warning('Daily digest: Bedrock failed, using the template', ['error' => $e->getMessage()]);
                $row['error'] = mb_substr($e->getMessage(), 0, 1000);
            }
        }

        // whereDate, not updateOrCreate: a date cast stores "Y-m-d 00:00:00",
        // which a plain string match on the day does not find on every engine.
        $digest = DailyDigest::whereDate('digest_date', $now->toDateString())->first()
               ?? new DailyDigest(['digest_date' => $now->toDateString()]);

        $digest->fill($row + [
            'content' => $content ?? $this->template($facts),
            'stats'   => $facts,
        ])->save();

        return $digest;
    }

    /** The subset of the dashboard figures the digest is written from. */
    public function facts(array $stats): array
    {
        $team = collect($stats['team'] ?? [])
            ->filter(fn ($person) => $person['open'] + $person['done_7d'] + $person['visits_7d'] + $person['forms_7d'] > 0 || $person['orders_7d'] > 0)
            // Their urgent tasks are already in `attention`; don't send them twice.
            ->map(fn ($person) => Arr::except($person, ['urgent']))
            ->values()
            ->all();

        return [
            'tasks'     => $stats['tasks'],
            'forms'     => $stats['forms'],
            'visits'    => $stats['visits'],
            'orders'    => $stats['orders'] + ['currency' => config('ife.currency', 'RM')],
            'attention' => $stats['attention'],
            'team'      => $team,
            'trend_7d'  => array_slice($stats['trend'] ?? [], -7),
        ];
    }

    private function prompt(array $facts, Carbon $now): string
    {
        return 'Today is ' . $now->format('l, j F Y') . ". Here are the team figures as JSON "
            . "(\"_7d\" means the last seven days including today; tasks in \"attention\" are overdue or at risk):\n\n"
            . json_encode($facts, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
            . "\n\nWrite today's briefing.";
    }

    /** Deterministic write-up of the same figures, used without Bedrock. */
    public function template(array $facts): string
    {
        $tasks    = $facts['tasks'];
        $currency = $facts['orders']['currency'] ?? 'RM';
        $plural   = fn (int $n, string $one, string $many) => $n . ' ' . ($n === 1 ? $one : $many);

        $lines   = [];
        $lines[] = 'Summary:';
        $lines[] = sprintf(
            'Good morning. The team has %s: %d overdue and %d at risk. In the last 7 days, %s done, with %s and %s recorded. Orders this month: %s, worth %s %s.',
            $plural($tasks['open'], 'open task', 'open tasks'), $tasks['overdue'], $tasks['at_risk'],
            $plural($tasks['done_7d'], 'task was', 'tasks were'),
            $plural($facts['visits']['last_7d'], 'visit', 'visits'), $plural($facts['forms']['submitted_7d'], 'form', 'forms'),
            $facts['orders']['month_count'], $currency, number_format($facts['orders']['month_value'], 2)
        );

        $lines[] = '';
        $lines[] = 'Focus alerts:';
        if (empty($facts['attention'])) {
            $lines[] = '- Nothing is overdue or at risk.';
        } else {
            foreach (array_slice($facts['attention'], 0, 5) as $task) {
                $lines[] = sprintf(
                    '- %s%s%s: %s.',
                    $task['title'],
                    $task['lead'] ? ' at ' . $task['lead'] : '',
                    $task['subscriber'] ? ' (' . $task['subscriber'] . ')' : '',
                    lcfirst($task['reason'])
                );
            }
        }

        $lines[] = '';
        $lines[] = 'Team:';
        $busiest = collect($facts['team'])->sortByDesc('open')->take(3);
        if ($busiest->isEmpty()) {
            $lines[] = '- No team activity recorded this week.';
        }
        foreach ($busiest as $person) {
            $lines[] = sprintf(
                '- %s: %d open (%d overdue, %d at risk), %d done and %s this week.',
                $person['name'], $person['open'], $person['overdue'], $person['at_risk'], $person['done_7d'],
                $plural($person['visits_7d'], 'visit', 'visits')
            );
        }

        $lines[] = '';
        $lines[] = 'Focus today:';
        if ($tasks['overdue'] > 0) {
            $lines[] = '- Finish or reschedule the ' . $plural($tasks['overdue'], 'overdue task', 'overdue tasks') . '.';
        }
        if ($tasks['at_risk'] > 0) {
            $lines[] = '- Check the ' . $plural($tasks['at_risk'], 'at-risk task', 'at-risk tasks') . ' today.';
        }
        if ($facts['forms']['pending'] > 0) {
            $lines[] = '- ' . $plural($facts['forms']['pending'], 'form from this week is', 'forms from this week are') . ' still waiting for a decision.';
        }
        if (end($lines) === 'Focus today:') {
            $lines[] = '- Nothing urgent. A good day for outlet rounds.';
        }

        return implode("\n", $lines);
    }
}
