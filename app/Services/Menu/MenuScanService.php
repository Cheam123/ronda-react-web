<?php

namespace App\Services\Menu;

use App\Helpers\Helper;
use App\Models\AreaRule;
use App\Models\DocumentUpload;
use App\Models\Leads;
use App\Models\MenuScan;
use App\Models\MenuScanItem;
use App\Models\Order;
use App\Models\OrderLine;
use App\Models\Recipe;
use App\Models\RecipeIngredient;
use App\Models\RecommendationFeedback;
use App\Models\User;
use Illuminate\Http\File;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

/**
 * Menu scans for the web and the mobile app alike: stores what was read,
 * matches it to the drinks list, takes the rep's corrections, and works out
 * the drink ideas when the scan is confirmed.
 *
 * The rules live in MenuReader, MenuMatcher and MenuIdeas; this class only
 * fetches what they need and saves what they return.
 */
class MenuScanService
{
    /** A scan keeps at most this many fragments and photos. */
    public const MAX_FRAGMENTS = 800;
    public const MAX_PHOTOS    = 4;

    /** Loaded once per request: every drink, the area rules and the labels reasons use. */
    private ?array $drinkFacts = null;
    private ?array $areaRules  = null;
    private ?array $labels     = null;

    public function __construct(private MenuReader $reader)
    {
    }

    /** Up to 4 menu photos, as the app sends them. */
    public static function photoRules(): array
    {
        return [
            'file'   => 'nullable|array|max:' . self::MAX_PHOTOS,
            'file.*' => 'file|image|max:10240',
        ];
    }

    /** The rep's check of a draft: which rows to keep, and which drink a row is. */
    public static function confirmRules(): array
    {
        return [
            'items'             => 'nullable|array|max:' . self::MAX_FRAGMENTS,
            'items.*.id'        => 'required|integer',
            'items.*.kept'      => 'sometimes|boolean',
            'items.*.recipe_id' => 'sometimes|nullable|integer',
        ];
    }

    /**
     * What a phone read, as a list of fragments. The app sends it as JSON
     * text beside the photos; anything that isn't a line of text is dropped.
     *
     * @return array<int, array{text: string, page: int, x: ?float, y: ?float, width: ?float, height: ?float}>
     */
    public static function fragmentsFrom(mixed $input): array
    {
        if (is_string($input)) {
            $input = json_decode($input, true);
        }
        if (!is_array($input)) {
            return [];
        }

        $number    = fn ($value) => is_numeric($value) ? (float) $value : null;
        $fragments = [];

        foreach (array_slice(array_values($input), 0, self::MAX_FRAGMENTS) as $fragment) {
            $text = is_array($fragment) && is_string($fragment['text'] ?? null) ? trim($fragment['text']) : '';
            if ($text === '') {
                continue;
            }

            $clean = [
                'text'   => mb_substr($text, 0, 200),
                'page'   => max(0, min(9, (int) ($fragment['page'] ?? 0))),
                'x'      => $number($fragment['x'] ?? null),
                'y'      => $number($fragment['y'] ?? null),
                'width'  => $number($fragment['width'] ?? null),
                'height' => $number($fragment['height'] ?? null),
            ];
            // The layout block a line sits in, when the reader knows it (Textract does).
            if (is_string($fragment['group'] ?? null) && $fragment['group'] !== '') {
                $clean['group'] = mb_substr($fragment['group'], 0, 60);
            }
            $fragments[] = $clean;
        }

        return $fragments;
    }

    /**
     * Reads menu photos with Amazon Textract, as fragments. Call it only when
     * TextractPhotoReader::enabled(); empty when no text was found.
     *
     * @param UploadedFile[] $photos
     * @throws MenuPhotoError over this month's limit, or when Textract fails
     */
    public function readPhotos(array $photos): array
    {
        $photos = array_slice(array_values($photos), 0, self::MAX_PHOTOS);

        if (!TextractPhotoReader::withinLimit(count($photos))) {
            throw new MenuPhotoError("This month's limit for reading menu photos is reached.");
        }

        try {
            $lines = app(PhotoReader::class)->read(array_map(fn (UploadedFile $photo) => $photo->getRealPath(), $photos));
        } catch (\Throwable $e) {
            report($e);

            throw new MenuPhotoError('The photos could not be read just now.', 0, $e);
        }

        return self::fragmentsFrom($lines);
    }

