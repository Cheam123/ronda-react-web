<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Throwable;

/**
 * The app's Focus alerts inbox: every push is also saved here, one row per
 * recipient in the `notifications` table, so it can be read later in the app.
 *
 * Saved for everyone the push is for, including people with no device token:
 * the inbox is not the same as the phone's tray. Chat pushes keep their own
 * unread-badge rows (type = the TaskComment class); inbox rows have their own
 * type, so the two never touch each other.
 */
class AlertInbox
{
    /** notifications.type of an inbox row. */
    public const TYPE = 'alert';

    /**
     * @param iterable<User|null>|User|null $users
     * @param string $title what the push said
     * @param string $body  one or two plain lines for the inbox (not always the push body)
     * @param array  $data  the push data: type (task, chat, lead, formtask, …) and id
     */
    public static function record($users, string $title, string $body, array $data = []): void
    {
        $users = $users instanceof User ? [$users] : ($users ?? []);
        $now   = now();
        $rows  = [];

        foreach ($users as $user) {
            if (!$user) {
                continue;
            }

            $rows[] = [
                'id'              => (string) Str::uuid(),
                'type'            => self::TYPE,
                'notifiable_type' => User::class,
                'notifiable_id'   => $user->id,
                'data'            => json_encode([
                    'title' => $title,
                    'body'  => $body,
                    'type'  => $data['type'] ?? null,
                    'id'    => $data['id'] ?? null,
                ], JSON_UNESCAPED_UNICODE),
                'read_at'         => null,
                'created_at'      => $now,
                'updated_at'      => $now,
            ];
        }

        if (!$rows) {
            return;
        }

        // An inbox row is a convenience: failing to save one must never stop
        // the push or the work that triggered it.
        try {
            DB::table('notifications')->insert($rows);
        } catch (Throwable $e) {
            Log::warning('AlertInbox: could not save alerts', ['error' => $e->getMessage(), 'title' => $title]);
        }
    }
}
