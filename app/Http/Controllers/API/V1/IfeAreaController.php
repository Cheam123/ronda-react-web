<?php

namespace App\Http\Controllers\API\V1;

use App\Http\Controllers\Controller;
use App\Http\Resources\Catalogue\IfeAreaResource;
use App\Models\IFEReport;
use App\Models\IfeArea;
use App\Models\Leads;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

/**
 * IFE areas (the field territories leads and visit reports are filed
 * under), Admin only. There used to be no way to add one outside the
 * database, so every area dropdown was empty on a fresh install.
 */
class IfeAreaController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth');
    }

    public function index()
    {
        if (!Auth::guard('web')->user()->can('manage_area')) {
            return $this->accessError();
        }

        $areas = IfeArea::orderBy('area')->get()->map(function (IfeArea $area) {
            $area->leads_count   = Leads::where('ife_area_id', $area->id)->count();
            $area->reports_count = IFEReport::where('ife_area', $area->id)->count();

            return $area;
        });

        $tmenu_part1 = 'IFE Areas';
        $tmenu_part2 = trans('translation.total') . ':' . $areas->count();

        return Inertia::render('Areas/Index', [
            'areas'       => IfeAreaResource::collection($areas)->resolve(),
            'tmenu_part1' => $tmenu_part1,
            'tmenu_part2' => $tmenu_part2,
        ]);
    }

    public function store(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_area')) {
            return $this->accessError();
        }

        IfeArea::create($this->validated($request));

        return redirect()->route('area.index')->with('success', 'Area added.');
    }

    public function update(Request $request, $id)
    {
        if (!Auth::guard('web')->user()->can('manage_area')) {
            return $this->accessError();
        }

        IfeArea::findOrFail($id)->update($this->validated($request, (int) $id));

        return redirect()->route('area.index')->with('success', 'Area updated.');
    }

    /** Only an area nothing is filed under can go; the rest would lose their area. */
    public function delete(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_area')) {
            return $this->accessError();
        }

        $area  = IfeArea::findOrFail($request->id);
        $inUse = Leads::withTrashed()->where('ife_area_id', $area->id)->exists()
              || IFEReport::where('ife_area', $area->id)->exists();

        if ($inUse) {
            return redirect()->route('area.index')->with('error', $area->area . ' is used by leads or visit reports and cannot be deleted. Rename it instead.');
        }

        $area->delete();

        return redirect()->route('area.index')->with('success', 'Area deleted.');
    }

    private function validated(Request $request, ?int $ignoreId = null): array
    {
        $data = $request->validate([
            'area'        => 'required|string|max:30|unique:ife_area,area' . ($ignoreId ? ',' . $ignoreId : ''),
            'description' => 'nullable|string|max:500',
        ]);

        // The column is NOT NULL; an empty description is stored as ''.
        $data['description'] = $data['description'] ?? '';

        return $data;
    }

    private function accessError()
    {
        $response['title']      = trans('translation.access_error');
        $response['message'][0] = trans('translation.access_error_msg');
        $response['message'][1] = trans('translation.check_with_ur_superior');

        return Inertia::render('Errors/CustomError', compact('response'));
    }
}
