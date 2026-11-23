<?php

namespace App\Services\Menu;

/**
 * Drinks an outlet could add to its menu, best first, each with why and the
 * products it would need.
 *
 * A drink can be an idea when it is active, every ingredient is on sale, it
 * is not on the menu already, the rep hasn't declined it lately, and it is
 * halal if the outlet only stocks halal. An everyday drink (Americano, Teh O…)
 * also needs a menu that lacks it, since most outlets already serve one.
 *
 * Its score is the weighted average of the parts that are known (each part
 * weighs 1 unless settings.weights says otherwise; area weighs 2 in the app).
 * A part that isn't known (the drink has no price level, the outlet has no
 * type, nothing is known about the area) is left out rather than counted as a miss.
 *
 *   type       the outlet's type is one of the drink's outlet types
 *   customers  the rep's main customers and the drink's overlap
 *   area       how well the drink fits the area types around the outlet: for
 *              each type, the share of checks it passes (its customer groups
 *              include the type; its kind and price level are ones the type's
 *              area rule names, when the rule names any), averaged by the
 *              types' shares of the nearby places
 *   needs      what the owner told the rep (weighs 2 in the app): the average of
 *              the checks below that can be made for the drink
 *   price      the outlet's price level against the drink's; one step apart is half
 *   easy       share of the drink's ingredients that drinks on the menu already use
 *   new        the menu has none of this kind of drink (1), one or two (0.5), more (0)
 *
 * The outlet's price level is the menu's when its prices were read, else the
 * rep's typical drink price, else the outlet's segment.
 *
 * The needs checks, one per answer the rep gave:
 *
 *   best sellers         the drink is a kind that sells best there (left out when
 *                        the owner wants to expand the menu or improve their
 *                        drinks, which judge the kind themselves)
 *   Expand the menu      a kind the menu lacks; with no menu, a kind that isn't
 *                        among their best sellers
 *   Attract new customers the drink's share of the area's customer groups that
 *                        aren't among the outlet's main customers
 *   Increase average spend one price level above theirs (1), the same or two
 *                        above (0.5), below (0); at premium, premium is 1
 *   Reduce ingredient cost the average of the share of its ingredients they
 *                        already order or use, and how cheap it is to make
 *                        against the other drinks
 *   Improve existing drinks a kind among their best sellers; with none given, a
 *                        kind already on the menu
 *
 * Plain PHP with no database, so the same rules can be tested on their own.
 */
final class MenuIdeas
{
    private const TIER_RANK = ['budget' => 0, 'mid_range' => 1, 'premium' => 2];

    /** The order an idea's reasons are listed in. */
    private const REASON_ORDER = ['needs', 'customers', 'area', 'new', 'easy', 'price', 'type'];

    /** Monthly quantities are worked out for an outlet of this many seats. */
    private const BASE_SEATS = 50;

    /**
     * @param array{limit?: int, min_score?: float, weights?: array<string, float>, price_levels?: array{budget_below?: float, premium_above?: float}, area_rules?: array<string, array{categories?: string[], tiers?: string[]}>} $settings
     * @param array{types?: array<int, string>, groups?: array<string, string>, tiers?: array<string, string>, categories?: array<string, string>} $labels
     */
    public function __construct(private array $settings = [], private array $labels = [])
    {
    }

