<?php

namespace App\Console\Commands;

use App\Models\Tasks;
use App\Models\User;
use App\Services\AlertInbox;
use App\Services\FirebaseService;
use App\Services\TaskRisk;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Hourly at-risk check (replaces the unscheduled notification:task-due-alert
 * and report:daily-summary, which sent the same overdue alert over Telegram).
 *
 * For every New / In Progress task it applies TaskRisk:
 *  - newly at risk -> stamp tasks.at_risk_at
 *  - newly overdue -> set tasks.due_notify = 1
 *  - back on track (e.g. rescheduled) -> clear both, so it can alert again
 * and pushes one summary of the newly flagged tasks to every active Admin
 * and Manager. Field Reps are not notified; this is a manager view.
 */
class CheckTaskRisk extends Command
{
    protected $signature = 'tasks:check-risk {--dry-run : List what would be flagged without saving or notifying}';

    protected $description = 'Flag tasks that are at risk or overdue and alert managers';

    public function handle(): int
    {
        $now    = Carbon::now();
        $risk   = TaskRisk::fromConfig();
        $dryRun = (bool) $this->option('dry-run');

        $flagged = [];

        $tasks = Tasks::whereIn('status', TaskRisk::OPEN_STATUSES)
            ->with(['lead:id,name,business_name', 'users.user:id,name'])
            ->get();

        foreach ($tasks as $task) {
            $assessment = $risk->assessTask($task, $now);
            $changes    = [];

            if ($assessment['level'] === TaskRisk::OVERDUE) {
                if ((int) $task->due_notify === 0) {
                    $changes['due_notify'] = 1;
                    $flagged[]             = [$task, $assessment];
                }
            } elseif ($assessment['level'] === TaskRisk::AT_RISK) {
                if ($task->at_risk_at === null) {
                    $changes['at_risk_at'] = $now;
                    $flagged[]             = [$task, $assessment];
                }
                if ((int) $task->due_notify === 1) {
                    $changes['due_notify'] = 0; // rescheduled out of overdue
                }
            } else {
                if ($task->at_risk_at !== null) {
                    $changes['at_risk_at'] = null;
                }
                if ((int) $task->due_notify === 1) {
                    $changes['due_notify'] = 0;
                }
            }

            // Straight to the table: a risk flag is not an edit, so updated_at stays put.
            if (!empty($changes) && !$dryRun) {
                DB::table('tasks')->where('id', $task->id)->update($changes);
            }
        }

        $this->table(
            ['Reference', 'Title', 'Level', 'Reason'],
            array_map(fn ($row) => [$row[0]->task_reference, $row[0]->title, $row[1]['level'], $row[1]['reason']], $flagged)
        );
        $this->info(count($flagged) . ' newly flagged out of ' . $tasks->count() . ' open tasks' . ($dryRun ? ' (dry run).' : '.'));

        if (!empty($flagged) && !$dryRun) {
            $this->notifyManagers($flagged);
        }

        return self::SUCCESS;
    }

    private function notifyManagers(array $flagged): void
    {
        $total   = count($flagged);
        $overdue = count(array_filter($flagged, fn ($row) => $row[1]['level'] === TaskRisk::OVERDUE));
        $atRisk  = $total - $overdue;
        $tasks   = $total === 1 ? 'task' : 'tasks';

        // Brand voice: say what to check, calmly; details go in the body.
        $title = match (true) {
            $overdue === 0 => "{$total} at-risk {$tasks} to check",
            $atRisk === 0  => "{$total} overdue {$tasks} to check",
            default        => "{$total} {$tasks} to check ({$overdue} overdue)",
        };

        // Most urgent first: overdue, then soonest due.
        usort($flagged, fn ($a, $b) => [$a[1]['level'] === TaskRisk::OVERDUE ? 0 : 1, optional($a[1]['due_at'])->getTimestamp()]
                                    <=> [$b[1]['level'] === TaskRisk::OVERDUE ? 0 : 1, optional($b[1]['due_at'])->getTimestamp()]);

        // One plain line per task: what, where, and why it needs a look.
        // No reference numbers; the tap opens the task.
        $lines = [];
        foreach (array_slice($flagged, 0, 5) as [$task, $assessment]) {
            $outlet  = optional($task->lead)->business_name ?: optional($task->lead)->name;
            $lines[] = $task->title . ($outlet ? ' at ' . $outlet : '') . ' (' . lcfirst($assessment['reason']) . ')';
        }
        if ($total > 5) {
            $lines[] = 'Plus ' . ($total - 5) . ' more on the dashboard.';
        }

        // Tapping opens the most urgent task.
        $data = ['type' => 'task', 'id' => (string) $flagged[0][0]->id];

        $managers = User::whereIn('type', [User::TYPE_ADMIN, User::TYPE_MANAGER])
            ->where('status', 1)
            ->get();

        // Every manager's Focus alerts get it, with or without a device to push to.
        AlertInbox::record($managers, $title, implode("\n", $lines), $data);

        $managers = $managers->filter(fn (User $manager) => !empty($manager->fcm_token));
        if ($managers->isEmpty()) {
            return;
        }

        try {
            $firebase = app(FirebaseService::class);
        } catch (\Throwable $e) {
            Log::warning('tasks:check-risk: push not sent, Firebase is not configured', ['error' => $e->getMessage()]);
            return;
        }

        foreach ($managers as $manager) {
            try {
                $firebase->sendToDevice($manager->fcm_token, $title, implode("\n", $lines), $data);
            } catch (\Throwable $e) {
                Log::warning('tasks:check-risk: push failed', ['user_id' => $manager->id, 'error' => $e->getMessage()]);
            }
        }
    }
}
