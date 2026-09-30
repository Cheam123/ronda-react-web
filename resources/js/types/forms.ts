/**
 * The form module's JSON shapes: the v2 schema (form_elements), the process
 * definition, settings, and answers. See FormSchemaService and
 * FormProcessService for the server's side of each.
 */

export type FieldType =
    | 'text'
    | 'textarea'
    | 'email'
    | 'tel'
    | 'number'
    | 'date'
    | 'time'
    | 'select'
    | 'multi-choice'
    | 'multi-select'
    | 'checkbox'
    | 'file'
    | 'user'
    | 'gps';

export type ConditionOperator =
    'equals' | 'not_equals' | 'includes' | 'not_includes' | 'gt' | 'lt' | 'is_empty' | 'is_not_empty';

export interface Condition {
    field: string;
    operator: ConditionOperator;
    value: string | null;
}

/** Conditions in a group are AND'd; groups are OR'd. Null means "always". */
export interface ConditionSchema {
    logic?: 'or';
    groups: { logic?: 'and'; conditions: Condition[] }[];
}

/** A categorised option list (multi-select). */
export interface OptionCategory {
    group: string;
    options: string[];
}

export interface FieldElement {
    id: string;
    kind: 'field';
    type: FieldType;
    label: string;
    placeholder?: string | null;
    mandatory: boolean;
    /** Options: strings, or categories for multi-select. */
    values: (string | OptionCategory)[];
    min?: number | string | null;
    max?: number | string | null;
    /** Date fields: earliest allowed = today + N days. */
    min_days?: number | null;
    group_id: string | null;
    order?: number;
    visible_when: ConditionSchema | null;
    user_source?: 'all' | 'selected' | null;
    user_ids?: number[];
    capture_mode?: 'auto' | 'manual' | null;
    text?: string;
}

export interface DescriptionElement {
    id: string;
    kind: 'description';
    type?: string;
    text: string;
    label?: string;
    group_id: string | null;
    order?: number;
    visible_when: ConditionSchema | null;
}

export type FormElement = FieldElement | DescriptionElement;

export interface FormSection {
    id: string;
    label: string;
    order?: number;
    visible_when: ConditionSchema | null;
}

export interface FormSchema {
    schema_version: 2;
    groups: FormSection[];
    elements: FormElement[];
}

export type RenderItem =
    { kind: 'group'; group: FormSection; elements: FormElement[] } | { kind: 'element'; element: FormElement };

/* ----- process definition ----- */

export type PermissionLevel = 'edit' | 'read' | 'hidden';

export interface FieldPermissions {
    default: PermissionLevel;
    /** element or section id -> level */
    overrides: Record<string, PermissionLevel>;
}

interface BaseNode {
    id: string;
    name: string;
    field_permissions: FieldPermissions;
}

export interface FillNode extends BaseNode {
    type: 'fill';
    assignee_ids: number[];
    assignee_mode?: 'fixed' | 'runtime' | 'field';
    assignee_field?: string | null;
}

export interface ApprovalNode extends BaseNode {
    type: 'approval';
    approver_ids: number[];
    approval_mode: 'any' | 'all';
}

export interface CcNode extends BaseNode {
    type: 'cc';
    user_ids: number[];
}

export interface BranchArm {
    id: string;
    name: string;
    when: ConditionSchema | null;
    nodes: StepNode[];
    /** Repeat this arm's own steps while its condition matches. */
    loop?: boolean;
    /** Or rewind to an earlier step in the same flow. */
    loop_to?: string;
}

export interface BranchNode {
    id: string;
    type: 'branch';
    name?: string;
    branches: BranchArm[];
}

export type StepNode = FillNode | ApprovalNode | CcNode;
export type ProcessNode = StepNode | BranchNode;

export interface ProcessDefinition {
    process_version: number;
    nodes: ProcessNode[];
}

export interface FormSettings {
    access: {
        submit_scope: 'everyone' | 'selected';
        user_ids: number[];
        user_types: number[];
    };
}

/* ----- people and answers ----- */

export interface Person {
    id: number;
    name: string;
}

export interface GpsAnswer {
    lat: number;
    lng: number;
    accuracy: number | null;
    captured_at: string;
}

/** A stored file answer; older answers use url/name, newer file_path/file_name. */
export type FileAnswer = string | { file_path?: string; url?: string; name?: string; file_name?: string };

export type AnswerValue = string | number | string[] | GpsAnswer | FileAnswer[] | null;

/** element id -> answer */
export type Answers = Record<string, AnswerValue>;

/** A form's status on the records screens. */
export type RecordStatus = 'pending' | 'approved' | 'rejected' | 'cancelled' | 'closed';

/** A form on the list and "start a form" screens (FormSummaryResource). */
export interface FormSummary {
    id: number;
    name: string;
    description: string | null;
    is_enabled: boolean;
    created_at: string | null;
    field_count: number;
}

/** A form group, as the builder's picker lists it. */
export interface FormGroupOption {
    id: number;
    name: string;
}

/** Another case, linked from a record or offered as a parent (CaseLinkResource). */
export interface CaseLink {
    id: number;
    reference: string;
    title: string;
    status: string;
    open: boolean;
    created_at: string | null;
    submitted_by?: string;
}