    /** A typed or pasted menu, one fragment per line. */
    public static function fragmentsFromText(string $text): array
    {
        return self::fragmentsFrom(array_map(
            fn (string $line) => ['text' => $line],
            preg_split('/\r\n|\r|\n/', $text) ?: []
        ));
    }

    /**
     * What a scan would find, without storing anything: one item per drink on
     * a row, and the priced rows no drink matched (for the accuracy check).
     *
     * @return array<int, array{text: string, price: ?float, page: int, kind: string, recipe_id: ?int, share: ?float}>
     */
    public function findDrinks(array $fragments): array
    {
        return $this->matcher()->match($this->reader->rows(array_slice(array_values($fragments), 0, self::MAX_FRAGMENTS)));
    }

    /**
     * Stores a new scan as a draft, with the drinks found on it.
     *
     * @param array<int, array{text: string, page?: int, x?: mixed, y?: mixed, width?: mixed, height?: mixed}> $fragments
     * @param UploadedFile[] $photos
     */
    public function create(Leads $lead, User $user, array $fragments, string $source, array $photos = []): MenuScan
    {
        $fragments = array_slice(array_values($fragments), 0, self::MAX_FRAGMENTS);
        $rows      = $this->reader->rows($fragments);
        $items     = $this->matcher()->match($rows);

        return DB::transaction(function () use ($lead, $user, $fragments, $source, $photos, $items) {
            $scan = MenuScan::create([
                'lead_id'   => $lead->id,
                'user_id'   => $user->id,
                'source'    => $source,
                'status'    => MenuScan::STATUS_DRAFT,
                'fragments' => $fragments,
            ]);

            foreach ($items as $position => $item) {
                MenuScanItem::create([
                    'menu_scan_id' => $scan->id,
                    'row_text'     => mb_substr($item['text'], 0, 255),
                    'page'         => min(255, max(0, $item['page'])),
                    'position'     => $position,
                    'price'        => $item['price'],
                    'kind'         => $item['kind'],
                    'recipe_id'    => $item['recipe_id'],
                    'match_share'  => $item['share'],
                ]);
            }

            foreach (array_slice($photos, 0, self::MAX_PHOTOS) as $photo) {
                $this->storePhoto($scan, $user, $photo);
            }

            $this->price($scan);

            return $scan->load('items.recipe', 'photos');
        });
    }

    /**
     * Applies the rep's corrections and confirms the scan: its drinks become
     * the outlet's menu, and the drink ideas are worked out from it.
     *
     * @param array<int, array{id: int, kept?: bool, recipe_id?: ?int}> $changes one entry per item the rep touched
     */
    public function confirm(MenuScan $scan, array $changes = []): MenuScan
    {
        return DB::transaction(function () use ($scan, $changes) {
            $items  = $scan->items()->get()->keyBy('id');
            $drinks = Recipe::active()->pluck('id')->flip();

            foreach ($changes as $change) {
                $item = $items[(int) ($change['id'] ?? 0)] ?? null;
                if ($item === null) {
                    continue;
                }

                $kept = array_key_exists('kept', $change) ? filter_var($change['kept'], FILTER_VALIDATE_BOOLEAN) : $item->kept;
                // Naming the drink for a row makes it a match; clearing it makes the row unrecognised again.
                $recipeId = array_key_exists('recipe_id', $change)
                    ? (isset($drinks[(int) $change['recipe_id']]) ? (int) $change['recipe_id'] : null)
                    : $item->recipe_id;

                $item->fill([
                    'kept'      => $kept,
                    'recipe_id' => $recipeId,
                    'kind'      => $recipeId ? MenuScanItem::KIND_MATCHED : MenuScanItem::KIND_UNRECOGNISED,
                ]);

                if ($item->isDirty()) {
                    $item->changed_by_rep = true;
                    $item->save();
                }
            }

            $scan->load('items');
            $this->price($scan);

            $scan->update([
                'status'       => MenuScan::STATUS_CONFIRMED,
                'confirmed_at' => Carbon::now(),
                'ideas'        => $this->ideas($scan),
            ]);

            return $scan->load('items.recipe', 'photos');
        });
    }

