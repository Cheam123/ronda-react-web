<?php

namespace App\Http\Controllers\API\V1;

use App\Jobs\FirebaseNotification;
use Illuminate\Http\Request;
use Illuminate\Http\File;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Session;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Storage;

use App\Jobs\TelegramNotification;
use App\Http\Controllers\Controller;
use App\Http\Requests\LeadRequest;
use App\Helpers\Helper;
use App\Models\Tasks;
use App\Models\Leads;
use App\Models\States;
use App\Models\Cities;
use App\Models\User;
use App\Models\IfeArea;
use App\Models\DocumentUpload;
use App\Repositories\S3ClientRepo;
use App\Jobs\RefreshOutletRecommendations;
use App\Services\Recommendation\RecommendationService;
use App\Http\Resources\Leads\DocumentResource;
use App\Http\Resources\Leads\LeadListResource;
use App\Http\Resources\Leads\LeadResource;
use App\Http\Resources\Leads\OrderResource;
use App\Http\Resources\Leads\VisitResource;
use App\Http\Resources\Tasks\TaskSummaryResource;
use App\Support\Options;
use Inertia\Inertia;

use Carbon\Carbon;
use Throwable;

class LeadController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth');
    }

    public function index(Request $request)
    {
        if (!(Auth::guard('web')->user()->can('view_lead') || Auth::guard('web')->user()->can('edit_lead') || Auth::guard('web')->user()->can('create_lead'))) {    
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $lead_detail = Leads::with('assignee','createdBy','tasks')->visibleTo(Auth::guard('web')->user());
        $states      = States::all();
        $cities      = Cities::all();

        if ($request->get('has_customerid') == 'Y') {
            $lead_detail = $lead_detail->whereNotNull('customer_id');
        } elseif ($request->get('has_customerid') == 'N') {
            $lead_detail = $lead_detail->whereNull('customer_id');
        } else {   
        }

        if ($request->get('customer_id') !== NULL) {
            $keyword = $request->get('customer_id');
            $lead_detail = $lead_detail->where('customer_id', $keyword);
        }

        if ($request->get('mobile') !== NULL) {
            $keyword = $request->get('mobile');
            $lead_detail = $lead_detail->where('mobile', 'like', '%'.$keyword.'%');
        }

        if ($request->get('lead_name') !== NULL || $request->get('business_name') !== NULL) {
            $lead_detail = $lead_detail->where(function ($q) use ($request) {
                if ($request->get('lead_name') !== NULL) {
                    $keyword = $request->get('lead_name');
                    $q = $q->where('name', 'like', '%'.$keyword.'%');
                }

                if ($request->get('lead_name') !== NULL && $request->get('business_name') !== NULL) {
                    $keyword2 = $request->get('business_name');
                    $lead_detail = $q->orWhere('business_name', 'like', '%'.$keyword2.'%');
                } else if ($request->get('lead_name') === NULL && $request->get('business_name') !== NULL) {
                    $keyword2 = $request->get('business_name');
                    $lead_detail = $q->where('business_name', 'like', '%'.$keyword2.'%');
                }
            });
        }

        if ($request->get('ifearea') !== NULL) {
            $keyword = $request->get('ifearea');
            $lead_detail = $lead_detail->where('ife_area_id', $keyword);
        }

        if ($request->get('start') !== NULL) {
            $from = Carbon::parse($request->get('start'))->startOfDay()->format('Y-m-d 00:00:00');
            $to   = Carbon::parse($request->get('end'))->endOfDay()->format('Y-m-d 23:59:59');
            
            $lead_detail = $lead_detail->whereBetween('created_at', [$from, $to]);
        }

        $total = $lead_detail->count();
        $lead_detail = $lead_detail->orderBy('created_at','desc')
                                           ->sortable()
                                           ->paginate(10)
                                           ->withQueryString();

        $ifeareas = IfeArea::get();

        $tmenu_part1 = trans('translation.customer');
        $tmenu_part2 = trans('translation.customer');

        return Inertia::render('Leads/Index', [
            'leads'       => $lead_detail->through(fn (Leads $lead) => LeadListResource::make($lead)->resolve()),
            'ifeAreas'    => $this->areaOptions($ifeareas),
            'filters'     => $request->only(['start', 'end', 'has_customerid', 'ifearea', 'lead_name', 'business_name', 'mobile', 'customer_id']),
            'tmenu_part1' => $tmenu_part1,
            'tmenu_part2' => $tmenu_part2,
        ]);
    }

    public function view($id)
    {
        if (!Auth::guard('web')->user()->can('view_lead')) { 
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $user           = Auth::guard('web')->user();
        $customerDetail = Leads::with([
                                    'documentUploads',
                                    'visits.createdBy:id,name',
                                    'orders.lines.product',
                                    'orders.createdBy:id,name',
                                ])
                                ->visibleTo($user)
                                ->findOrFail($id);

        // Managers get a read-only copy of the rep's "Recommended" tab.
        $recommendation = null;
        if ($user->seesAllRecords()) {
            try {
                $recommendation = app(RecommendationService::class)->forLead($customerDetail);
            } catch (Throwable $e) {
                Log::warning('Lead view: recommendations unavailable', ['lead_id' => $id, 'error' => $e->getMessage()]);
            }
        }

        if ($customerDetail->state_id) {
            $states = States::where('id',$customerDetail->state_id)->get();
        } else {
            $states = States::where('id',0)->get();
        }

        if ($customerDetail->city_id) {
            $cities = Cities::where('id',$customerDetail->city_id)->get();
        } else {
            $cities = Cities::where('id',0)->get();
        }

        $ifeareas    = IfeArea::orderBy('area','asc')->get();

        $tmenu_part1 = trans('translation.customer');
        $tmenu_part2 = trans('translation.customer');
        $tmenu_part3 = trans('translation.view') . ' (' . trans('translation.id').':'.$customerDetail->id . ')';

        $customerDetail->loadMissing('tasks.lead', 'tasks.users.user', 'tasks.comments');

        return Inertia::render('Leads/Show', $this->formOptions($ifeareas, $states, $cities) + [
            'lead'           => LeadResource::make($customerDetail)->resolve(),
            'documents'      => DocumentResource::collection($customerDetail->documentUploads)->resolve(),
            'tasks'          => TaskSummaryResource::collection($customerDetail->tasks)->resolve(),
            'visits'         => VisitResource::collection($customerDetail->visits)->resolve(),
            'orders'         => OrderResource::collection($customerDetail->orders)->resolve(),
            'recommendation' => $recommendation,
            'tmenu_part1'    => $tmenu_part1,
            'tmenu_part2'    => $tmenu_part2,
            'tmenu_part3'    => $tmenu_part3,
        ]);
    }

    public function create()
    {
        if (!Auth::guard('web')->user()->can('create_lead')) { 
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $states      = States::all();
        $cities      = Cities::all();
        $ifeareas    = IfeArea::get();

        $tmenu_part1 = trans('translation.customer');
        $tmenu_part2 = trans('translation.customer');
        $tmenu_part3 = trans('translation.create');

        return Inertia::render('Leads/Create', $this->formOptions($ifeareas, $states, $cities) + [
            'today'       => now()->toDateString(),
            'tmenu_part1' => $tmenu_part1,
            'tmenu_part2' => $tmenu_part2,
            'tmenu_part3' => $tmenu_part3,
        ]);
    }

    public function store(LeadRequest $request)
    {
        if (!Auth::guard('web')->user()->can('create_lead')) { 
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $validatedData = $request->validated();

        DB::beginTransaction();
        try {
            $remark = $validatedData['remark'] ?? '';
            // $remark = self::turnUrlIntoHyperlink($remark); // only apply to ckeditor

            $lead_detail = new Leads();
            $lead_detail->receiving_date    = $validatedData['receive_date'];
            $lead_detail->business_name     = $validatedData['business_name'];
            $lead_detail->customer_id       = $validatedData['customer_id'];
            $lead_detail->name              = isset($validatedData['name']) ? ($validatedData['name']) : NULL;
            $lead_detail->belong_to         = Auth::guard('web')->user()->id;
            $lead_detail->assign_to         = NULL;
            $lead_detail->hq_checker        = Auth::guard('web')->user()->seesAllRecords() ? Auth::guard('web')->user()->id : NULL;
            $lead_detail->source            = isset($validatedData['leadsource']) ? $validatedData['leadsource'] : NULL;
            $lead_detail->business_category = isset($validatedData['businesscat']) ? $validatedData['businesscat'] : NULL;
            $lead_detail->mobile            = $validatedData['mobile'];
            $lead_detail->email             = isset($validatedData['email']) ? $validatedData['email'] : NULL;
            $lead_detail->address           = isset($validatedData['address']) ? $validatedData['address'] : NULL;
            $lead_detail->state_id          = isset($validatedData['state_id']) ? $validatedData['state_id'] : NULL;
            $lead_detail->city_id           = isset($validatedData['city_id']) ? $validatedData['city_id'] : NULL;
            $lead_detail->postcode          = isset($validatedData['postcode']) ? $validatedData['postcode'] : NULL;
            $lead_detail->ife_area_id       = isset($validatedData['ifearea']) ? $validatedData['ifearea'] : NULL;
            $lead_detail->remark            = isset($validatedData['remark']) ? $remark : NULL;

            if ($error = $this->applyOutletProfile($lead_detail, $validatedData, $request)) {
                DB::rollBack();
                return redirect()->back()->withErrors(['gps' => $error])->withInput();
            }

            $lead_detail->save();

            if (null !== $request->file('file')) {
                $this->upload($request, $lead_detail->id);
            }

            DB::commit();

            $runJobFirebase = (new FirebaseNotification($lead_detail->id, 'lead', '0'));
            dispatch($runJobFirebase);
            // $runJob = (new TelegramNotification($lead_detail->id, 'lead', '0'));
            // dispatch($runJob);
            
        } catch (Throwable $e) {

            DB::rollBack();
            alert()->error('Oops...', $e->getMessage())->showConfirmButton()->focusConfirm(true);
            return redirect()->back()->with('error', $e->getMessage());
        
        } catch (\Exception $f) {

            DB::rollBack();
            alert()->error('Oops...', $f->getMessage())->showConfirmButton()->focusConfirm(true);
            return redirect()->back()->with('error', $f->getMessage());
        }
        
        alert()->success(trans('translation.success'), trans('translation.successfully_create'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
        return redirect()->route('lead.index')->with('success', trans('translation.create_success'));
    }

    public function edit($id)
    {
        if (!Auth::guard('web')->user()->can('edit_lead')) { 
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $customerDetail = Leads::visibleTo(Auth::guard('web')->user())->findOrFail($id);

        $states = Cache::rememberForever('states', function () {
            return States::get();
        });

        $cities = Cache::rememberForever('cities', function () {
            return Cities::get();
        });

        $ifeareas    = IfeArea::get();

        $tmenu_part1 = trans('translation.customer');
        $tmenu_part2 = trans('translation.customer');
        $tmenu_part3 = trans('translation.edit') . ' (' . trans('translation.id').':'.$customerDetail->id . ')';

        return Inertia::render('Leads/Edit', $this->formOptions($ifeareas, $states, $cities) + [
            'lead'        => LeadResource::make($customerDetail)->resolve(),
            'documents'   => DocumentResource::collection($customerDetail->documentUploads()->with('uploadBy')->get())->resolve(),
            'today'       => now()->toDateString(),
            'tmenu_part1' => $tmenu_part1,
            'tmenu_part2' => $tmenu_part2,
            'tmenu_part3' => $tmenu_part3,
        ]);
    }
    
    public function update(LeadRequest $request)
    {
        if (!Auth::guard('web')->user()->can('edit_lead')) { 
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $validatedData = $request->validated();

        DB::beginTransaction();
        try {

            $remark = $validatedData['remark'] ?? '';
            // $remark = self::turnUrlIntoHyperlink($remark); // only apply to ckeditor

            $lead_detail = Leads::visibleTo(Auth::guard('web')->user())->where('id', $validatedData['id'])->lockForUpdate()->firstOrFail();
            $lead_detail->receiving_date    = $validatedData['receive_date'];
            $lead_detail->business_name     = $validatedData['business_name'];
            $lead_detail->customer_id       = $validatedData['customer_id'];
            $lead_detail->name              = isset($validatedData['name']) ? ($validatedData['name']) : NULL;
            $lead_detail->mobile            = $validatedData['mobile'];
            $lead_detail->email             = isset($validatedData['email']) ? $validatedData['email'] : NULL;
            $lead_detail->source            = isset($validatedData['leadsource']) ? $validatedData['leadsource'] : NULL;
            $lead_detail->business_category = isset($validatedData['businesscat']) ? $validatedData['businesscat'] : NULL;
            $lead_detail->address           = isset($validatedData['address']) ? $validatedData['address'] : NULL;
            $lead_detail->state_id          = isset($validatedData['state_id']) ? $validatedData['state_id'] : NULL;
            $lead_detail->city_id           = isset($validatedData['city_id']) ? $validatedData['city_id'] : NULL;
            $lead_detail->postcode          = isset($validatedData['postcode']) ? $validatedData['postcode'] : NULL;
            $lead_detail->ife_area_id       = isset($validatedData['ifearea']) ? $validatedData['ifearea'] : NULL;
            $lead_detail->remark            = isset($validatedData['remark']) ? $remark : NULL;

            if ($error = $this->applyOutletProfile($lead_detail, $validatedData, $request)) {
                DB::rollBack();
                return redirect()->back()->withErrors(['gps' => $error])->withInput();
            }

            $lead_detail->save();
            DB::commit();

            $this->refreshRecommendationsIfProfileChanged($lead_detail);

            alert()->success(trans('translation.success'), trans('translation.successfully_update'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
            return redirect()->route('lead.index')->with('success', trans('translation.update_success'));

        } catch (Throwable $e) {

            DB::rollBack();
            alert()->error('Oops...', $e->getMessage())->showConfirmButton()->focusConfirm(true);
            return redirect()->back()->with('error', $e->getMessage());
        
        } catch (\Exception $f) {

            DB::rollBack();
            alert()->error('Oops...', $f->getMessage())->showConfirmButton()->focusConfirm(true);
            return redirect()->back()->with('error', $f->getMessage());
        }
    }
    
    public function delete(Request $request)
    {
        if (!Auth::guard('web')->user()->can('edit_lead')) { 
            $response['title']      = trans('translation.access_error');
            $response['message'][0] = trans('translation.access_error_msg');
            $response['message'][1] = trans('translation.check_with_ur_superior');
            return Inertia::render('Errors/CustomError', compact('response'));
        }

        $id    = $request->id;
        $lead  = Leads::visibleTo(Auth::guard('web')->user())->findOrFail($id);
        $lead->delete();
        return redirect()->route('lead.index')->with('success', trans('translation.delete_success'));

    }

    public function fileStore(Request $request)
    {
        try {
            $data = $this->upload($request,$request->leadid);

        } catch (Throwable $e) {

            DB::rollBack();
            Log::info('Upload document process fail due to exceptional throwable : '. $e->getMessage());
            alert()->error('Upload document process fail due to exceptional throwable : ', $e->getMessage())->showConfirmButton()->focusConfirm(true);
            return redirect()->back()->with('error', $e->getMessage());
        
        } catch (\Exception $f) {

            DB::rollBack();
            Log::info('Upload document fail due to exceptional : '. $f->getMessage());
            alert()->error('Upload document fail due to exceptional : ', $f->getMessage())->showConfirmButton()->focusConfirm(true);
            return redirect()->back()->with('error', $f->getMessage());
        }

        return redirect()->back();
    }

    public function download(Request $request)
    {
        $documentUpload = DocumentUpload::where('id', $request->input('doc_id'))->first();
        if ($documentUpload) {
            ob_end_clean();
            return Storage::download($documentUpload->file_path.'/'.$documentUpload->filename);
        }
    }

    public function deleteDocument(Request $request)
    {
        $documentUpload = DocumentUpload::where('id', $request->input('doc_id'))->first();
        if ($documentUpload) {
            if (S3ClientRepo::IsExisted($documentUpload->file_path, $documentUpload->filename)) {
                S3ClientRepo::Delete($documentUpload->file_path, $documentUpload->filename);
            }
            $documentUpload->delete();
        }
       
        return redirect()->back();
    }

    /**
     * Dropdown options for the lead form.
     */
    private function formOptions($ifeareas, $states, $cities): array
    {
        return [
            'ifeAreas'           => $this->areaOptions($ifeareas),
            'states'             => Options::fromCollection($states),
            'cities'             => collect($cities)->map(fn ($city) => [
                'value'    => $city->id,
                'label'    => $city->name,
                'state_id' => $city->state_id,
            ])->values()->all(),
            'sources'            => Options::fromMap(Helper::getLeadSourceListing()),
            'businessCategories' => Options::fromMap(Helper::getBusinessCategoryListing()),
            'sizeBands'          => Options::fromMap(Leads::SIZE_BANDS),
            'segments'           => Options::fromMap(Leads::SEGMENTS),
        ];
    }

    /**
     * IFE areas as options, with their descriptions for the area listing.
     */
    private function areaOptions($ifeareas): array
    {
        return collect($ifeareas)->map(fn (IfeArea $area) => [
            'value'       => $area->id,
            'label'       => $area->area,
            'description' => $area->description,
        ])->values()->all();
    }

    /**
     * Size band, seats, segment and the captured location. Refreshes the
     * outlet's recommendations once saved if any of them changed.
     *
     * @return string|null the location's validation error
     */
    private function applyOutletProfile(Leads $lead, array $validatedData, Request $request): ?string
    {
        $lead->size_band = $validatedData['size_band'] ?? NULL;
        $lead->seats     = isset($validatedData['seats']) && $validatedData['seats'] !== '' ? (int) $validatedData['seats'] : NULL;
        $lead->segment   = $validatedData['segment'] ?? NULL;

        // The form always posts the field (prefilled with the saved stamp),
        // so an empty value really means "no location".
        if ($request->has('gps') && ($error = $lead->applyLocationStamp($request->input('gps')))) {
            return $error;
        }

        return null;
    }

    /** After a save: the outlet's recommendations follow its profile. */
    private function refreshRecommendationsIfProfileChanged(Leads $lead): void
    {
        if ($lead->wasChanged(['size_band', 'seats', 'segment', 'business_category', 'ife_area_id'])) {
            RefreshOutletRecommendations::dispatch([$lead->id]);
        }
    }

    private function upload(Request $request, $lead_id)
    {
        $files = $request->file('file');
        
        foreach($files as $file) {
            $oriname     = str_replace(' ','_', explode('.',$file->getClientOriginalName())[0]);
            $lead        = Leads::findOrFail($lead_id);
            $filename    = "{$oriname}_{$lead->id}_".time().".{$file->extension()}";
            $path        = "lead/{$lead->id}";

            Storage::putFileAs($path, new File($file), $filename);

            $documentUpload = new DocumentUpload;
            $documentUpload->lead_id         = $lead->id;
            $documentUpload->task_id         = NULL;
            $documentUpload->task_comment_id = NULL;
            $documentUpload->upload_by       = Auth::guard('web')->user()->id;
            $documentUpload->filename        = $filename;
            $documentUpload->size            = Storage::size("{$path}/{$filename}");
            $documentUpload->mime_type       = $file->getMimeType();
            $documentUpload->save();
        }        
    }

    public function turnUrlIntoHyperlink($string)
    {
        //The Regular Expression filter
        $reg_exUrl = "/(?i)\b((?:https?:\/\/|www\d{0,3}[.]|[a-z0-9.\-]+[.][a-z]{2,4}\/)(?:[^\s()<>]+|\(([^\s()<>]+|(\([^\s()<>]+\)))*\))+(?:\(([^\s()<>]+|(\([^\s()<>]+\)))*\)|[^\s`!()\[\]{};:'\".,<>?«»“”‘’]))/";
        $replace = '';

        // Check if there is a url in the text
        if(preg_match_all($reg_exUrl, $string, $url)) {
            // Loop through all matches
            foreach($url[0] as $key => $newLinks){
    
                if(strstr( $newLinks, ":" ) === false){
                    $url = 'https://'.$newLinks;
                }else{
                    $url = $newLinks;
                }
    
                // Create Search and Replace strings
                $replace .= '<a href="'.$url.'" target="_blank">'.$url.'</a>,';
                $newLinks = '/'.preg_quote($newLinks, '/').'/';
                $string = preg_replace($newLinks, '{'.$key.'}', $string, 1);
    
            }
            $arr_replace = explode(',', $replace);
            foreach ($arr_replace as $key => $link) {
                $string = str_replace('{'.$key.'}', $link, $string);
            }
        }
    
        //Return result
        return $string;
    }
}
