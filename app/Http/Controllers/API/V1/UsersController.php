<?php

namespace App\Http\Controllers\API\V1;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;

use App\Models\User;
use App\Http\Requests\UserRequest;
use App\Http\Requests\ChangePasswordRequest;
use App\Http\Controllers\Controller;
use App\Http\Resources\Users\UserResource;
use App\Helpers\Helper;
use App\Support\Options;
use Inertia\Inertia;

class UsersController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth');
    }

    public function index(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_user')) {
            return $this->accessError();
        }

        $users = User::whereNotIn('id',[1]);

        if ($request->get('user_type') !== NULL) {
            $users = $users->where('type', $request->get('user_type'));
        }
        // One box for the name, username, email or mobile.
        if ($request->filled('search')) {
            $keyword = '%'.$request->get('search').'%';
            // A number typed as people read it ("012-345 6789") still finds the stored digits.
            $digits = ltrim(preg_replace('/\D/', '', $request->get('search')), '0');
            $users = $users->where(function ($q) use ($keyword, $digits) {
                $q->where('name', 'like', $keyword)
                  ->orWhere('username', 'like', $keyword)
                  ->orWhere('email', 'like', $keyword)
                  ->orWhere('mobile', 'like', $keyword);
                if (strlen($digits) >= 3) {
                    $q->orWhere('mobile', 'like', '%'.$digits.'%');
                }
            });
        }
        if (!empty($request->get('name'))) {
            $users = $users->where('name', 'like' ,'%'.$request->get('name').'%');
        }
        if (!empty($request->get('mobile'))) {
            $users = $users->where('mobile', 'like' ,'%'.$request->get('mobile').'%');
        }
        if (!empty($request->get('email'))) {
            $users = $users->where('email', 'like' ,'%'.$request->get('email').'%');
        }

        // The status buttons count what the other filters leave.
        $counts = [
            'active'   => (clone $users)->where('status', 1)->count(),
            'inactive' => (clone $users)->where('status', '!=', 1)->count(),
            'all'      => (clone $users)->count(),
        ];

        // Active (1), Inactive (anything else, normally 0) or all; active unless asked.
        $status = in_array($request->get('active'), ['1', '2', 'all'], true) ? $request->get('active') : '1';
        $request->merge(['active' => $status]);
        if ($status === '1') {
            $users = $users->where('status', 1);
        } elseif ($status === '2') {
            $users = $users->where('status', '!=', 1);
        }

        $users = $users->orderBy('name','asc')->get();

        return Inertia::render('Users/Index', [
            'users'     => UserResource::collection($users)->resolve(),
            'counts'    => $counts,
            'filters'   => $request->only(['active', 'user_type', 'search', 'name', 'mobile', 'email']),
            'userTypes' => Options::fromMap(User::getUserTypeListing()),
        ]);
    }

    public function view($id)
    {
        if (!Auth::guard('web')->user()->can('manage_user')) {
            return $this->accessError();
        }

        $user        = User::findOrFail($id);
        $tmenu_part1 = trans('translation.Users');
        $tmenu_part2 = trans('translation.Users');
        $tmenu_part3 = trans('translation.view') . ' (' . trans('translation.id').':'.$user->id . ')';

        return Inertia::render('Users/Show', [
            'user'        => UserResource::make($user)->resolve(),
            'tmenu_part1' => $tmenu_part1,
            'tmenu_part2' => $tmenu_part2,
            'tmenu_part3' => $tmenu_part3,
        ]);
    }

    public function create()
    {
        if (!Auth::guard('web')->user()->can('manage_user')) {
            return $this->accessError();
        }

        $tmenu_part1 = trans('translation.Users');
        $tmenu_part2 = trans('translation.Users');
        $tmenu_part3 = trans('translation.create');

        return Inertia::render('Users/Create', $this->formOptions() + compact('tmenu_part1', 'tmenu_part2', 'tmenu_part3'));
    }

    public function store(UserRequest $request)
    {
        if (!Auth::guard('web')->user()->can('manage_user')) {
            return $this->accessError();
        }

        if ($this->isDuplicate($request)) {
            alert()->error('Oops...', trans('translation.duplicate_record'))->showConfirmButton()->focusConfirm(true);
            return redirect()->back()->with('error', trans('translation.duplicate_record'))->withInput();
        }

        DB::beginTransaction();
        try {
            $validatedData = $request->validated();

            $user = User::create([
                'name'                => $validatedData['name'],
                'telegram_chat_id'    => $validatedData['telegram_chat_id'] ?? NULL,
                'email'               => $validatedData['email'],
                'team'                => $validatedData['team'],
                'gender'              => $validatedData['gender'],
                'type'                => $validatedData['type'],
                'mobile'              => Helper::reformat_mobile($validatedData['mobile']),
                'status'              => $validatedData['statuss'],
                'enable_notification' => $request['enable_notification'] ?? 0,
            ]);

            // Staff ID, e.g. U00012. Login is by email; this is for display.
            $user->username = sprintf('U%05d', $user->id);
            $user->save();

            DB::commit();

        } catch (\Throwable $e) {

            DB::rollBack();
            alert()->error('Oops...', $e->getMessage())->showConfirmButton()->focusConfirm(true);
            return redirect()->back()->with('error', $e->getMessage())->withInput();
        }

        alert()->success(trans('translation.success'), trans('translation.successfully_create'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
        return redirect()->route('users.index')->with('success', trans('translation.create_success'));
    }

    public function edit($id)
    {
        if (!Auth::guard('web')->user()->can('manage_user')) {
            return $this->accessError();
        }

        $user        = User::findOrFail($id);
        $tmenu_part1 = trans('translation.Users');
        $tmenu_part2 = trans('translation.Users');
        $tmenu_part3 = trans('translation.edit') . ' (' . trans('translation.id').':'.$user->id . ')';

        return Inertia::render('Users/Edit', $this->formOptions() + [
            'user'        => UserResource::make($user)->resolve(),
            'tmenu_part1' => $tmenu_part1,
            'tmenu_part2' => $tmenu_part2,
            'tmenu_part3' => $tmenu_part3,
        ]);
    }

    public function update(UserRequest $request)
    {
        if (!Auth::guard('web')->user()->can('manage_user')) {
            return $this->accessError();
        }

        if ($this->isDuplicate($request, $request->id)) {
            alert()->error('Oops...', trans('translation.duplicate_record'))->showConfirmButton()->focusConfirm(true);
            return redirect()->back()->with('error', trans('translation.duplicate_record'))->withInput();
        }

        $validatedData = $request->validated();

        $user = User::findOrFail($request->id);
        $user->update([
            'name'                => $validatedData['name'],
            'telegram_chat_id'    => $validatedData['telegram_chat_id'] ?? NULL,
            'email'               => $validatedData['email'],
            'team'                => $validatedData['team'],
            'gender'              => $validatedData['gender'],
            'type'                => $validatedData['type'],
            'mobile'              => Helper::reformat_mobile($validatedData['mobile']),
            'status'              => $validatedData['statuss'],
            'enable_notification' => $request['enable_notification'] ?? 0,
        ]);

        alert()->success(trans('translation.success'), trans('translation.successfully_update'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
        return redirect()->route('users.index')->with('success', trans('translation.update_success'));
    }

    public function delete(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_user')) {
            return $this->accessError();
        }

        $user = User::findOrFail($request->id);

        // Free the unique email/mobile so they can be reused by a new account.
        $user->update([
            'email'  => $user->email.'@deleted'.$user->id,
            'mobile' => $user->mobile.'@deleted'.$user->id
        ]);
        $user->delete();

        alert()->success(trans('translation.success'), trans('translation.successfully_delete'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
        return redirect()->route('users.index')->with('success', trans('translation.delete_success'));
    }

    public function profile()
    {
        $user = Auth::guard('web')->user();
        return Inertia::render('Users/Profile', ['user' => UserResource::make($user)->resolve()]);
    }

    public function change_password()
    {
        return Inertia::render('Users/ChangePassword');
    }

    public function reset_password(Request $request)
    {
        if (!Auth::guard('web')->user()->can('manage_user')) {
            return $this->accessError();
        }

        $data     = $request->all();
        $password = $data['pwd'];
        $hashed   = Hash::make($password);

        $usr = User::findOrFail($data['id']);
        $usr->password = $hashed;
        $usr->update();

        alert()->success(trans('translation.success'), trans('translation.successfully_update'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
        return redirect()->back()->withInput();
    }

    public function update_password(ChangePasswordRequest $request)
    {
        $validatedData = $request->validated();

        $user = Auth::guard('web')->user();
        if (Hash::check($request->oldpass, $user->password)) {

            $password = $validatedData['pass1'];
            $hashed = Hash::make($password);

            $usr = User::findOrFail($user->id);
            $usr->password = $hashed;
            $usr->update();

            alert()->success(trans('translation.success'), trans('translation.successfully_update'))->iconHtml('<i class="far fa-thumbs-up"></i>')->showConfirmButton()->focusConfirm(true);
            return redirect()->route('users.profile');

        } else {
            alert()->error('Oops...', trans('translation.update_failed'))->showConfirmButton()->focusConfirm(true);
            return redirect()->back()->withInput();
        }
    }

    /**
     * Dropdown options for the create / edit form.
     */
    private function formOptions(): array
    {
        return [
            'teams'     => Options::fromMap(Helper::getTeamListing()),
            'userTypes' => Options::fromMap(User::getUserTypeListing()),
        ];
    }

    /**
     * Another account already uses this email or mobile.
     */
    private function isDuplicate(Request $request, $ignoreId = null)
    {
        return User::where(function ($query) use ($request) {
                        $query->where('email', $request->email)
                              ->orWhere('mobile', $request->mobile);
                    })
                    ->when($ignoreId, fn ($query) => $query->where('id', '!=', $ignoreId))
                    ->exists();
    }

    private function accessError()
    {
        $response['title']      = trans('translation.access_error');
        $response['message'][0] = trans('translation.access_error_msg');
        $response['message'][1] = trans('translation.check_with_ur_superior');
        return Inertia::render('Errors/CustomError', compact('response'));
    }
}
