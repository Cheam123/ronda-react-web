import type { ResponseSectionData } from '@/Components/forms/ResponseField';
import type { PreviousAnswer } from '@/Components/forms/FormRenderer';
import type { Answers, FieldElement, RenderItem } from '@/types/forms';

/** One Handler or Approval step (ApprovalStageResource). */
export interface ApprovalStage {
    id: number;
    name: string;
    is_fill: boolean;
    approval_mode: 'any' | 'all' | null;
    iteration: number;
    status: string;
    acted_by: string | null;
    acted_at: string | null;
    remark: string | null;
}

export interface RecordTimeline {
    submitted_on: string;
    stages: ApprovalStage[];
    /** The step in progress; null once the case is no longer pending. */
    current_id: number | null;
    /** A rejection recorded on the case itself rather than on a step (older cases). */
    legacy_reject: { by: string | null; remark: string | null } | null;
    /** A runtime branch or loop may still add steps. */
    process_open: boolean;
}

export interface PreviousRound {
    iteration: number;
    closed_at: string | null;
    actors: string;
    field_count: number;
    sections: ResponseSectionData[];
}

/** The signed-in Handler's part of the form, when it is their turn. */
export interface FillStage {
    name: string;
    elements: FieldElement[];
    tree: RenderItem[];
    answers: Answers;
    previous: Record<string, PreviousAnswer>;
}
