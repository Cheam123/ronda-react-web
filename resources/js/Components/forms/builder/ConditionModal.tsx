import { useState } from 'react';
import Dialog from '@/Components/surface/Dialog';
import type { ConditionSchema, FieldElement, Person } from '@/types/forms';
import ConditionEditor from './ConditionEditor';

interface ConditionModalProps {
    show: boolean;
    /** The path being edited, for the title. */
    pathName: string;
    initial: ConditionSchema | null;
    sources: FieldElement[];
    people: Person[];
    /** null = cleared. */
    onSave: (schema: ConditionSchema | null) => void;
    onHide: () => void;
}

/** When a branch takes this path; edits apply on Save. Remount per opening. */
export default function ConditionModal({
    show,
    pathName,
    initial,
    sources,
    people,
    onSave,
    onHide,
}: ConditionModalProps) {
    const [draft, setDraft] = useState<ConditionSchema | null>(initial);

    return (
        <Dialog
            show={show}
            onHide={onHide}
            wide
            icon="mdi-source-branch"
            title={`When to take ${pathName || 'this path'}`}
            text="Everything in a set must match. If there are several sets, any one matching is enough. Paths are checked from left to right, and the first match wins."
            footer={
                <>
                    <button
                        type="button"
                        className="rd-btn rd-btn--quiet rd-btn--lg me-auto"
                        onClick={() => onSave(null)}
                    >
                        Remove the conditions
                    </button>
                    <button type="button" className="rd-btn rd-btn--lg" onClick={onHide}>
                        Cancel
                    </button>
                    <button type="button" className="rd-btn rd-btn--primary rd-btn--lg" onClick={() => onSave(draft)}>
                        Save
                    </button>
                </>
            }
        >
            <ConditionEditor initial={initial} onChange={setDraft} sources={sources} people={people} startWithBlock />
        </Dialog>
    );
}
