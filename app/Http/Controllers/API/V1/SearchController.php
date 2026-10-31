<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Controllers\Controller;
use App\Models\Leads;
use App\Models\Tasks;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * The top bar's quick find: outlets and tasks the signed-in user may open,
 * by name, shop, customer ID or mobile, and by task title or reference.
 */
class SearchController extends Controller
{
    private const PER_KIND = 6;

    /** Task statuses as the web pages word them (lib/taskStatus.ts). */
    private const STATUS = [1 => 'New', 2 => 'In progress', 3 => 'Done', 4 => 'Verified', 5 => 'Completed', 6 => 'Keep in view', 7 => 'Rejected', 8 => 'On hold'];

    public function __construct()
    {
        $this->middleware('auth');
    }

    public function __invoke(Request $request): JsonResponse
    {
        $user = Auth::guard('web')->user();
        $term = trim((string) $request->get('q', ''));

        if (mb_strlen($term) < 2) {
            return response()->json(['outlets' => [], 'tasks' => []]);
        }

        $like = '%' . addcslashes($term, '%_\\') . '%';
        // A number typed as people read it ("012-345 6789") still finds the stored digits.
        $digits = ltrim(preg_replace('/\D/', '', $term), '0');

        $outlets = $user->can('view_lead')
            ? Leads::visibleTo($user)
                ->where(function ($q) use ($like, $digits) {
                    $q->where('business_name', 'like', $like)
                      ->orWhere('name', 'like', $like)
                      ->orWhere('customer_id', 'like', $like);
                    if (strlen($digits) >= 3) {
                        $q->orWhere('mobile', 'like', '%' . $digits . '%');
                    }
                })
                ->orderByRaw('COALESCE(NULLIF(business_name, \'\'), name)')
                ->limit(self::PER_KIND)
                ->get(['id', 'name', 'business_name', 'customer_id'])
                ->map(fn (Leads $lead) => [
                    'id'    => $lead->id,
                    'title' => $lead->business_name ?: ($lead->name ?: 'Unnamed outlet'),
                    'sub'   => collect([$lead->business_name ? $lead->name : null, $lead->customer_id ?: 'Prospect'])->filter()->implode(' · '),
                    'href'  => route('lead.view', $lead->id),
                ])
            : collect();

        $tasks = $user->can('manage_task')
            ? Tasks::visibleTo($user)
                ->with('lead:id,name,business_name')
                ->where(fn ($q) => $q->where('title', 'like', $like)->orWhere('task_reference', 'like', $like))
                ->orderByDesc('id')
                ->limit(self::PER_KIND)
                ->get(['id', 'lead_id', 'title', 'task_reference', 'status'])
                ->map(fn (Tasks $task) => [
                    'id'    => $task->id,
                    'title' => $task->title,
                    'sub'   => collect([
                        $task->task_reference,
                        optional($task->lead)->business_name ?: optional($task->lead)->name,
                        self::STATUS[$task->status] ?? null,
                    ])->filter()->implode(' · '),
                    'href'  => route('tasks.view', $task->id),
                ])
            : collect();

        return response()->json(['outlets' => $outlets->values(), 'tasks' => $tasks->values()]);
    }
}
