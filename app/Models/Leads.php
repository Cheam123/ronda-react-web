<?php

namespace App\Models;

use App\Models\AreaRule;
use App\Models\User;
use App\Models\Cities;
use App\Models\States;
use App\Models\Tasks;

use App\Models\Sales\User as Db2User;
use App\Services\FormSchemaService;
use App\Services\Recommendation\Area\AreaProfiler;

use App\Traits\Paginatable;
use Kyslik\ColumnSortable\Sortable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Auth;

class Leads extends Model
{
    use HasFactory, Paginatable, Sortable;
    use SoftDeletes;

    /** Outlet size, ordered small to large. */
    public const SIZE_BANDS = [
        'small'  => 'Small',
        'medium' => 'Medium',
        'large'  => 'Large',
    ];

    /** Price segment the outlet sells into. */
    public const SEGMENTS = [
        'budget'    => 'Budget',
        'mid_range' => 'Mid-range',
        'premium'   => 'Premium',
    ];

    /** What an outlet can want to improve, as the rep hears it from the owner. */
    public const GOALS = [
        'expand_menu'     => 'Expand the menu',
        'new_customers'   => 'Attract new customers',
        'average_spend'   => 'Increase average spend',
        'ingredient_cost' => 'Reduce ingredient cost',
        'improve_drinks'  => 'Improve existing drinks',
    ];

    /** The outlet's needs that are lists of keys, as the forms send them. */
    public const NEEDS_LISTS = ['main_customers', 'best_selling_kinds', 'improvement_goals'];

    protected $casts = [
        'latitude'             => 'float',
        'longitude'            => 'float',
        'location_accuracy'    => 'float',
        'location_captured_at' => 'datetime',
        'seats'                => 'integer',
        'is_halal'             => 'boolean',
        'area_types'           => 'array',
        'main_customers'       => 'array',
        'best_selling_kinds'   => 'array',
        'improvement_goals'    => 'array',
        'typical_drink_price'  => 'float',
        'nearby_counts'        => 'array',
        'area_details'         => 'array',
        'area_profiled_at'     => 'datetime',
    ];

    protected $fillable = [
        'customer_id',
        'business_name',
        'receiving_date',
        'belong_to',
        'assign_to',
        'hq_checker',
        'name',
        'business_category',
        'source',
        'email',
        'mobile',
        'address',
        'city_id',
        'state_id',
        'postcode',
        'ife_area_id',
        'latitude',
        'longitude',
        'location_accuracy',
        'location_captured_at',
        'size_band',
        'seats',
        'segment',
        'is_halal',
        'district',
        'income_group',
        'area_types',
        'main_customers',
        'best_selling_kinds',
        'improvement_goals',
        'typical_drink_price',
        'nearby_counts',
        'area_details',
        'area_source',
        'area_profiled_at',
        'remark',
        'created_at',
        'updated_at',
    ];

    protected $appends = [
        'upline_name',
        'presales_name',
        'closing_sales_name',
    ];

    /**
     * What is known about where the outlet trades, for the outlet page and app.
     * Null until AreaProfiler has looked at it.
     */
    public function areaProfile(): ?array
    {
        if ($this->area_profiled_at === null) {
            return null;
        }

        $labels      = config('ife.recommendation.customer_groups', []);
        $config      = config('ife.recommendation.area', []);
        $details     = $this->areaDetails();
        $competitors = $config['competitor_categories'] ?? [];

        // Each area type that shows around the outlet, biggest share first.
        $notes = AreaRule::notes();
        $types = [];
        foreach ($details['scores'] ?? [] as $kind => $share) {
            $level = AreaProfiler::level((float) $share, $config);
            if ($level === null) {
                continue;
            }
            $types[] = [
                'kind'      => $kind,
                'label'     => $config['area_labels'][$kind] ?? ucfirst($kind),
                'customers' => $labels[$kind] ?? ucfirst($kind),
                'level'     => $level,
                'share'     => (float) $share,
                'count'     => (int) ($details['evidence'][$kind]['count'] ?? 0),
                'nearest'   => $details['evidence'][$kind]['nearest'] ?? null,
                'note'      => $notes[$kind] ?? null,
            ];
        }

        return [
            'district'        => $this->district,
            'income_group'    => $this->income_group,
            'area_types'      => $this->area_types ?? [],
            'nearby_total'    => array_sum($this->nearby_counts ?? []),
            'source'          => $this->area_source,
            'profiled_at'     => $this->area_profiled_at->toIso8601String(),
            // Who it serves, in words: the rep's answer when given, otherwise what is around it.
            'customers_from'  => !empty($this->main_customers) ? 'rep' : (!empty($this->area_types) ? 'area' : null),
            'customer_groups' => array_values(array_map(
                fn (string $kind) => $labels[$kind] ?? ucfirst($kind),
                !empty($this->main_customers) ? $this->main_customers : ($this->area_types ?? [])
            )),
            'types'           => $types,
            'mixed_use'       => count(array_filter($types, fn (array $type) => $type['level'] === 'present')) >= 2,
            'competitors'     => $details['competitors'] ?? null,
            'radius'          => $details['radius'] ?? null,
            // Distances known, so closer places counted more.
            'weighted'        => (bool) ($details['weighted'] ?? false),
            'places'          => array_map(fn (array $place) => [
                'label'      => $config['place_labels'][$place['category']] ?? ucfirst(str_replace('_', ' ', $place['category'])),
                'name'       => $place['name'] ?? null,
                'distance'   => $place['distance'] ?? null,
                'competitor' => in_array($place['category'], $competitors, true),
            ], $details['places'] ?? []),
        ];
    }