    /** The outlet's menu as the page and the app show it: the newest confirmed scan, or null. */
    public function forLead(Leads $lead): ?array
    {
        $scan = MenuScan::with('items.recipe', 'photos', 'user:id,name')
            ->where('lead_id', $lead->id)
            ->where('status', MenuScan::STATUS_CONFIRMED)
            ->latest('id')
            ->first();

        return $scan ? $this->present($scan) + [
            'answers'         => RecommendationFeedback::answersFor($lead),
            'decline_reasons' => RecommendationFeedback::REASONS,
            'scan_count'      => MenuScan::where('lead_id', $lead->id)->where('status', MenuScan::STATUS_CONFIRMED)->count(),
        ] : null;
    }

    /** One scan for the page or the app: what was found, what wasn't recognised, and its ideas once confirmed. */
    public function present(MenuScan $scan): array
    {
        $scan->loadMissing('items.recipe', 'photos', 'user:id,name');

        $item = fn (MenuScanItem $item) => [
            'id'          => $item->id,
            'text'        => $item->row_text,
            'price'       => $item->price,
            'recipe_id'   => $item->recipe_id,
            'drink'       => optional($item->recipe)->name,
            'kept'        => (bool) $item->kept,
            'changed'     => (bool) $item->changed_by_rep,
        ];

        return [
            'id'            => $scan->id,
            'status'        => $scan->status,
            'source'        => $scan->source,
            'scanned_at'    => $scan->created_at->toIso8601String(),
            'scanned_label' => $scan->created_at->format('j M Y'),
            'scanned_by'    => optional($scan->user)->name,
            'price_level'   => $scan->price_level,
            'price_label'   => $scan->price_level ? (Recipe::PRICE_TIERS[$scan->price_level] ?? null) : null,
            'median_price'  => $scan->median_price,
            'matched'       => $scan->items->where('kind', MenuScanItem::KIND_MATCHED)->map($item)->values()->all(),
            'unrecognised'  => $scan->items->where('kind', MenuScanItem::KIND_UNRECOGNISED)->map($item)->values()->all(),
            'photos'        => $scan->photos->map(fn (DocumentUpload $photo) => [
                'id'   => $photo->id,
                'name' => $photo->display_name,
                'url'  => $photo->file_full_path,
            ])->values()->all(),
            // On a draft, every line that was read, to compare with the photos while checking.
            'lines'         => $scan->status === MenuScan::STATUS_DRAFT
                ? array_column($this->reader->rows($scan->fragments ?? []), 'text')
                : [],
            'ideas'         => $scan->ideas ?? [],
        ];
    }

    /** The drinks a rep can name for an unrecognised row. */
    public function drinkOptions(): array
    {
        return Recipe::active()->orderBy('name')->get(['id', 'name'])
            ->map(fn (Recipe $recipe) => ['value' => $recipe->id, 'label' => $recipe->name])
            ->all();
    }

    /** @return array<int, int> drink id => how many outlets have it on their menu now */
    public function onMenuCounts(): array
    {
        return MenuScanItem::query()
            ->whereIn('menu_scan_id', $this->currentScanIds())
            ->where('kind', MenuScanItem::KIND_MATCHED)
            ->where('kept', true)
            ->whereNotNull('recipe_id')
            ->selectRaw('recipe_id, COUNT(DISTINCT menu_scan_id) AS menus')
            ->groupBy('recipe_id')
            ->pluck('menus', 'recipe_id')
            ->map(fn ($count) => (int) $count)
            ->all();
    }

    /** How many outlets have a confirmed menu. */
    public function menuCount(): int
    {
        return count($this->currentScanIds());
    }

    /**
     * Menu rows that matched no drink, on the outlets' current menus, most
     * common first. An admin can add one as another name for a drink.
     *
     * @return array<int, array{text: string, menus: int}>
     */
    public function unrecognisedRows(int $limit = 15): array
    {
        $rows = MenuScanItem::query()
            ->whereIn('menu_scan_id', $this->currentScanIds())
            ->where('kind', MenuScanItem::KIND_UNRECOGNISED)
            ->get(['menu_scan_id', 'row_text']);

        $seen = [];
        foreach ($rows as $row) {
            // "Yuzu Americano 14.00" and "YUZU AMERICANO RM13" are the same line.
            $name = $this->reader->rowsFromText($row->row_text)[0]['name'] ?? '';
            $key  = mb_strtolower($name);
            if ($key === '') {
                continue;
            }
            $seen[$key]['text'] ??= $name;
            $seen[$key]['scans'][$row->menu_scan_id] = true;
        }

        $list = array_map(fn (array $entry) => ['text' => $entry['text'], 'menus' => count($entry['scans'])], array_values($seen));
        usort($list, fn ($a, $b) => [$b['menus'], $a['text']] <=> [$a['menus'], $b['text']]);

        return array_slice($list, 0, $limit);
    }