    /**
     * @param array{type: ?int, customers: string[], halal_only: bool, seats: ?int, segment: ?string, best_sellers?: string[], goals?: string[], typical_price?: ?float, area?: array{shares?: array<string, float>, evidence?: array<string, array{count: int, nearest: ?int}>, radius?: ?int}} $outlet
     * @param array{on_menu: int[], price_level: ?string} $menu an empty on_menu when the outlet has no menu yet
     * @param array<int, array> $drinks every drink, as MenuScanService::drinkFacts() gives it
     * @param int[] $declined drinks the rep declined here lately
     * @param int[] $bought products the outlet has ordered lately
     * @return array<int, array> the ideas, best first
     */
    public function rank(array $outlet, array $menu, array $drinks, array $declined = [], array $bought = []): array
    {
        $onMenu   = array_flip($menu['on_menu']);
        $declined = array_flip($declined);
        $bought   = array_flip($bought);
        $level    = $menu['price_level']
            ?? self::priceLevel($outlet['typical_price'] ?? null, $this->settings['price_levels'] ?? [])
            ?? $outlet['segment']
            ?? null;

        // What the menu already works with, and how many drinks of each kind it has.
        $menuProducts = [];
        $menuKinds    = [];
        foreach ($drinks as $drink) {
            if (!isset($onMenu[$drink['id']])) {
                continue;
            }
            foreach ($drink['ingredients'] as $ingredient) {
                $menuProducts[$ingredient['product_id']] = true;
            }
            if ($drink['category'] !== null) {
                $menuKinds[$drink['category']] = ($menuKinds[$drink['category']] ?? 0) + 1;
            }
        }
        $menuKnown = $onMenu !== [];

        $candidates = array_values(array_filter($drinks, function (array $drink) use ($onMenu, $declined, $outlet, $menuKnown) {
            if (!$drink['is_active'] || isset($onMenu[$drink['id']]) || isset($declined[$drink['id']])) {
                return false;
            }
            // Most outlets already serve an everyday drink: only a menu can show it's missing.
            if (($drink['everyday'] ?? false) && !$menuKnown) {
                return false;
            }
            if ($drink['ingredients'] === [] || in_array(false, array_column($drink['ingredients'], 'is_active'), true)) {
                return false;
            }

            return !$outlet['halal_only'] || $drink['is_halal'];
        }));

        // What the needs checks compare a drink with.
        $costs   = array_map(fn (array $drink) => (float) $drink['cost_per_serve'], $candidates);
        $context = [
            'menu_known'    => $menuKnown,
            'menu_kinds'    => $menuKinds,
            'menu_products' => $menuProducts,
            'bought'        => $bought,
            'level'         => $level,
            'cheapest'      => $costs === [] ? null : min($costs),
            'dearest'       => $costs === [] ? null : max($costs),
        ];

        $ideas = [];
        foreach ($candidates as $drink) {
            $parts   = [];
            $why    = [];

            if ($outlet['type'] !== null && $drink['outlet_types'] !== []) {
                $parts['type'] = in_array($outlet['type'], $drink['outlet_types'], true) ? 1.0 : 0.0;
                if ($parts['type'] === 1.0) {
                    $why['type'][] = 'Suits a ' . $this->label('types', $outlet['type'], 'outlet like this');
                }
            }

            if ($outlet['customers'] !== [] && $drink['customer_groups'] !== []) {
                $shared             = array_values(array_intersect($outlet['customers'], $drink['customer_groups']));
                $parts['customers'] = count($shared) / min(count($outlet['customers']), count($drink['customer_groups']));
                if ($shared !== []) {
                    $why['customers'][] = 'For their customers: ' . implode(', ', array_map(fn ($group) => $this->label('groups', $group, ucfirst($group)), $shared));
                }
            }

            $area = $this->areaPart($drink, $outlet['area'] ?? []);
            if ($area !== null) {
                $parts['area'] = $area['score'];
                if ($area['reason'] !== null) {
                    $why['area'][] = $area['reason'];
                }
            }

            $needs = $this->needsPart($drink, $outlet, $context);
            if ($needs !== null) {
                $parts['needs'] = $needs['score'];
                $why['needs']   = $needs['reasons'];
            }

            if ($level !== null && isset(self::TIER_RANK[$level], self::TIER_RANK[$drink['price_tier'] ?? ''])) {
                $steps          = abs(self::TIER_RANK[$level] - self::TIER_RANK[$drink['price_tier']]);
                $parts['price'] = $steps === 0 ? 1.0 : ($steps === 1 ? 0.5 : 0.0);
                if ($steps === 0) {
                    $why['price'][] = 'Fits their ' . mb_strtolower($this->label('tiers', $level, $level)) . ' prices';
                }
            }

            if ($menuKnown) {
                $shared        = array_values(array_filter($drink['ingredients'], fn ($ingredient) => isset($menuProducts[$ingredient['product_id']])));
                $parts['easy'] = count($shared) / count($drink['ingredients']);
                if ($shared !== []) {
                    $why['easy'][] = sprintf(
                        'Uses %s, which their menu already needs',
                        self::listNames(array_map(fn ($ingredient) => mb_strtolower((string) $ingredient['name']), array_slice($shared, 0, 2)))
                    );
                }

                if ($drink['category'] !== null) {
                    $have         = $menuKinds[$drink['category']] ?? 0;
                    $parts['new'] = $have === 0 ? 1.0 : ($have <= 2 ? 0.5 : 0.0);
                    $kind         = $this->kindName($drink['category']);
                    if ($have === 0) {
                        $why['new'][] = "Their menu has no {$kind} yet";
                    } elseif ($have === 1) {
                        $why['new'][] = "Their menu has only one {$kind} drink";
                    }
                }
            }

            if ($parts === []) {
                continue;
            }

            $score = $this->weighted($parts);
            if ($score < (float) ($this->settings['min_score'] ?? 0.5)) {
                continue;
            }

            $products = $this->products($drink, $outlet['seats'], $bought);

            $ideas[] = [
                'recipe_id'         => $drink['id'],
                'slug'              => $drink['slug'],
                'name'              => $drink['name'],
                'serve'             => $drink['serve'],
                'category'          => $drink['category'],
                'description'       => $drink['description'],
                'score'             => round($score, 3),
                'parts'             => array_map(fn (float $part) => round($part, 3), $parts),
                // Strongest first: what the owner said, then who comes, what the menu lacks; the outlet type last.
                'reasons'           => array_merge(...array_map(fn (string $part) => $why[$part] ?? [], self::REASON_ORDER)),
                'cost_per_serve'    => $drink['cost_per_serve'],
                'products'          => $products,
                'est_monthly_value' => round(array_sum(array_map(fn ($product) => $product['already_buys'] ? 0 : $product['value'], $products)), 2),
            ];
        }

        // Best first; the same score goes by name, never by id.
        usort($ideas, fn ($a, $b) => [$b['score'], $a['name']] <=> [$a['score'], $b['name']]);

        return array_slice($ideas, 0, (int) ($this->settings['limit'] ?? 3));
    }

