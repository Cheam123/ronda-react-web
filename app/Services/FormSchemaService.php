<?php

namespace App\Services;

use App\Models\FormSubmission;
use App\Models\User;
use Illuminate\Support\Carbon;

/**
 * Owns the versioned form_elements schema.
 *
 * v1 (legacy): plain JSON array of elements {type,label,mandatory,values,min,max,apply_min_date},
 *              identity = array position.
 * v2:          {schema_version:2, groups:[{id,label,order,visible_when}],
 *               elements:[{id,kind:field|description,type,label,text,mandatory,values,min,max,
 *                          apply_min_date,group_id,order,visible_when}]}
 *
 * All read paths consume the normalized v2 shape returned by normalize();
 * legacy rows are upgraded on the fly (deterministic el_legacy_{index} ids)
 * and only persisted as v2 when the form is saved from the new builder.
 */
class FormSchemaService
{
    public const FIELD_TYPES = [
        'text', 'textarea', 'email', 'tel', 'number', 'date', 'time',
        'select', 'multi-choice', 'multi-select', 'checkbox', 'file', 'user', 'gps',
    ];

    /** How a `gps` field captures: on form open, or when the user taps the button. */
    public const GPS_CAPTURE_MODES = ['auto', 'manual'];

    /** Request-memoised user list for `user` fields (id => name). */
    private static ?array $userOptions = null;

    /** Field types allowed as condition sources, mapped to their operators. */
    public const CONDITION_OPERATORS = [
        'text'         => ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
        'textarea'     => ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
        'email'        => ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
        'tel'          => ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
        'select'       => ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
        'number'       => ['equals', 'not_equals', 'gt', 'lt', 'is_empty', 'is_not_empty'],
        'multi-choice' => ['includes', 'not_includes', 'is_empty', 'is_not_empty'],
        'multi-select' => ['includes', 'not_includes', 'is_empty', 'is_not_empty'],
        'checkbox'     => ['includes', 'not_includes', 'is_empty', 'is_not_empty'],
        'date'         => ['equals', 'not_equals', 'gt', 'lt', 'is_empty', 'is_not_empty'],
        'time'         => ['equals', 'not_equals', 'gt', 'lt', 'is_empty', 'is_not_empty'],
        'file'         => ['is_empty', 'is_not_empty'],
        'user'         => ['equals', 'not_equals', 'is_empty', 'is_not_empty'],
        'gps'          => ['is_empty', 'is_not_empty'],
    ];

    private FormConditionEvaluator $conditions;

    public function __construct(?FormConditionEvaluator $conditions = null)
    {
        $this->conditions = $conditions ?? new FormConditionEvaluator();
    }

    /**
     * Selectable people for `user` fields: id => name. Memoised per request
     * so render partials can call it per field without hitting the DB again.
     *
     * @return array<int,string>
     */
    public function userOptions(): array
    {
        if (self::$userOptions === null) {
            self::$userOptions = User::orderBy('name')->pluck('name', 'id')
                ->mapWithKeys(fn ($name, $id) => [(int) $id => (string) $name])
                ->all();
        }

        return self::$userOptions;
    }

    /**
     * The people a specific `user` element offers. `user_source: 'selected'`
     * narrows the list to `user_ids`; anything else offers everyone. An empty
     * selection falls back to everyone so a misconfigured field is still
     * usable (the builder blocks saving that state).
     *
     * @return array<int,string>
     */
    public function userOptionsFor(array $element): array
    {
        $all = $this->userOptions();

        if (($element['user_source'] ?? 'all') !== 'selected') {
            return $all;
        }

        $ids = array_filter(array_map('intval', $element['user_ids'] ?? []));
        if (empty($ids)) {
            return $all;
        }

        return array_intersect_key($all, array_flip($ids));
    }

