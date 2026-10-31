<?php

namespace App\Http\Controllers\MobileApp;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AlertInbox;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Focus alerts: the pushes the caller was sent, newest first (see AlertInbox).
 * Only inbox rows; chat badge rows in the same table are left alone.
 *
 * Read through the query builder, not the Notification model: the model
 * treats its key as an integer, which would mangle these uuid ids.
 */
class AlertController extends Controller
{
    public function index(Request $request)
    {
        $user  = $request->user();
        $limit = max(1, min((int) $request->input('per_page', 50), 100));

        $alerts = $this->mine($user)
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get()
            ->map(function ($row) {
                $data = json_decode($row->data ?? '[]', true) ?: [];

                return [
                    'id'         => $row->id,
                    'title'      => $data['title'] ?? '',
                    'body'       => $data['body'] ?? '',
                    // What a tap opens: task, chat, lead, formtask, formentry, test.
                    'type'       => $data['type'] ?? null,
                    'target_id'  => $data['id'] ?? null,
                    'read'       => $row->read_at !== null,
                    'created_at' => $row->created_at ? Carbon::parse($row->created_at)->toDateTimeString() : null,
                ];
            })
            ->values();

        return $this->response_ok([
            'alerts' => $alerts,
            'unread' => $this->mine($user)->whereNull('read_at')->count(),
        ], 'Alerts retrieved successfully.');
    }

    /** Mark some alerts read (ids[]), or all of them (all=1). */
    public function markRead(Request $request)
    {
        $request->validate([
            'ids'   => 'array',
            'ids.*' => 'string',
            'all'   => 'boolean',
        ]);

        $query = $this->mine($request->user())->whereNull('read_at');
        if (!$request->boolean('all')) {
            $ids = $request->input('ids', []);
            if (empty($ids)) {
                return $this->response_failed('Say which alerts to mark as read.');
            }
            $query->whereIn('id', $ids);
        }

        $marked = $query->update(['read_at' => now(), 'updated_at' => now()]);

        return $this->response_ok([
            'marked' => $marked,
            'unread' => $this->mine($request->user())->whereNull('read_at')->count(),
        ], 'Alerts marked as read.');
    }

    private function mine(User $user)
    {
        return DB::table('notifications')
            ->where('type', AlertInbox::TYPE)
            ->where('notifiable_type', User::class)
            ->where('notifiable_id', $user->id);
    }
}