    /**
     * The area types around the outlet that the menu ranking weighs: those
     * Present or with Some presence, with their shares and evidence.
     *
     * @return array{shares: array<string, float>, evidence: array<string, array{count: int, nearest: ?int}>, radius: ?int}
     */
    public function areaForRanking(): array
    {
        $details = $this->areaDetails();
        $config  = config('ife.recommendation.area', []);
        $shares  = array_filter(
            array_map('floatval', $details['scores'] ?? []),
            fn (float $share) => AreaProfiler::level($share, $config) !== null
        );

        return ['shares' => $shares, 'evidence' => $details['evidence'] ?? [], 'radius' => $details['radius'] ?? null];
    }

    /**
     * AreaProfiler::profile() as columns, for a query update: profiling is not
     * an edit of the outlet, so it skips the model and its timestamps.
     */
    public static function areaColumns(array $profile): array
    {
        $json = fn (?array $value) => $value !== null ? json_encode($value) : null;

        return [
            'district'         => $profile['district'],
            'income_group'     => $profile['income_group'],
            'area_types'       => $json($profile['area_types']),
            'nearby_counts'    => $json($profile['nearby_counts']),
            'area_details'     => $json($profile['area_details'] ?? null),
            'area_source'      => $profile['area_source'],
            'area_profiled_at' => now(),
        ];
    }

    /** The stored area scores; an outlet profiled before they were kept gets them from its counts. */
    private function areaDetails(): ?array
    {
        if (is_array($this->area_details) && isset($this->area_details['scores'])) {
            $details = $this->area_details;
            // MySQL's JSON type keeps its own key order, so the biggest share first is put back here.
            $scores = $details['scores'];
            uksort($scores, fn ($a, $b) => [$scores[$b], $a] <=> [$scores[$a], $b]);
            $details['scores'] = $scores;

            return $details;
        }

        return !empty($this->nearby_counts) ? app(AreaProfiler::class)->details($this->nearby_counts) : null;
    }

    public function getUplineNameAttribute()
    {
        $customer = new Db2User();
        $customer->setConnection('mysql2');
        $customer = $customer->where('id',$this->customer_id)->first();

        if (!$customer) {
            return '';
        } else {
            $upline = new db2User();
            $upline->setConnection('mysql2');
            $upline = $upline->where('id',$customer->stockist_reference)->first();

            if (!$upline) {
                return '';
            } else {
                return ucwords(strtolower($upline->name));
            }
        }
    }

    public function getPresalesNameAttribute()
    {
        $customer = new db2User();
        $customer->setConnection('mysql2');
        $customer = $customer->where('id',$this->customer_id)->first();

        if (!$customer) {
            return '';
        } else {
            $pre_sales = new db2User();
            $pre_sales->setConnection('mysql2');
            $pre_sales = $pre_sales->where('id',$customer->pre_sales)->first();

            if (!$pre_sales) {
                return '';
            } else {
                return ucwords(strtolower($pre_sales->name));
            }
        }
    }

    public function getClosingSalesNameAttribute()
    {
        $customer = new db2User();
        $customer->setConnection('mysql2');
        $customer = $customer->where('id',$this->customer_id)->first();

        if (!$customer) {
            return '';
        } else {
            $closing_support = new db2User();
            $closing_support->setConnection('mysql2');
            $closing_support = $closing_support->where('id',$customer->closing_support)->first();

            if (!$closing_support) {
                return '';
            } else {
                return ucwords(strtolower($closing_support->name));
            }
        }
    }

    public function city()
    {
        return $this->belongsTo(Cities::class, 'city_id', 'id');
    }

    public function state()
    {
        return $this->belongsTo(States::class, 'state_id', 'id');
    }
    