    /** @return int[] each outlet's newest confirmed scan */
    private function currentScanIds(): array
    {
        return MenuScan::where('status', MenuScan::STATUS_CONFIRMED)
            ->selectRaw('MAX(id) AS id')
            ->groupBy('lead_id')
            ->pluck('id')
            ->all();
    }

    private function matcher(): MenuMatcher
    {
        $drinks = Recipe::active()->get(['id', 'name', 'aliases'])
            ->map(fn (Recipe $recipe) => ['id' => $recipe->id, 'names' => $recipe->names()])
            ->all();

        return new MenuMatcher($drinks, (array) config('ife.recommendation.menu.ignored_words', []));
    }

    /** The menu's middle price and the price level it points to. */
    private function price(MenuScan $scan): void
    {
        // One price per row: a row naming two drinks would otherwise count twice.
        $prices = $scan->items()->where('kept', true)->whereNotNull('price')->get(['position', 'row_text', 'price'])
            ->unique(fn (MenuScanItem $item) => $item->row_text . '|' . $item->price)
            ->pluck('price')
            ->all();

        $median = MenuReader::medianPrice($prices);

        $scan->update([
            'median_price' => $median,
            'price_level'  => MenuIdeas::priceLevel($median, (array) config('ife.recommendation.menu.price_levels', [])),
        ]);
    }

    /**
     * The outlet's drink ideas as they stand now, worked out on each call so
     * an edit to the outlet shows at once: from its newest confirmed menu when
     * it has one, what the owner told the rep, the area around it and its
     * profile. With what they were based on and the rep's answers so far.
     */
    public function ideasFor(Leads $lead): array
    {
        $scan  = $this->currentScan($lead);
        $needs = $lead->main_customers || $lead->best_selling_kinds || $lead->improvement_goals || $lead->typical_drink_price !== null;

        return [
            'ideas'           => $this->rankFor($lead, self::menuOf($scan)),
            'menu_scan_id'    => $scan?->id,
            'based_on'        => array_keys(array_filter([
                'their menu'               => $scan !== null,
                'what the owner told you'  => $needs,
                'the places around them'   => $lead->areaForRanking()['shares'] !== [],
            ])),
            'answers'         => RecommendationFeedback::answersFor($lead),
            'decline_reasons' => RecommendationFeedback::REASONS,
        ];
    }

    /** The outlet's newest confirmed menu scan, or null. */
    public function currentScan(Leads $lead): ?MenuScan
    {
        return MenuScan::with('items')
            ->where('lead_id', $lead->id)
            ->where('status', MenuScan::STATUS_CONFIRMED)
            ->latest('id')
            ->first();
    }

    /** @return array{on_menu: int[], price_level: ?string} a scan as MenuIdeas reads a menu; empty for none */
    public static function menuOf(?MenuScan $scan): array
    {
        return $scan ? ['on_menu' => $scan->drinkIds(), 'price_level' => $scan->price_level] : ['on_menu' => [], 'price_level' => null];
    }

    /** The drink ideas for a scan, from its confirmed drinks and what is known about the outlet. */
    private function ideas(MenuScan $scan): array
    {
        return $this->rankFor($scan->lead, self::menuOf($scan));
    }

    /**
     * @param array{on_menu: int[], price_level: ?string} $menu
     */
    private function rankFor(Leads $lead, array $menu): array
    {
        [$outlet, $declined, $bought] = $this->rankingInputs($lead);

        return $this->ranker()->rank($outlet, $menu, $this->drinkFacts(), $declined, $bought);
    }