    /** Display label for a `user` field value (id -> name). */
    public function userLabel($value): string
    {
        if ($this->conditions->isEmptyValue($value)) {
            return '';
        }

        $options = $this->userOptions();
        $ids     = is_array($value) ? $value : [$value];
        $names   = [];

        foreach ($ids as $id) {
            $names[] = $options[(int) $id] ?? ('User #' . $id);
        }

        return implode(', ', $names);
    }

    /** Test seam: drop the memoised user list. */
    public static function flushUserOptions(): void
    {
        self::$userOptions = null;
    }

    /**
     * Normalize raw form_elements (v1 array or v2 object) to the v2 shape.
     */
    public function normalize($raw): array
    {
        $raw = $raw ?: [];

        if (isset($raw['schema_version']) && (int) $raw['schema_version'] >= 2) {
            return [
                'schema_version' => 2,
                'groups'         => array_values($raw['groups'] ?? []),
                'elements'       => array_values($raw['elements'] ?? []),
            ];
        }

        // Legacy v1: flat positional array of field elements.
        $elements = [];
        foreach (array_values($raw) as $index => $element) {
            $elements[] = [
                'id'             => 'el_legacy_' . $index,
                'kind'           => 'field',
                'type'           => $element['type'] ?? 'text',
                'label'          => $element['label'] ?? ('Field ' . ($index + 1)),
                'mandatory'      => (bool) ($element['mandatory'] ?? false),
                'values'         => $element['values'] ?? [],
                'min'            => $element['min'] ?? null,
                'max'            => $element['max'] ?? null,
                'min_days'       => $element['min_days'] ?? null, // date fields: earliest allowed = today + N days
                'group_id'       => null,
                'order'          => $index * 10,
                'visible_when'   => null,
            ];
        }

        return [
            'schema_version' => 2,
            'groups'         => [],
            'elements'       => $elements,
        ];
    }

    /**
     * Structural validation of a v2 definition posted by the builder.
     *
     * @return array list of error strings (empty = valid)
     */
    public function validateDefinition(array $schema): array
    {
        $errors = [];

        $groups   = array_values($schema['groups'] ?? []);
        $elements = array_values($schema['elements'] ?? []);

        if (empty($elements)) {
            $errors[] = 'The form must contain at least one element.';
        }

        $groupIds = [];
        foreach ($groups as $group) {
            $id = $group['id'] ?? null;
            if (!$id) {
                $errors[] = 'A group is missing its id.';
                continue;
            }
            if (isset($groupIds[$id])) {
                $errors[] = "Duplicate group id: {$id}.";
            }
            $groupIds[$id] = true;
            if (trim((string) ($group['label'] ?? '')) === '') {
                $errors[] = 'Every group needs a label.';
            }
        }

        $elementIds = [];
        $hasField   = false;
        foreach ($elements as $element) {
            $id = $element['id'] ?? null;
            if (!$id) {
                $errors[] = 'An element is missing its id.';
                continue;
            }
            if (isset($elementIds[$id])) {
                $errors[] = "Duplicate element id: {$id}.";
            }
            $elementIds[$id] = true;

            $kind = $element['kind'] ?? 'field';
            if ($kind === 'field') {
                $hasField = true;
                if (!in_array($element['type'] ?? '', self::FIELD_TYPES, true)) {
                    $errors[] = "Element {$id} has an unknown type.";
                }
                if (trim((string) ($element['label'] ?? '')) === '') {
                    $errors[] = 'Every field needs a label.';
                }
                if (($element['type'] ?? '') === 'user'
                    && ($element['user_source'] ?? 'all') === 'selected'
                    && empty(array_filter(array_map('intval', $element['user_ids'] ?? [])))) {
                    $errors[] = 'Person field "' . ($element['label'] ?? $id)
                        . '" is limited to selected people but none are selected.';
                }
                if (($element['type'] ?? '') === 'gps'
                    && !in_array($element['capture_mode'] ?? 'auto', self::GPS_CAPTURE_MODES, true)) {
                    $errors[] = 'Location Stamp field "' . ($element['label'] ?? $id)
                        . '" must stamp either when the form opens or when tapped.';
                }
            } elseif ($kind === 'description') {
                if (trim((string) ($element['text'] ?? '')) === '') {
                    $errors[] = 'Every description block needs text.';
                }
            } else {
                $errors[] = "Element {$id} has an unknown kind.";
            }

            $groupId = $element['group_id'] ?? null;
            if ($groupId !== null && !isset($groupIds[$groupId])) {
                $errors[] = "Element {$id} references a missing group.";
            }
        }

        if (!$hasField) {
            $errors[] = 'The form must contain at least one input field.';
        }

        foreach ($elements as $element) {
            $errors = array_merge($errors, $this->validateConditionSchema(
                $element['visible_when'] ?? null,
                $elementIds,
                'element "' . ($element['label'] ?? $element['id'] ?? '?') . '"'
            ));
        }
        foreach ($groups as $group) {
            $errors = array_merge($errors, $this->validateConditionSchema(
                $group['visible_when'] ?? null,
                $elementIds,
                'group "' . ($group['label'] ?? $group['id'] ?? '?') . '"'
            ));
        }

        return $errors;
    }