    public function ifearea()
    {
        return $this->belongsTo(IfeArea::class, 'ife_area_id', 'id');
    }

    /**
     * Admins and Managers see every lead; a normal User sees the leads they
     * created or that are assigned to them.
     */
    public function scopeVisibleTo($query, User $user)
    {
        if ($user->seesAllRecords()) {
            return $query;
        }

        return $query->where(function ($q) use ($user) {
            $q->where('belong_to', $user->id)
              ->orWhere('assign_to', $user->id);
        });
    }

    // creater
    public function createdBy()
    {
        return $this->belongsTo(User::class,'belong_to','id')->withTrashed();
    }

    // the last subscriber
    public function assignee()
    {
        return $this->belongsTo(User::class, 'assign_to', 'id')->withTrashed();
    }

    public function hqChecker()
    {
        return $this->belongsTo(User::class, 'hq_checker', 'id')->withTrashed();
    }

    public function tasks()
    {
        return $this->hasMany(Tasks::class, 'lead_id', 'id')->orderBy('status','asc')->orderBy('created_at','desc');
    }

    public function runningTasks()
    {
        return $this->hasMany(Tasks::class, 'lead_id', 'id')->whereIn('status',[1,2,3]);
    }

    public function documentUploads()
    {
        return $this->hasMany(DocumentUpload::class,'lead_id','id');
    }

    /** Visits (IFE reports) made at this outlet, newest first. */
    public function visits()
    {
        return $this->hasMany(IFEReport::class, 'lead_id', 'id')->orderByDesc('created_at');
    }

    /** Orders this outlet placed, newest first. */
    public function orders()
    {
        return $this->hasMany(Order::class, 'lead_id', 'id')->orderByDesc('order_date')->orderByDesc('id');
    }

    public static function sizeBandLabel(?string $value): ?string
    {
        return $value === null ? null : (self::SIZE_BANDS[$value] ?? $value);
    }

    public static function segmentLabel(?string $value): ?string
    {
        return $value === null ? null : (self::SEGMENTS[$value] ?? $value);
    }

    /**
     * Saves the outlet's needs from a validated form. A need the form left
     * out keeps its saved answer (an older app version doesn't send it); an
     * empty one clears it.
     */
    public function applyNeeds(array $validated): void
    {
        foreach (self::NEEDS_LISTS as $field) {
            if (array_key_exists($field, $validated)) {
                $this->{$field} = !empty($validated[$field]) ? array_values(array_unique($validated[$field])) : null;
            }
        }

        if (array_key_exists('typical_drink_price', $validated)) {
            $price = $validated['typical_drink_price'];
            $this->typical_drink_price = $price === null || $price === '' ? null : round((float) $price, 2);
        }
    }

    /** The outlet's needs with readable names, for screens that only show them. */
    public function needsShown(): array
    {
        $names = fn (?array $keys, array $labels) => array_values(array_map(fn ($key) => $labels[$key] ?? $key, $keys ?? []));

        return [
            'main_customers'      => $names($this->main_customers, config('ife.recommendation.customer_groups', [])),
            'best_selling_kinds'  => $names($this->best_selling_kinds, Recipe::CATEGORIES),
            'improvement_goals'   => $names($this->improvement_goals, self::GOALS),
            'typical_drink_price' => $this->typical_drink_price,
        ];
    }

    /**
     * Where the outlet is, in the GPS Stamp answer shape
     * {lat, lng, accuracy, captured_at}; null when never captured.
     */
    public function locationStamp(): ?array
    {
        if ($this->latitude === null || $this->longitude === null) {
            return null;
        }

        return [
            'lat'         => (float) $this->latitude,
            'lng'         => (float) $this->longitude,
            'accuracy'    => $this->location_accuracy === null ? null : (float) $this->location_accuracy,
            'captured_at' => optional($this->location_captured_at)->toIso8601String(),
        ];
    }

    /**
     * Writes a location captured on the device. Same shape and validation as
     * a GPS Stamp form answer; an empty value clears the location.
     *
     * @return string|null the validation error, or null once applied
     */
    public function applyLocationStamp($value): ?string
    {
        $gps = app(FormSchemaService::class)->normalizeGps(['label' => 'the outlet'], $value);
        if ($gps['error'] !== null) {
            return $gps['error'];
        }

        $stamp = $gps['value'];

        $this->latitude             = $stamp['lat'] ?? null;
        $this->longitude            = $stamp['lng'] ?? null;
        $this->location_accuracy    = $stamp['accuracy'] ?? null;
        $this->location_captured_at = isset($stamp['captured_at']) ? \Illuminate\Support\Carbon::parse($stamp['captured_at']) : null;

        return null;
    }
}
