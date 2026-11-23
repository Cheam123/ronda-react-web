<?php

namespace App\Http\Controllers\MobileApp;

use App\Http\Controllers\Controller;
use App\Models\Leads;
use App\Models\MenuScan;
use App\Services\Menu\MenuPhotoError;
use App\Services\Menu\MenuScanService;
use App\Services\Menu\TextractPhotoReader;
use Illuminate\Http\Request;

/**
 * Menu scans from the mobile app. The phone sends the photos with its own
 * reading of them; with Amazon Textract set up the photos are read again here
 * and Textract's reading is used. The matching and the drink ideas happen here.
 */
class MenuScanController extends Controller
{
    public function __construct(private MenuScanService $scans)
    {
    }

    /**
     * The outlet's menu: its newest confirmed scan with the drink ideas, or
     * null before the first scan. reads_photos tells the scan screen whether
     * to send the photos as they are (Amazon Textract reads them here) or to
     * read them on the phone first.
     */
    public function show(Request $request)
    {
        $lead = $this->lead($request, $request->input('lead_id'));
        if (!$lead) {
            return $this->response_failed('We could not find this outlet.');
        }

        return $this->response_success([
            'menu'         => $this->scans->forLead($lead),
            'reads_photos' => TextractPhotoReader::enabled(),
        ], 'Menu retrieved successfully.');
    }

    /**
     * The outlet's drink ideas as they stand now, with or without a menu: the
     * ideas, what they were based on, the rep's answers so far and the decline
     * reasons, as the web outlet page gets them.
     */
    public function ideas(Request $request)
    {
        $lead = $this->lead($request, $request->input('lead_id'));
        if (!$lead) {
            return $this->response_failed('We could not find this outlet.');
        }

        return $this->response_success(['ideas' => $this->scans->ideasFor($lead)], 'Drink ideas retrieved successfully.');
    }

    /**
     * A new scan. Body: lead_id, fragments (a JSON list of {text, page, x, y,
     * width, height}; none when Textract reads the photos), up to 4 photos as
     * file[], and reader=phone to use the fragments over Textract. Answers with the draft
     * for the rep to check.
     */
    public function store(Request $request)
    {
        $lead = $this->lead($request, $request->input('lead_id'));
        if (!$lead) {
            return $this->response_failed('We could not find this outlet.');
        }

        $request->validate(MenuScanService::photoRules());
        $fragments = MenuScanService::fragmentsFrom($request->input('fragments'));
        $photos    = array_filter((array) $request->file('file', []));
        $source    = MenuScan::SOURCE_PHONE;

        // With Amazon Textract set up, it reads the photos: it reads menus far
        // better than the phone. The phone's own reading is the fallback, and
        // reader=phone asks for it outright (after Textract failed once).
        if ($photos !== [] && TextractPhotoReader::enabled() && $request->input('reader') !== 'phone') {
            try {
                $read = $this->scans->readPhotos($photos);
                if ($read !== []) {
                    $fragments = $read;
                    $source    = MenuScan::SOURCE_TEXTRACT;
                }
            } catch (MenuPhotoError $e) {
                if ($fragments === []) {
                    return $this->response_failed($e->getMessage() . ' Try again, or type the menu in on the web.');
                }
            }
        }

        if ($fragments === []) {
            return $this->response_failed('No text was read from the menu. Try a closer, sharper photo.');
        }

        $scan = $this->scans->create($lead, $request->user(), $fragments, $source, $photos);

        return $this->response_success([
            'scan'   => $this->scans->present($scan),
            'drinks' => $this->scans->drinkOptions(),
        ], 'Menu read.');
    }

    /** The rep's check of a draft. Body: items, a list of {id, kept, recipe_id}. Answers with the menu and its ideas. */
    public function confirm(Request $request, $id)
    {
        $scan = MenuScan::find($id);
        $lead = $scan ? $this->lead($request, $scan->lead_id) : null;
        if (!$lead) {
            return $this->response_failed('We could not find this menu scan.');
        }

        $data = $request->validate(MenuScanService::confirmRules());
        $this->scans->confirm($scan, $data['items'] ?? []);

        return $this->response_success(['menu' => $this->scans->forLead($lead)], 'Menu saved.');
    }

    /** The outlet, if the caller may open it. */
    private function lead(Request $request, $id): ?Leads
    {
        return $id ? Leads::visibleTo($request->user())->find($id) : null;
    }
}
