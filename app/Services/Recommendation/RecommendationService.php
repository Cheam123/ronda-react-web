<?php

namespace App\Services\Recommendation;

use App\Helpers\Helper;
use App\Models\Leads;
use App\Models\OutletRecommendation;
use App\Models\Product;
use App\Models\User;
use App\Services\Ai\ClaudeClient;
use App\Services\Ai\Voice;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

/**
 * Product recommendations per outlet (lead).
 *
 * refresh() precomputes them into outlet_recommendations: nightly for every
 * outlet (recommendation:refresh), and for one outlet whenever its profile
 * or orders change. forLead() serves a stored row and writes its "Why
 * these?" explanation the first time anyone opens it (Claude on Bedrock, or
 * a template without it), caching it until the recommended items change.
 *
 * Outlets are compared on the profile below with Gower distance; purchases
 * are monthly quantities per product over the lookback window.
 */
class RecommendationService
{
    /** Gower features and their weights. Area counts half: nearby matters less than kind. */
    public const FEATURES = [
        'business_category' => ['type' => GowerDistance::CATEGORICAL, 'weight' => 1.0],
        'segment'           => ['type' => GowerDistance::CATEGORICAL, 'weight' => 1.0],
        'size_rank'         => ['type' => GowerDistance::NUMERIC,     'weight' => 1.0],
        'seats'             => ['type' => GowerDistance::NUMERIC,     'weight' => 1.0],
        'ife_area_id'       => ['type' => GowerDistance::CATEGORICAL, 'weight' => 0.5],
        'monthly_spend'     => ['type' => GowerDistance::NUMERIC,     'weight' => 1.0],
    ];

    /** Size band as a rank for Gower. */
    public const SIZE_RANK = ['small' => 1, 'medium' => 2, 'large' => 3];

    /** Stand-in seat count when an outlet has a size band but no seats, for quantity scaling. */
    public const SEAT_ESTIMATE = ['small' => 20, 'medium' => 50, 'large' => 100];

    private const EXPLAIN_SYSTEM = Voice::BLOCK . "\n\n" . <<<'TXT'
Here you write the "Why these?" note on an outlet's Suggested Orders, for a field rep about to visit that outlet. The rep has a short list of products that similar outlets buy and this outlet does not (or buys too little of). Explain why these products are suggested, using only the facts given, then give one natural opening line the rep can say to the owner. Never push or pressure; suggest. Write money as "RM 1,234.00".

Reply in exactly this shape:
WHY:
<two to four sentences>
OPENING LINE:
<one sentence the rep can say out loud>
Do not use markdown symbols, and do not invent figures, product claims or outlet names.
TXT;

    public function __construct(private ClaudeClient $claude)
    {
    }

    /**
     * Recompute recommendations for the given outlets, or every outlet.
     *
     * @param int[]|null $leadIds
     * @return int rows written
     */
    public function refresh(?array $leadIds = null): int
    {
        $outlets = $this->outletProfiles();
        if (empty($outlets)) {
            return 0;
        }

        $products    = $this->activeProducts();
        $candidates  = array_values(array_filter($outlets, fn ($outlet) => !empty($outlet['purchases'])));
        $recommender = new KnnRecommender(
            self::FEATURES,
            (int) config('ife.recommendation.k', 5),
            (int) config('ife.recommendation.limit', 10),
            (float) config('ife.recommendation.min_support', 0.3),
        );

        $targets = $leadIds === null ? array_keys($outlets) : array_intersect(array_map('intval', $leadIds), array_keys($outlets));
        $written = 0;

        foreach ($targets as $leadId) {
            $result = $recommender->recommend($outlets[$leadId], $candidates, $products);
            $this->store((int) $leadId, $result);
            $written++;
        }

        return $written;
    }

    /**
     * API / view payload for one outlet. Computes it on the spot if it has
     * never been computed, and writes the explanation if it is missing or
     * stale.
     */
    public function forLead(Leads $lead, bool $explain = true): array
    {
        $row = OutletRecommendation::where('lead_id', $lead->id)->first();

        if (!$row) {
            $this->refresh([$lead->id]);
            $row = OutletRecommendation::where('lead_id', $lead->id)->first();
        }

        if (!$row) {
            return $this->payload($lead, null);
        }

        if ($explain && !empty($row->items) && $this->needsExplanation($row)) {
            $this->explain($lead, $row);
        }

        return $this->payload($lead, $row);
    }

    /**
     * A rep's outlets with the most to gain, for the "Suggested orders" panel
     * on their dashboard: biggest estimated monthly value first.
     *
     * @return array{outlets: array<int, array>, total: int}
     */
    public function topForUser(User $user, int $limit = 5): array
    {
        $rows = OutletRecommendation::query()
            ->whereIn('lead_id', Leads::visibleTo($user)->select('id'))
            ->where('estimated_monthly_value', '>', 0)
            ->with('lead:id,name,business_name')
            ->orderByDesc('estimated_monthly_value')
            ->get(['id', 'lead_id', 'items', 'gap_count', 'estimated_monthly_value']);

        $outlets = $rows->take($limit)->map(fn (OutletRecommendation $row) => [
            'lead_id'                 => $row->lead_id,
            'name'                    => optional($row->lead)->business_name ?: optional($row->lead)->name,
            'products'                => array_column(array_slice($row->items ?? [], 0, 3), 'name'),
            'product_count'           => count($row->items ?? []),
            'gap_count'               => $row->gap_count,
            'estimated_monthly_value' => (float) $row->estimated_monthly_value,
        ])->values()->all();

        return ['outlets' => $outlets, 'total' => $rows->count()];
    }