    /**
     * Every product the drink needs, with a starting monthly quantity scaled
     * to the outlet's seats (never below half or above double the typical one).
     *
     * @param array<int, true> $bought
     * @return array<int, array{product_id: int, name: ?string, unit: ?string, unit_price: float, amount: ?string, quantity: float, value: float, already_buys: bool}>
     */
    private function products(array $drink, ?int $seats, array $bought): array
    {
        $scale = $seats ? min(2.0, max(0.5, $seats / self::BASE_SEATS)) : 1.0;

        return array_map(function (array $ingredient) use ($scale, $bought) {
            $typical  = (float) ($ingredient['base_monthly_qty'] ?? 0);
            $quantity = $typical > 0 ? max(1.0, round($typical * $scale)) : 1.0;

            return [
                'product_id'   => $ingredient['product_id'],
                'name'         => $ingredient['name'],
                'unit'         => $ingredient['unit'],
                'unit_price'   => round((float) $ingredient['unit_price'], 2),
                'amount'       => $ingredient['amount_label'],
                'quantity'     => $quantity,
                'value'        => round($quantity * (float) $ingredient['unit_price'], 2),
                'already_buys' => isset($bought[$ingredient['product_id']]),
            ];
        }, $drink['ingredients']);
    }

    /** @param array<string, float> $parts */
    private function weighted(array $parts): float
    {
        $weights = $this->settings['weights'] ?? [];
        $sum     = 0.0;
        $total   = 0.0;

        foreach ($parts as $name => $value) {
            $weight = max(0.0, (float) ($weights[$name] ?? 1.0));
            $sum   += $weight * $value;
            $total += $weight;
        }

        return $total > 0 ? $sum / $total : 0.0;
    }

    /** The price level a drink price points to, as for a menu's middle price; null for no price. */
    public static function priceLevel(?float $price, array $levels = []): ?string
    {
        if ($price === null) {
            return null;
        }

        return match (true) {
            $price < (float) ($levels['budget_below'] ?? 8)   => 'budget',
            $price > (float) ($levels['premium_above'] ?? 14) => 'premium',
            default                                           => 'mid_range',
        };
    }