    /**
     * Validates a condition-group schema (shared by visible_when and branch when).
     *
     * @param array $validFieldIds element id => true
     */
    public function validateConditionSchema(?array $schema, array $validFieldIds, string $context): array
    {
        if (empty($schema)) {
            return [];
        }

        $errors = [];
        foreach ($schema['groups'] ?? [] as $group) {
            foreach ($group['conditions'] ?? [] as $condition) {
                $field = $condition['field'] ?? null;
                if (!$field || !isset($validFieldIds[$field])) {
                    $errors[] = "A condition on {$context} references a missing field.";
                }
                if (!in_array($condition['operator'] ?? '', FormConditionEvaluator::OPERATORS, true)) {
                    $errors[] = "A condition on {$context} uses an unknown operator.";
                }
            }
        }

        return $errors;
    }

    /**
     * Ordered render tree for the form pages: top-level items are either
     * ['kind' => 'group', 'group' => g, 'elements' => [...]] or
     * ['kind' => 'element', 'element' => e], interleaved by order.
     */
    public function renderTree(array $schema): array
    {
        $groups   = collect($schema['groups'] ?? []);
        $elements = collect($schema['elements'] ?? []);

        $items = [];

        foreach ($groups as $group) {
            $items[] = [
                'kind'     => 'group',
                'order'    => (int) ($group['order'] ?? 0),
                'group'    => $group,
                'elements' => $elements
                    ->where('group_id', $group['id'])
                    ->sortBy(fn ($e) => (int) ($e['order'] ?? 0))
                    ->values()
                    ->all(),
            ];
        }

        foreach ($elements->whereNull('group_id') as $element) {
            $items[] = [
                'kind'    => 'element',
                'order'   => (int) ($element['order'] ?? 0),
                'element' => $element,
            ];
        }

        usort($items, fn ($a, $b) => $a['order'] <=> $b['order']);

        return $items;
    }

    /**
     * Map an answers snapshot (v2 with ids, or legacy positional) to element id => value.
     */
    public function answersById($snapshot, array $schema): array
    {
        $snapshot = array_values($snapshot ?? []);
        $answers  = [];
        $byLabel  = [];

        foreach ($snapshot as $index => $entry) {
            if (!is_array($entry)) {
                continue;
            }
            if (!empty($entry['id'])) {
                $answers[$entry['id']] = $entry['value'] ?? null;
            } else {
                // Legacy positional snapshot: normalize() gives v1 elements
                // el_legacy_{index} ids, so position maps directly.
                $answers['el_legacy_' . $index] = $entry['value'] ?? null;
                if (!empty($entry['label'])) {
                    $byLabel[$entry['label']] = $entry['value'] ?? null;
                }
            }
        }

        // Label fallback covers legacy snapshots rendered against a re-saved (v2) form.
        if (!empty($byLabel)) {
            foreach ($schema['elements'] ?? [] as $element) {
                $id = $element['id'] ?? null;
                if ($id && !array_key_exists($id, $answers) && isset($byLabel[$element['label'] ?? ''])) {
                    $answers[$id] = $byLabel[$element['label']];
                }
            }
        }

        return $answers;
    }