    private function needsExplanation(OutletRecommendation $row): bool
    {
        if (!$row->hasFreshExplanation()) {
            return true;
        }

        // A template stands in until Claude is available; upgrade it then.
        return $row->explanation_source === 'template' && $this->claude->isConfigured();
    }

    /** Writes and caches the "Why these?" text and opening line for a row. */
    public function explain(Leads $lead, OutletRecommendation $row): void
    {
        $facts  = $this->explanationFacts($lead, $row);
        $why    = null;
        $line   = null;
        $source = 'template';

        if ($this->claude->isConfigured()) {
            try {
                $result = $this->claude->complete(
                    self::EXPLAIN_SYSTEM,
                    "Here are the facts as JSON:\n\n" . json_encode($facts, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
                );
                [$why, $line] = $this->parseExplanation($result['text']);
                $source       = $why !== null ? 'bedrock' : 'template';
            } catch (\Throwable $e) {
                Log::warning('Recommendation explanation: Bedrock failed, using the template', [
                    'lead_id' => $lead->id,
                    'error'   => $e->getMessage(),
                ]);
            }
        }

        if ($why === null) {
            [$why, $line] = $this->templateExplanation($facts);
        }

        $row->update([
            'explanation'        => $why,
            'opening_line'       => $line !== null ? mb_substr($line, 0, 500) : null,
            'explanation_source' => $source,
            'explained_hash'     => $row->items_hash,
        ]);
    }

    /**
     * Splits Claude's "WHY: ... OPENING LINE: ..." reply.
     *
     * @return array{0: ?string, 1: ?string}
     */
    public function parseExplanation(string $text): array
    {
        if (!preg_match('/WHY:\s*(.+?)\s*OPENING LINE:\s*(.+)/is', $text, $match)) {
            $text = trim($text);

            return [$text !== '' ? $text : null, null];
        }

        $why  = trim($match[1]);
        $line = trim(trim($match[2]), "\"“”");

        return [$why !== '' ? $why : null, $line !== '' ? $line : null];
    }

    /** @return array{0: string, 1: string} */
    public function templateExplanation(array $facts): array
    {
        $items    = $facts['recommended'];
        $names    = array_slice(array_column($items, 'product'), 0, 3);
        $currency = $facts['currency'];
        $kind     = $facts['outlet']['type'] ?: 'outlets';
        $count    = $facts['similar_outlets'];

        $list = count($names) > 1
            ? implode(', ', array_slice($names, 0, -1)) . ' and ' . end($names)
            : ($names[0] ?? 'these products');

        $gaps  = (int) $facts['gap_count'];
        $total = count($items);
        $why   = sprintf(
            'The %d most similar outlets to this one (by type, segment, size, area and spend) regularly order %s. %s Together the suggestions are worth about %s %s a month.',
            $count,
            $list,
            match (true) {
                $gaps === 0      => 'This outlet orders less of them than its peers do.',
                $gaps === $total => 'This outlet has not ordered ' . ($total === 1 ? 'it' : 'any of them') . ' recently.',
                default          => 'This outlet has not ordered ' . ($gaps === 1 ? 'one of them' : $gaps . ' of them') . ' recently.',
            },
            $currency,
            number_format($facts['estimated_monthly_value'], 2)
        );

        $line = sprintf(
            'Other %s like yours have been doing well with %s. Would you like to try some this month?',
            $facts['outlet']['type'] ? mb_strtolower($kind) . ' outlets' : 'outlets',
            $names[0] ?? 'a few of our products'
        );

        return [$why, $line];
    }

    /** What the explanation is written from: the outlet, its items, and who it was compared with. */
    private function explanationFacts(Leads $lead, OutletRecommendation $row): array
    {
        return [
            'outlet'                  => [
                'type'      => Helper::getBusinessCategory($lead->business_category) ?: null,
                'segment'   => Leads::segmentLabel($lead->segment),
                'size_band' => Leads::sizeBandLabel($lead->size_band),
                'seats'     => $lead->seats,
            ],
            'similar_outlets'         => count($row->neighbors ?? []),
            'currency'                => config('ife.currency', 'RM'),
            'gap_count'               => $row->gap_count,
            'estimated_monthly_value' => $row->estimated_monthly_value,
            'recommended'             => collect($row->items)->map(fn ($item) => [
                'product'              => $item['name'],
                'category'             => $item['category'],
                'status'               => $item['status'] === 'gap' ? 'not ordered yet' : 'ordered less than similar outlets',
                'share_of_similar'     => (int) round($item['support'] * 100) . '%',
                'suggested_monthly'    => $item['recommended_qty'] . ' ' . $item['unit'],
                'currently_monthly'    => $item['current_qty'] . ' ' . $item['unit'],
                'extra_monthly_value'  => $item['est_monthly_value'],
            ])->values()->all(),
        ];
    }

    private function payload(Leads $lead, ?OutletRecommendation $row): array
    {
        $items = $row->items ?? [];

        return [
            'lead_id'                 => $lead->id,
            'status'                  => empty($items) ? 'insufficient_data' : 'ready',
            'computed_at'             => optional(optional($row)->computed_at)->toIso8601String(),
            'currency'                => config('ife.currency', 'RM'),
            'similar_outlets'         => count($row->neighbors ?? []),
            'gap_count'               => $row->gap_count ?? 0,
            'estimated_monthly_value' => (float) ($row->estimated_monthly_value ?? 0),
            'items'                   => $items,
            'explanation'             => [
                'why'          => optional($row)->explanation,
                'opening_line' => optional($row)->opening_line,
                'source'       => optional($row)->explanation_source,
            ],
        ];
    }

    private function store(int $leadId, array $result): void
    {
        $hash = hash('sha256', json_encode(array_map(
            fn ($item) => [$item['product_id'], $item['status'], $item['recommended_qty']],
            $result['items']
        )));

        $neighbors = [];
        foreach ($result['neighbors'] as $id => $distance) {
            $neighbors[] = ['lead_id' => (int) $id, 'distance' => $distance];
        }

        OutletRecommendation::updateOrCreate(
            ['lead_id' => $leadId],
            [
                'items'                   => $result['items'],
                'neighbors'               => $neighbors,
                'items_hash'              => $hash,
                'gap_count'               => $result['gap_count'],
                'estimated_monthly_value' => $result['estimated_monthly_value'],
                'computed_at'             => Carbon::now(),
            ]
        );
    }

    /**
     * Every outlet as the recommender sees it: Gower features, a size scale
     * for quantities, and monthly purchases per product.
     *
     * @return array<int, array{id: int, features: array, scale: ?float, purchases: array<int, float>}>
     */
    private function outletProfiles(): array
    {
        $since = Carbon::now()->subDays((int) config('ife.recommendation.lookback_days', 180))->toDateString();

        $orders = DB::table('orders')
            ->where('status', 'confirmed')
            ->whereNull('deleted_at')
            ->where('order_date', '>=', $since);

        $firstOrder = (clone $orders)
            ->groupBy('lead_id')
            ->select('lead_id', DB::raw('MIN(order_date) as first_date'), DB::raw('SUM(total_amount) as spend'))
            ->get()
            ->keyBy('lead_id');

        $lines = DB::table('order_lines')
            ->join('orders', 'orders.id', '=', 'order_lines.order_id')
            ->where('orders.status', 'confirmed')
            ->whereNull('orders.deleted_at')
            ->where('orders.order_date', '>=', $since)
            ->groupBy('orders.lead_id', 'order_lines.product_id')
            ->select('orders.lead_id', 'order_lines.product_id', DB::raw('SUM(order_lines.quantity) as qty'))
            ->get()
            ->groupBy('lead_id');

        $now     = Carbon::now();
        $outlets = [];

        $leads = Leads::query()->get(['id', 'business_category', 'segment', 'size_band', 'seats', 'ife_area_id']);

        foreach ($leads as $lead) {
            $months = 1.0;
            $spend  = null;

            if (isset($firstOrder[$lead->id])) {
                $days   = (int) Carbon::parse($firstOrder[$lead->id]->first_date)->diffInDays($now, true);
                $months = max(1.0, $days / 30.44);
                $spend  = round((float) $firstOrder[$lead->id]->spend / $months, 2);
            }

            $purchases = [];
            foreach ($lines[$lead->id] ?? [] as $line) {
                $purchases[(int) $line->product_id] = round((float) $line->qty / $months, 2);
            }

            $outlets[$lead->id] = [
                'id'        => (int) $lead->id,
                'features'  => [
                    'business_category' => $lead->business_category,
                    'segment'           => $lead->segment,
                    'size_rank'         => self::SIZE_RANK[$lead->size_band] ?? null,
                    'seats'             => $lead->seats,
                    'ife_area_id'       => $lead->ife_area_id,
                    'monthly_spend'     => $spend,
                ],
                'scale'     => $lead->seats ?: (self::SEAT_ESTIMATE[$lead->size_band] ?? null),
                'purchases' => $purchases,
            ];
        }

        return $outlets;
    }

    /** @return array<int, array{sku: string, name: string, category: ?string, unit: string, unit_price: float}> */
    private function activeProducts(): array
    {
        return Product::active()
            ->get(['id', 'sku', 'name', 'category', 'unit', 'unit_price'])
            ->mapWithKeys(fn (Product $product) => [$product->id => [
                'sku'        => $product->sku,
                'name'       => $product->name,
                'category'   => $product->category,
                'unit'       => $product->unit,
                'unit_price' => (float) $product->unit_price,
            ]])
            ->all();
    }
}
