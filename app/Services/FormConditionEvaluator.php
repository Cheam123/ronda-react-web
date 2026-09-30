<?php

namespace App\Services;

/**
 * Evaluates the shared condition-group schema used for field visibility
 * (visible_when), group visibility, and process branch conditions (when).
 *
 * Schema:
 * {
 *   "logic": "or",
 *   "groups": [
 *     { "logic": "and", "conditions": [
 *         { "field": "el_xxx", "operator": "equals", "value": "VIP" }
 *     ]}
 *   ]
 * }
 *
 * Groups are OR'd together; conditions inside a group are AND'd.
 * A null schema always evaluates to true.
 *
 * The TypeScript port lives in resources/js/lib/forms/conditions.ts and must
 * stay behaviourally identical.
 */
class FormConditionEvaluator
{
    public const OPERATORS = [
        'equals', 'not_equals',
        'includes', 'not_includes',
        'gt', 'lt',
        'is_empty', 'is_not_empty',
    ];

    /**
     * @param array|null $schema       condition schema (null = always true)
     * @param array      $answersById  element id => submitted value
     */
    public function evaluate(?array $schema, array $answersById): bool
    {
        if (empty($schema) || empty($schema['groups'])) {
            return true;
        }

        foreach ($schema['groups'] as $group) {
            if ($this->evaluateGroup($group, $answersById)) {
                return true; // groups are OR'd
            }
        }

        return false;
    }

    private function evaluateGroup(array $group, array $answersById): bool
    {
        $conditions = $group['conditions'] ?? [];

        if (empty($conditions)) {
            return false;
        }

        foreach ($conditions as $condition) {
            if (!$this->evaluateCondition($condition, $answersById)) {
                return false; // conditions are AND'd
            }
        }

        return true;
    }

    private function evaluateCondition(array $condition, array $answersById): bool
    {
        $operator = $condition['operator'] ?? null;
        $expected = $condition['value'] ?? null;
        $actual   = $answersById[$condition['field'] ?? ''] ?? null;

        switch ($operator) {
            case 'equals':
                return !$this->isEmptyValue($actual) && (string) $this->scalar($actual) === (string) $expected;

            case 'not_equals':
                return $this->isEmptyValue($actual) || (string) $this->scalar($actual) !== (string) $expected;

            case 'includes':
                return is_array($actual) && in_array((string) $expected, array_map('strval', $actual), true);

            case 'not_includes':
                return !is_array($actual) || !in_array((string) $expected, array_map('strval', $actual), true);

            case 'gt':
                return $this->compare($actual, $expected) === 1;

            case 'lt':
                return $this->compare($actual, $expected) === -1;

            case 'is_empty':
                return $this->isEmptyValue($actual);

            case 'is_not_empty':
                return !$this->isEmptyValue($actual);

            default:
                return false; // unknown operator: fail closed
        }
    }

    public function isEmptyValue($value): bool
    {
        if ($value === null || $value === '') {
            return true;
        }

        if (is_array($value)) {
            return count(array_filter($value, fn ($v) => $v !== null && $v !== '')) === 0;
        }

        return false;
    }

    /** Numeric compare when both sides are numeric, otherwise string compare (ISO dates/times sort correctly). */
    private function compare($actual, $expected): int
    {
        if ($this->isEmptyValue($actual)) {
            return 0; // empty never satisfies gt/lt
        }

        $a = $this->scalar($actual);

        if (is_numeric($a) && is_numeric($expected)) {
            return (float) $a <=> (float) $expected;
        }

        return strcmp((string) $a, (string) $expected) <=> 0;
    }

    private function scalar($value)
    {
        return is_array($value) ? implode(',', $value) : $value;
    }
}