    /**
     * Resolve per-element visibility (element id => bool) applying:
     * - element visible_when
     * - group visible_when cascading onto members
     * - conditions referencing hidden fields see their value as empty
     * Iterates to a fixed point so chained conditions settle deterministically.
     */
    public function resolveVisibility(array $schema, array $answersById): array
    {
        $elements = array_values($schema['elements'] ?? []);
        $groups   = collect($schema['groups'] ?? [])->keyBy('id');

        $visible = [];
        foreach ($elements as $element) {
            $visible[$element['id']] = true;
        }

        for ($pass = 0; $pass < 10; $pass++) {
            // Hidden fields contribute empty answers to condition evaluation.
            $effectiveAnswers = [];
            foreach ($answersById as $id => $value) {
                $effectiveAnswers[$id] = ($visible[$id] ?? true) ? $value : null;
            }

            $groupVisible = [];
            foreach ($groups as $id => $group) {
                $groupVisible[$id] = $this->conditions->evaluate($group['visible_when'] ?? null, $effectiveAnswers);
            }

            $next    = [];
            $changed = false;
            foreach ($elements as $element) {
                $own   = $this->conditions->evaluate($element['visible_when'] ?? null, $effectiveAnswers);
                $group = $element['group_id'] ? ($groupVisible[$element['group_id']] ?? true) : true;
                $next[$element['id']] = $own && $group;
                if ($next[$element['id']] !== $visible[$element['id']]) {
                    $changed = true;
                }
            }

            $visible = $next;
            if (!$changed) {
                break;
            }
        }

        return $visible;
    }

