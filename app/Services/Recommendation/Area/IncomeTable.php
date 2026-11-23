<?php

namespace App\Services\Recommendation\Area;

/**
 * DOSM household income by district, read from database/data/hh_income_district.csv,
 * with the B40 / M40 / T20 group each district's median falls in.
 *
 * Source: Department of Statistics Malaysia, "Household Income by Administrative
 * District" (data.gov.my), storage.dosm.gov.my/hies/hh_income_district.csv.
 */
final class IncomeTable
{
    /**
     * Every row of the CSV.
     *
     * @return array<int, array{state: string, district: string, year: int, mean_income: ?float, median_income: ?float, income_group: ?string}>
     */
    public static function rows(?string $path = null): array
    {
        $path   = $path ?? database_path('data/hh_income_district.csv');
        $handle = fopen($path, 'r');
        $header = fgetcsv($handle, escape: '');
        $rows   = [];

        while (($row = fgetcsv($handle, escape: '')) !== false) {
            $values = array_combine($header, $row);
            $median = is_numeric($values['income_median']) ? (float) $values['income_median'] : null;

            $rows[] = [
                'state'         => $values['state'],
                'district'      => $values['district'],
                'year'          => (int) substr($values['date'], 0, 4),
                'mean_income'   => is_numeric($values['income_mean']) ? (float) $values['income_mean'] : null,
                'median_income' => $median,
                'income_group'  => self::group($median),
            ];
        }
        fclose($handle);

        return $rows;
    }

    /** The group a monthly household income falls in, on the configured thresholds. */
    public static function group(?float $income): ?string
    {
        if ($income === null) {
            return null;
        }

        $thresholds = config('ife.recommendation.area.income_thresholds');

        return match (true) {
            $income < $thresholds['b40_below'] => 'B40',
            $income >= $thresholds['t20_from'] => 'T20',
            default                            => 'M40',
        };
    }

    /**
     * Normalised district name => income group, for the configured year.
     *
     * @return array<string, string>
     */
    public static function groups(?string $path = null): array
    {
        $year   = (int) config('ife.recommendation.area.income_year');
        $groups = [];

        foreach (self::rows($path) as $row) {
            if ($row['year'] === $year && $row['income_group'] !== null) {
                $groups[trim((string) preg_replace('/[^a-z0-9]+/', ' ', strtolower($row['district'])))] = $row['income_group'];
            }
        }

        return $groups;
    }

    /**
     * Median income per district for the configured year, for the generator.
     *
     * @return array<string, float> DOSM district name => median
     */
    public static function medians(?string $path = null): array
    {
        $year    = (int) config('ife.recommendation.area.income_year');
        $medians = [];

        foreach (self::rows($path) as $row) {
            if ($row['year'] === $year && $row['median_income'] !== null) {
                $medians[$row['district']] = $row['median_income'];
            }
        }

        return $medians;
    }
}