    /**
     * How well a drink meets what the owner told the rep: their best sellers
     * and each goal they picked, averaged over the checks that can be made.
     * Null when the rep recorded none, or none can be checked for this drink.
     *
     * @return array{score: float, reasons: string[]}|null
     */
    private function needsPart(array $drink, array $outlet, array $context): ?array
    {
        $sellers = array_values($outlet['best_sellers'] ?? []);
        $goals   = array_values($outlet['goals'] ?? []);
        $kind    = $drink['category'];
        $checks  = [];

        // What already sells is a safe bet, unless a goal judges the kind itself.
        if ($sellers !== [] && $kind !== null && array_intersect($goals, ['expand_menu', 'improve_drinks']) === []) {
            $hit      = in_array($kind, $sellers, true);
            $checks[] = ['score' => $hit ? 1.0 : 0.0, 'reason' => $hit ? 'Like their best sellers: ' . $this->kindName($kind) : null];
        }

        foreach ($goals as $goal) {
            $checks[] = match ($goal) {
                'expand_menu'     => $this->widensMenu($kind, $sellers, $context),
                'new_customers'   => $this->drawsNewCustomers($drink, $outlet),
                'average_spend'   => $this->raisesSpend($drink, $context['level']),
                'ingredient_cost' => $this->cutsCost($drink, $context),
                'improve_drinks'  => $this->improvesDrinks($kind, $sellers, $context),
                default           => null,
            };
        }

        $checks = array_values(array_filter($checks));
        if ($checks === []) {
            return null;
        }

        return [
            'score'   => array_sum(array_column($checks, 'score')) / count($checks),
            'reasons' => array_values(array_unique(array_filter(array_column($checks, 'reason')))),
        ];
    }

    /** Expand the menu: a kind the menu lacks, or with no menu, one that isn't among their best sellers. */
    private function widensMenu(?string $kind, array $sellers, array $context): ?array
    {
        if ($kind === null) {
            return null;
        }
        if ($context['menu_known']) {
            // The new part already says "Their menu has no matcha yet".
            return ['score' => isset($context['menu_kinds'][$kind]) ? 0.0 : 1.0, 'reason' => null];
        }
        if ($sellers === []) {
            return null;
        }

        $new = !in_array($kind, $sellers, true);

        return ['score' => $new ? 1.0 : 0.0, 'reason' => $new ? 'Different from their best sellers, to widen the menu' : null];
    }

    /** Attract new customers: the drink's share of the area's groups that aren't the outlet's main customers. */
    private function drawsNewCustomers(array $drink, array $outlet): ?array
    {
        $shares = array_filter($outlet['area']['shares'] ?? [], fn ($share) => $share > 0);
        $new    = array_diff_key($shares, array_flip($outlet['customers']));
        if ($new === [] || $drink['customer_groups'] === []) {
            return null;
        }

        $reached = array_intersect_key($new, array_flip($drink['customer_groups']));
        arsort($reached);
        $names = array_map(fn ($group) => mb_strtolower($this->label('groups', $group, (string) $group)), array_slice(array_keys($reached), 0, 2));

        return [
            'score'  => array_sum($reached) / array_sum($new),
            'reason' => $names === [] ? null : 'Could bring in ' . self::listNames($names) . ' from nearby',
        ];
    }

    /** Increase average spend: one price level above theirs is best. */
    private function raisesSpend(array $drink, ?string $level): ?array
    {
        if ($level === null || !isset(self::TIER_RANK[$level], self::TIER_RANK[$drink['price_tier'] ?? ''])) {
            return null;
        }

        $step  = self::TIER_RANK[$drink['price_tier']] - self::TIER_RANK[$level];
        $score = match (true) {
            $step === 1, $step === 0 && $level === 'premium' => 1.0,
            $step === 0, $step === 2                         => 0.5,
            default                                          => 0.0,
        };

        return [
            'score'  => $score,
            'reason' => $step === 1 ? 'A step up from their ' . mb_strtolower($this->label('tiers', $level, $level)) . ' prices, to raise spend' : null,
        ];
    }

    /** Reduce ingredient cost: products they already order or use, and cheap to make. */
    private function cutsCost(array $drink, array $context): ?array
    {
        $scores = [];
        $reason = null;

        $known = $context['menu_products'] + $context['bought'];
        if ($known !== []) {
            $reused   = array_filter($drink['ingredients'], fn ($ingredient) => isset($known[$ingredient['product_id']]));
            $scores[] = count($reused) / count($drink['ingredients']);

            $ordered = array_values(array_filter($drink['ingredients'], fn ($ingredient) => isset($context['bought'][$ingredient['product_id']])));
            if ($ordered !== []) {
                $reason = sprintf(
                    'Uses %s, which they already order',
                    self::listNames(array_map(fn ($ingredient) => mb_strtolower((string) $ingredient['name']), array_slice($ordered, 0, 2)))
                );
            }
        }

        if ($context['dearest'] !== null) {
            $spread   = $context['dearest'] - $context['cheapest'];
            $cheap    = $spread > 0 ? 1 - ((float) $drink['cost_per_serve'] - $context['cheapest']) / $spread : 1.0;
            $scores[] = $cheap;
            if ($reason === null && $spread > 0 && $cheap >= 0.75) {
                $reason = 'One of the cheapest drinks to make';
            }
        }

        return $scores === [] ? null : ['score' => array_sum($scores) / count($scores), 'reason' => $reason];
    }