    /**
     * Server-side enforcement on submit: builds the canonical answers snapshot
     * from client data, discarding values of hidden elements and validating
     * mandatory visible fields.
     *
     * Elements in $deferredIds belong to later fill phases: their values are
     * not collected from the submitter and their mandatory flag is not
     * enforced here — the fill phase enforces it when that stage completes.
     *
     * @param array $clientData  array of {id?, type?, label?, value} entries
     * @param array $deferredIds element ids owned by later fill phases
     * @return array{snapshot: array, errors: array<string,string>}
     */
    public function sanitizeAnswers(array $schema, array $clientData, array $deferredIds = []): array
    {
        $clientAnswers = $this->answersById($clientData, $schema);
        $visibility    = $this->resolveVisibility($schema, $clientAnswers);

        $snapshot = [];
        $errors   = [];

        foreach ($schema['elements'] ?? [] as $element) {
            if (($element['kind'] ?? 'field') !== 'field') {
                continue;
            }

            $id       = $element['id'];
            $deferred = in_array($id, $deferredIds, true);
            $visible  = $visibility[$id] ?? true;
            $value    = ($visible && !$deferred) ? ($clientAnswers[$id] ?? null) : null;

            // Location stamps are captured by the device, never typed, so
            // anything that is not a real coordinate pair is refused. Runs
            // before the mandatory check so "{}" cannot pass as an answer.
            $gpsError = null;
            if (($element['type'] ?? '') === 'gps') {
                $gps      = $this->normalizeGps($element, $value);
                $value    = $gps['value'];
                $gpsError = $gps['error'];
            }

            if ($visible && !$deferred && ($element['mandatory'] ?? false) && $this->conditions->isEmptyValue($value)) {
                $errors[$id] = ($element['label'] ?? 'This field') . ' is required.';
            }

            // A malformed stamp says why, rather than just "required".
            if ($gpsError !== null) {
                $errors[$id] = $gpsError;
            }

            // "Pick 2 to 4" was enforced only by the web page's own JavaScript,
            // so any other client — the mobile app, a replayed request — could
            // store as many options as it liked. The builder's rule has to hold
            // wherever the answer comes from.
            if (in_array($element['type'] ?? '', ['multi-choice', 'multi-select'], true)
                && $visible && !$deferred && !$this->conditions->isEmptyValue($value)) {
                $chosen = is_array($value) ? count(array_filter($value, fn ($v) => $v !== null && $v !== '')) : 1;
                $min    = (int) ($element['min'] ?? 0);
                $max    = (int) ($element['max'] ?? 0);
                $label  = $element['label'] ?? 'This field';

                if ($min > 0 && $chosen < $min) {
                    $errors[$id] = $label . ': select at least ' . $min . ' option' . ($min === 1 ? '' : 's') . '.';
                } elseif ($max > 0 && $chosen > $max) {
                    $errors[$id] = $label . ': select no more than ' . $max . ' option' . ($max === 1 ? '' : 's') . '.';
                }
            }

            // Person pickers must carry a user id the field actually offers —
            // the process engine may resolve a handler from this value, so a
            // tampered id must never slip through.
            if (($element['type'] ?? '') === 'user' && !$this->conditions->isEmptyValue($value)) {
                $picked = (int) (is_array($value) ? reset($value) : $value);
                if (!isset($this->userOptionsFor($element)[$picked])) {
                    $errors[$id] = 'Select a valid person for ' . ($element['label'] ?? 'this field') . '.';
                } else {
                    $value = $picked;
                }
            }

            $snapshot[] = [
                'id'     => $id,
                'type'   => $element['type'] ?? 'text',
                'label'  => $element['label'] ?? '',
                'value'  => $value,
                'hidden' => !$visible,
            ];
        }

        return ['snapshot' => $snapshot, 'errors' => $errors];
    }

    /**
     * Validate and normalise one `gps` answer: {lat, lng, accuracy, captured_at}.
     * Accepts the decoded object or its JSON string. An empty value comes back
     * as null with no error, so the mandatory check stays with the caller.
     *
     * captured_at may be ISO-8601 or an epoch timestamp (seconds or, as
     * expo-location reports it, milliseconds); missing means "now".
     *
     * @return array{value: ?array, error: ?string}
     */
    public function normalizeGps(array $element, $value): array
    {
        if (is_string($value)) {
            $value = json_decode($value, true) ?? $value;
        }

        if ($this->conditions->isEmptyValue($value)) {
            return ['value' => null, 'error' => null];
        }

        $invalid = ['value' => null, 'error' => 'Tap to stamp your current location.'];

        if (!is_array($value)) {
            return $invalid;
        }

        $lat      = $value['lat'] ?? null;
        $lng      = $value['lng'] ?? null;
        $accuracy = $value['accuracy'] ?? null;

        $coordsOk   = is_numeric($lat) && is_numeric($lng)
            && is_finite((float) $lat) && is_finite((float) $lng)
            && $lat >= -90 && $lat <= 90 && $lng >= -180 && $lng <= 180;
        $accuracyOk = $accuracy === null
            || (is_numeric($accuracy) && is_finite((float) $accuracy) && $accuracy >= 0);

        if (!$coordsOk || !$accuracyOk) {
            return $invalid;
        }

        $captured = $value['captured_at'] ?? null;

        try {
            if ($captured === null || $captured === '') {
                $capturedAt = Carbon::now();
            } elseif (is_numeric($captured)) {
                $capturedAt = $captured > 1e11
                    ? Carbon::createFromTimestampMs((float) $captured)
                    : Carbon::createFromTimestamp((float) $captured);
            } elseif (is_string($captured)) {
                $capturedAt = Carbon::parse($captured);
            } else {
                return $invalid;
            }
        } catch (\Throwable $e) {
            return $invalid;
        }

        return [
            'value' => [
                'lat'         => round((float) $lat, 7),
                'lng'         => round((float) $lng, 7),
                'accuracy'    => $accuracy === null ? null : round((float) $accuracy, 1),
                'captured_at' => $capturedAt->toIso8601String(),
            ],
            'error' => null,
        ];
    }