    /**
     * What MenuIdeas needs to know about one outlet: its facts, the drinks the
     * rep declined there lately and the products it has ordered lately.
     *
     * @return array{0: array, 1: int[], 2: int[]}
     */
    public function rankingInputs(Leads $lead): array
    {
        $settings = (array) config('ife.recommendation.menu', []);

        $outlet = [
            'type'          => $lead->business_category !== null ? (int) $lead->business_category : null,
            // Who it serves, in the rep's words. What is around it is the area part, on its own.
            'customers'     => array_values($lead->main_customers ?? []),
            'best_sellers'  => array_values($lead->best_selling_kinds ?? []),
            'goals'         => array_values($lead->improvement_goals ?? []),
            'typical_price' => $lead->typical_drink_price,
            'area'          => $lead->areaForRanking(),
            'halal_only'    => (bool) $lead->is_halal,
            'seats'         => $lead->seats,
            'segment'       => $lead->segment,
        ];

        $declined = RecommendationFeedback::latestDrinksByLead([$lead->id])[$lead->id] ?? [];
        $since    = Carbon::now()->subDays((int) ($settings['decline_days'] ?? 90));
        $declined = array_keys(array_filter($declined, fn (RecommendationFeedback $row) => $row->status === 'declined' && $row->created_at->gte($since)));

        $bought = OrderLine::query()
            ->whereIn('order_id', Order::confirmed()
                ->where('lead_id', $lead->id)
                ->where('order_date', '>=', Carbon::now()->subDays((int) ($settings['bought_days'] ?? 180))->toDateString())
                ->select('id'))
            ->distinct()
            ->pluck('product_id')
            ->all();

        return [$outlet, $declined, $bought];
    }

    /** The ranking with the app's settings; $overrides replaces any of them (a check asks for every drink). */
    public function ranker(array $overrides = []): MenuIdeas
    {
        $settings = (array) config('ife.recommendation.menu', []);

        return new MenuIdeas(
            $overrides + [
                'limit'        => (int) ($settings['idea_limit'] ?? 3),
                'min_score'    => (float) ($settings['min_score'] ?? 0.5),
                'weights'      => (array) ($settings['weights'] ?? []),
                'price_levels' => (array) ($settings['price_levels'] ?? []),
                'area_rules'   => $this->areaRules ??= AreaRule::forRanking(),
            ],
            $this->labels ??= [
                'types'      => Helper::getBusinessCategoryListing(),
                'groups'     => Recipe::customerGroups(),
                'tiers'      => Recipe::PRICE_TIERS,
                'categories' => Recipe::CATEGORIES,
            ],
        );
    }

    /** Every drink as MenuIdeas reads it, loaded once per request. */
    public function drinkFacts(): array
    {
        return $this->drinkFacts ??= Recipe::with('ingredients.product')->get()->map(fn (Recipe $recipe) => [
            'id'              => $recipe->id,
            'slug'            => $recipe->slug,
            'name'            => $recipe->name,
            'serve'           => $recipe->serve,
            'category'        => $recipe->category,
            'description'     => $recipe->description,
            'outlet_types'    => array_map('intval', $recipe->outlet_types ?? []),
            'customer_groups' => $recipe->customer_groups ?? [],
            'price_tier'      => $recipe->price_tier,
            'is_active'       => (bool) $recipe->is_active,
            'everyday'        => (bool) $recipe->everyday,
            'is_halal'        => $recipe->isHalal(),
            'cost_per_serve'  => $recipe->costPerServe(),
            'ingredients'     => $recipe->ingredients->map(fn (RecipeIngredient $ingredient) => [
                'product_id'       => $ingredient->product_id,
                'name'             => optional($ingredient->product)->name,
                'unit'             => optional($ingredient->product)->unit,
                'unit_price'       => (float) optional($ingredient->product)->unit_price,
                'base_monthly_qty' => optional($ingredient->product)->base_monthly_qty,
                'amount_label'     => $ingredient->amount_label,
                'is_active'        => (bool) optional($ingredient->product)->is_active,
            ])->values()->all(),
        ])->all();
    }

    /** Keeps a menu photo with the outlet's documents, tied to its scan. */
    private function storePhoto(MenuScan $scan, User $user, UploadedFile $photo): void
    {
        if (!$photo->isValid()) {
            return;
        }

        $original = pathinfo($photo->getClientOriginalName(), PATHINFO_FILENAME) ?: 'menu';
        $filename = sprintf('menu_%d_%s_%s.%s', $scan->lead_id, time(), uniqid(), $photo->extension() ?: 'jpg');

        Storage::putFileAs("lead/{$scan->lead_id}", new File($photo->getRealPath()), $filename);

        DocumentUpload::create([
            'lead_id'       => $scan->lead_id,
            'menu_scan_id'  => $scan->id,
            'upload_by'     => $user->id,
            'filename'      => $filename,
            'original_name' => mb_substr('Menu ' . $scan->created_at->format('j M Y') . ' ' . $original, 0, 190) . '.' . ($photo->extension() ?: 'jpg'),
            'mime_type'     => $photo->getMimeType(),
            'size'          => $photo->getSize(),
        ]);
    }
}
