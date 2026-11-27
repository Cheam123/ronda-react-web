<?php

namespace App\Models;

use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

use App\Events\UserCreated;
use App\Traits\Paginatable;
use Laravel\Sanctum\HasApiTokens;
use Kyslik\ColumnSortable\Sortable;
use Carbon\Carbon;



class User extends Authenticatable
{
    use HasFactory, Notifiable, Sortable, SoftDeletes, HasApiTokens;

    public const TYPE_ADMIN   = 0;
    public const TYPE_MANAGER = 1;
    public const TYPE_USER    = 2;

    /**
     * What each user type may do. Every ability is registered as a Gate in
     * AuthServiceProvider, so `$user->can('create_task')` and `@can` resolve
     * against this map. The mobile app receives the same map (see abilities()).
     *
     * add_task lets a user add a task at all; create_task additionally lets
     * them assign it to other people. Without create_task the task is the
     * user's own (they are its subscriber, checker and owner).
     */
    public const ABILITIES = [
        'dashboard'         => [self::TYPE_ADMIN, self::TYPE_MANAGER, self::TYPE_USER],
        'view_lead'         => [self::TYPE_ADMIN, self::TYPE_MANAGER, self::TYPE_USER],
        'create_lead'       => [self::TYPE_ADMIN, self::TYPE_MANAGER, self::TYPE_USER],
        'edit_lead'         => [self::TYPE_ADMIN, self::TYPE_MANAGER, self::TYPE_USER],
        'manage_task'       => [self::TYPE_ADMIN, self::TYPE_MANAGER, self::TYPE_USER],
        'add_task'          => [self::TYPE_ADMIN, self::TYPE_MANAGER, self::TYPE_USER],
        'create_task'       => [self::TYPE_ADMIN, self::TYPE_MANAGER],
        'ife_report'        => [self::TYPE_ADMIN, self::TYPE_MANAGER, self::TYPE_USER],
        'manage_ife_report' => [self::TYPE_ADMIN, self::TYPE_MANAGER],
        'manage_user'       => [self::TYPE_ADMIN],
        'form_creation'     => [self::TYPE_ADMIN],
        'form_admin'        => [self::TYPE_ADMIN],
        'manage_product'    => [self::TYPE_ADMIN],
        'manage_area'       => [self::TYPE_ADMIN],
        'record_order'      => [self::TYPE_ADMIN, self::TYPE_MANAGER, self::TYPE_USER],
        'manage_order'      => [self::TYPE_ADMIN, self::TYPE_MANAGER],
    ];

    /**
     * The attributes that are mass assignable.
     *
     * @var array
     */
    protected $fillable = [
        'name',
        'username',
        'type', // 0:Admin | 1:Manager | 2:User
        'team',
        'email',
        'password',
        'mobile',
        'enable_notification',
        'status',
        'gender',
        'created_at',
        'updated_at',
        'deleted_at'
    ];

    /**
     * The attributes that should be hidden for arrays.
     *
     * @var array
     */
    protected $hidden = [
        'fcm_token',
        'password',
        'remember_token',
    ];

    /**
     * The attributes that should be cast to native types.
     *
     * @var array
     */
    protected $casts = [
        'type' => 'integer',
    ];

    protected $appends = ['active_appointment','total_active_task'];

    public function getActiveAppointmentAttribute()
    {
        $appointments = Tasks::with('users')
                             ->whereHas('users', function($query) {
                                $query->where(function($q) {
                                        $q->where('role',2)
                                        ->where('user_id',$this->id);
                                    })->orWhere(function($q) {
                                        $q->where('role',6)
                                        ->where('user_id',$this->id);
                                    });
                             })
                             ->whereIn('status',[1,2])
                             ->whereNotNull('appointment_date')
                             ->orderBy('appointment_date','desc')
                             ->get();
        $dateList = [];

        foreach($appointments as $t) {
            array_push($dateList, [
                    date('Y-m-d, h:i A', strtotime($t->appointment_date)),
                    ($t->lead->business_name ? $t->lead->business_name : $t->lead->name)
                ]
            );
        }

        return $dateList;
    }

    public function getTotalActiveTaskAttribute()
    {
        return Tasks::whereHas('users',function ($query) {
                            $query->where('user_id',$this->id);

                        })
                        ->whereIn('status',[1,2,8])
                        ->count();
    }

    public function ifeReports()
    {
        return $this->hasMany(IFEReport::class, 'created_by');
    }

    protected $dispatchesEvents = [
        'created' => UserCreated::class,
    ];

    public static function getUserTypeListing()
    {
        return [
            self::TYPE_ADMIN   => 'Admin',
            self::TYPE_MANAGER => 'Manager',
            self::TYPE_USER    => 'Field Rep',
        ];
    }

    public static function getUserType($type)
    {
        return self::getUserTypeListing()[$type] ?? '';
    }

    public function isAdmin()
    {
        return $this->type === self::TYPE_ADMIN;
    }

    /**
     * Active users a task can be assigned to. Admins run the system and are
     * not offered as subscribers, owners or viewers.
     */
    public function scopeAssignable($query)
    {
        return $query->where('status', 1)->where('type', '!=', self::TYPE_ADMIN)->orderBy('name', 'asc');
    }

    /**
     * Admins and Managers see every lead, task and IFE report; a normal User
     * only sees the records they are involved in (see the visibleTo scopes).
     */
    public function seesAllRecords()
    {
        return in_array($this->type, [self::TYPE_ADMIN, self::TYPE_MANAGER], true);
    }

    /**
     * Ability name => whether this user holds it, for the mobile app.
     */
    public function abilities()
    {
        return collect(self::ABILITIES)->map(fn ($types) => in_array($this->type, $types, true))->all();
    }

    public function getEmailForPasswordReset()
    {
        return $this->email;
    }
}