    /**
     * element id => edit|read|hidden for a viewer of a submission.
     *
     * - The submitter sees everything (their visible fields).
     * - Approvers/CC recipients get the union of field_permissions across all
     *   of their stage rows; the most permissive level wins.
     * - form_admin users who are not participants get full read access.
     */
    public function fieldPermissionsForViewer(FormSubmission $submission, User $viewer): array
    {
        $schema   = $this->normalize(optional($submission->form)->form_elements);
        $elements = $schema['elements'] ?? [];

        $full = fn (string $level) => collect($elements)->mapWithKeys(
            fn ($e) => [$e['id'] => $level]
        )->all();

        if ((int) $submission->submitted_by === (int) $viewer->id) {
            return $full('edit');
        }

        $participantRows = $submission->approvals
            ->filter(fn ($row) => in_array((int) $viewer->id, array_map('intval', $row->approver_ids ?? []), true));

        if ($participantRows->isEmpty()) {
            return $viewer->can('form_admin') ? $full('read') : $full('hidden');
        }

        $rank = ['hidden' => 0, 'read' => 1, 'edit' => 2];
        $best = [];

        foreach ($participantRows as $row) {
            $permissions = $row->field_permissions ?: ['default' => 'read'];
            $resolved    = $this->resolveFieldPermissions($schema, $permissions);
            foreach ($resolved as $id => $level) {
                if (!isset($best[$id]) || $rank[$level] > $rank[$best[$id]]) {
                    $best[$id] = $level;
                }
            }
        }

        // form_admin oversight never drops below read.
        if ($viewer->can('form_admin')) {
            foreach ($best as $id => $level) {
                if ($rank[$level] < $rank['read']) {
                    $best[$id] = 'read';
                }
            }
        }

        return $best;
    }

    /**
     * Expand a node's field_permissions ({default, overrides:{el|grp => level}})
     * into a flat element id => level map, group overrides cascading to members.
     */
    public function resolveFieldPermissions(array $schema, array $permissions): array
    {
        $default   = $permissions['default'] ?? 'read';
        $overrides = $permissions['overrides'] ?? [];

        $result = [];
        foreach ($schema['elements'] ?? [] as $element) {
            $level = $default;
            $groupId = $element['group_id'] ?? null;
            if ($groupId !== null && isset($overrides[$groupId])) {
                $level = $overrides[$groupId];
            }
            if (isset($overrides[$element['id']])) {
                $level = $overrides[$element['id']];
            }
            $result[$element['id']] = in_array($level, ['edit', 'read', 'hidden'], true) ? $level : $default;
        }

        return $result;
    }

    /**
     * Whether a user may submit this form according to settings.access.
     *
     * When scope is "selected" a user qualifies if they are individually
     * listed (user_ids) OR their user type is one of the selected types
     * (user_types: Admin / Manager / User).
     */
    public function canSubmit($settings, User $user): bool
    {
        $access = is_array($settings) ? ($settings['access'] ?? []) : [];
        $scope  = $access['submit_scope'] ?? 'everyone';

        if ($scope !== 'selected') {
            return true;
        }

        $userIds = array_map('intval', $access['user_ids'] ?? []);
        if (in_array((int) $user->id, $userIds, true)) {
            return true;
        }

        $types = array_map('intval', $access['user_types'] ?? []);

        return in_array((int) $user->type, $types, true);
    }
}