    /** Improve existing drinks: a kind among their best sellers, or with none given, one on the menu. */
    private function improvesDrinks(?string $kind, array $sellers, array $context): ?array
    {
        if ($kind === null) {
            return null;
        }
        if ($sellers !== []) {
            $hit = in_array($kind, $sellers, true);

            return ['score' => $hit ? 1.0 : 0.0, 'reason' => $hit ? 'A better take on the ' . $this->kindName($kind) . ' they sell most' : null];
        }
        if ($context['menu_known']) {
            $hit = isset($context['menu_kinds'][$kind]);

            return ['score' => $hit ? 1.0 : 0.0, 'reason' => $hit ? 'Builds on the ' . $this->kindName($kind) . ' on their menu' : null];
        }

        return null;
    }

    /** "fruit tea" */
    private function kindName(string $kind): string
    {
        return mb_strtolower($this->label('categories', $kind, str_replace('_', ' ', $kind)));
    }

    /**
     * How well a drink fits the area types around the outlet, and the one it
     * fits best as a reason. Null when nothing is known about the area.
     *
     * @param array{shares?: array<string, float>, evidence?: array<string, array{count: int, nearest: ?int}>, radius?: ?int} $area
     * @return array{score: float, reason: ?string}|null
     */
    private function areaPart(array $drink, array $area): ?array
    {
        $shares = array_filter($area['shares'] ?? [], fn ($share) => $share > 0);
        if ($shares === []) {
            return null;
        }

        $sum       = 0.0;
        $best      = null;
        $bestValue = 0.0;
        foreach ($shares as $kind => $share) {
            $fit  = $this->areaFit($drink, (string) $kind);
            $sum += $share * $fit;
            if ($fit > 0 && $share * $fit > $bestValue) {
                $best      = (string) $kind;
                $bestValue = $share * $fit;
            }
        }

        return [
            'score'  => $sum / array_sum($shares),
            'reason' => $best === null ? null : $this->areaReason($best, $area),
        ];
    }

    /** Share of the checks a drink passes for one area type: its customers, then the rule's kinds and price levels when it names any. */
    private function areaFit(array $drink, string $kind): float
    {
        $rule   = $this->settings['area_rules'][$kind] ?? [];
        $checks = [
            // A drink tagged for no one suits anyone, as on the drink form.
            $drink['customer_groups'] === [] || in_array($kind, $drink['customer_groups'], true),
        ];
        if (!empty($rule['categories']) && $drink['category'] !== null) {
            $checks[] = in_array($drink['category'], $rule['categories'], true);
        }
        if (!empty($rule['tiers']) && ($drink['price_tier'] ?? null) !== null) {
            $checks[] = in_array($drink['price_tier'], $rule['tiers'], true);
        }

        return count(array_filter($checks)) / count($checks);
    }

    /** "Students nearby: 3 places within 1 km, the nearest 400 m away" */
    private function areaReason(string $kind, array $area): string
    {
        $who     = $this->label('groups', $kind, ucfirst($kind));
        $count   = (int) ($area['evidence'][$kind]['count'] ?? 0);
        $nearest = $area['evidence'][$kind]['nearest'] ?? null;
        $radius  = $area['radius'] ?? null;

        if ($count === 0) {
            return "{$who} nearby";
        }

        $text = sprintf('%s nearby: %d %s', $who, $count, $count === 1 ? 'place' : 'places');
        if ($radius !== null) {
            $text .= ' within ' . self::distance((int) $radius);
        }
        if ($nearest !== null) {
            $text .= ', the nearest ' . self::distance((int) $nearest) . ' away';
        }

        return $text;
    }

    /** "400 m" under a kilometre (to the nearest 10 m), "1.2 km" from there. */
    private static function distance(int $metres): string
    {
        if ($metres < 1000) {
            return ((int) round($metres / 10) * 10) . ' m';
        }

        $km = round($metres / 100) / 10;

        return ($km == floor($km) ? (string) (int) $km : number_format($km, 1)) . ' km';
    }

    private function label(string $set, int|string $key, string $fallback): string
    {
        return (string) ($this->labels[$set][$key] ?? $fallback);
    }

    private static function listNames(array $names): string
    {
        return count($names) > 1 ? implode(', ', array_slice($names, 0, -1)) . ' and ' . end($names) : ($names[0] ?? '');
    }
}
