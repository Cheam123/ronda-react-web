import type { Answers, Condition, ConditionSchema, FormSchema } from '@/types/forms';

/**
 * The condition evaluator, a behavioural twin of
 * App\Services\FormConditionEvaluator and FormSchemaService::resolveVisibility().
 * Keep the two in step: the server re-checks everything on submit, and a
 * difference shows up as fields the user saw but the server discarded.
 *
 * Groups are OR'd; conditions inside a group are AND'd; no schema = always.
 */

type Value = unknown;

export function isEmptyValue(value: Value): boolean {
    if (value === null || value === undefined || value === '') return true;
    if (Array.isArray(value))
        return value.filter((item) => item !== null && item !== undefined && item !== '').length === 0;
    return false;
}

function scalar(value: Value): Value {
    return Array.isArray(value) ? value.join(',') : value;
}

/** Numeric when both sides are numbers, otherwise string order (ISO dates and times sort correctly). */
function compare(actual: Value, expected: Value): number {
    if (isEmptyValue(actual)) return 0; // empty never satisfies gt/lt

    const a = scalar(actual);
    const numA = parseFloat(String(a));
    const numB = parseFloat(String(expected));
    if (
        !Number.isNaN(numA) &&
        !Number.isNaN(numB) &&
        String(numA) === String(a).trim() &&
        String(numB) === String(expected).trim()
    ) {
        return numA > numB ? 1 : numA < numB ? -1 : 0;
    }

    const left = String(a);
    const right = String(expected);
    return left > right ? 1 : left < right ? -1 : 0;
}

function evaluateCondition(condition: Condition, answers: Record<string, Value>): boolean {
    const expected = condition.value;
    const actual = answers[condition.field] ?? null;

    switch (condition.operator) {
        case 'equals':
            return !isEmptyValue(actual) && String(scalar(actual)) === String(expected);
        case 'not_equals':
            return isEmptyValue(actual) || String(scalar(actual)) !== String(expected);
        case 'includes':
            return Array.isArray(actual) && actual.map(String).includes(String(expected));
        case 'not_includes':
            return !Array.isArray(actual) || !actual.map(String).includes(String(expected));
        case 'gt':
            return compare(actual, expected) === 1;
        case 'lt':
            return compare(actual, expected) === -1;
        case 'is_empty':
            return isEmptyValue(actual);
        case 'is_not_empty':
            return !isEmptyValue(actual);
        default:
            return false; // unknown operator: fail closed
    }
}

export function evaluate(schema: ConditionSchema | null | undefined, answers: Record<string, Value>): boolean {
    if (!schema || !schema.groups || schema.groups.length === 0) return true;

    return schema.groups.some((group) => {
        const conditions = group?.conditions ?? [];
        return conditions.length > 0 && conditions.every((condition) => evaluateCondition(condition, answers));
    });
}

/**
 * element id -> visible, cascading section visibility onto members and
 * treating answers of hidden fields as empty, iterated to a fixed point so
 * chained conditions settle.
 */
export function resolveVisibility(
    schema: Pick<FormSchema, 'groups' | 'elements'>,
    answers: Answers,
): Record<string, boolean> {
    const elements = schema.elements ?? [];
    const groups = schema.groups ?? [];

    const visible: Record<string, boolean> = {};
    elements.forEach((element) => {
        visible[element.id] = true;
    });

    for (let pass = 0; pass < 10; pass++) {
        const effective: Record<string, Value> = {};
        Object.keys(answers).forEach((id) => {
            effective[id] = visible[id] === undefined || visible[id] ? answers[id] : null;
        });

        const groupVisible: Record<string, boolean> = {};
        groups.forEach((group) => {
            groupVisible[group.id] = evaluate(group.visible_when ?? null, effective);
        });

        let changed = false;
        elements.forEach((element) => {
            const own = evaluate(element.visible_when ?? null, effective);
            const inGroup = element.group_id ? (groupVisible[element.group_id] ?? true) : true;
            const next = own && inGroup;
            if (next !== visible[element.id]) changed = true;
            visible[element.id] = next;
        });

        if (!changed) break;
    }

    return visible;
}

/** How many conditions a schema holds (for "has conditions" markers). */
export function conditionCount(schema: ConditionSchema | null | undefined): number {
    return (schema?.groups ?? []).reduce((total, group) => total + (group.conditions ?? []).length, 0);
}
