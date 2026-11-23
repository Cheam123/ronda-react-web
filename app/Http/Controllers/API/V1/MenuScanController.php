<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Controllers\Controller;
use App\Models\Leads;
use App\Models\MenuScan;
use App\Services\Menu\MenuPhotoError;
use App\Services\Menu\MenuScanService;
use App\Services\Menu\TextractPhotoReader;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

/**
 * Menu scans from the outlet page: a menu typed or pasted in, or photos of it
 * read by Amazon Textract once it is set up. JSON endpoints the page calls
 * with axios. Anyone who can open the outlet can add one (a rep: their own outlets).
 */
class MenuScanController extends Controller
{
    public function __construct(private MenuScanService $scans)
    {
        $this->middleware('auth');
    }

    /** A menu typed in (text, one drink per line) or up to 4 photos of it (file[]). Answers with the draft to check. */
    public function store(Request $request, $id)
    {
        $lead = $this->lead($id);
        $data = $request->validate([
            'text'   => 'required_without:file|nullable|string|max:20000',
            'file'   => 'nullable|array|max:' . MenuScanService::MAX_PHOTOS,
            // Textract reads JPEG and PNG, up to 10 MB each.
            'file.*' => 'file|mimes:jpeg,jpg,png|max:10240',
        ], ['file.*.mimes' => 'Menu photos must be JPEG or PNG.']);
        $photos = array_values(array_filter((array) $request->file('file', [])));

        if ($photos !== []) {
            abort_unless(TextractPhotoReader::enabled(), 422, 'Menu photos can\'t be read here yet. Type the menu in instead.');
            try {
                $fragments = $this->scans->readPhotos($photos);
            } catch (MenuPhotoError $e) {
                abort(422, $e->getMessage() . ' Try again, or type the menu in.');
            }
            abort_if($fragments === [], 422, 'No text was read from the photos. Try a closer, sharper photo, or type the menu in.');

            $scan = $this->scans->create($lead, Auth::guard('web')->user(), $fragments, MenuScan::SOURCE_TEXTRACT, $photos);
        } else {
            $fragments = MenuScanService::fragmentsFromText((string) $data['text']);
            abort_if($fragments === [], 422, 'Type at least one line of the menu.');

            $scan = $this->scans->create($lead, Auth::guard('web')->user(), $fragments, MenuScan::SOURCE_TYPED);
        }

        return $this->response_success([
            'scan'   => $this->scans->present($scan),
            'drinks' => $this->scans->drinkOptions(),
        ]);
    }

    /** The check of a draft: items, a list of {id, kept, recipe_id}. */
    public function confirm(Request $request, MenuScan $scan)
    {
        $lead = $this->lead($scan->lead_id);
        $data = $request->validate(MenuScanService::confirmRules());

        $this->scans->confirm($scan, $data['items'] ?? []);

        return $this->response_success(['menu' => $this->scans->forLead($lead)]);
    }

    /** The outlet, if the signed-in user may open it (404 otherwise, as the page). */
    private function lead($id): Leads
    {
        $user = Auth::guard('web')->user();
        abort_unless($user->can('view_lead'), 403);

        return Leads::visibleTo($user)->findOrFail($id);
    }
}
