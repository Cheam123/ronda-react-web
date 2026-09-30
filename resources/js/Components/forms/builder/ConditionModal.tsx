import { useState } from 'react';
import BootstrapModal from 'react-bootstrap/Modal';
import Button from '@/Components/ui/Button';
import type { ConditionSchema, FieldElement, Person } from '@/types/forms';
import ConditionEditor from './ConditionEditor';

interface ConditionModalProps {
    show: boolean;
    initial: ConditionSchema | null;
    sources: FieldElement[];
    people: Person[];
    /** null = cleared. */
    onSave: (schema: ConditionSchema | null) => void;
    onHide: () => void;
}

/** "Display Conditions" for a branch arm; edits apply on Save. Remount per opening. */
export default function ConditionModal({ show, initial, sources, people, onSave, onHide }: ConditionModalProps) {
    const [draft, setDraft] = useState<ConditionSchema | null>(initial);

    return (
        <BootstrapModal show={show} onHide={onHide} size="lg" centered scrollable backdrop="static">
            <BootstrapModal.Header closeButton>
                <BootstrapModal.Title as="h5" className="fw-bold">
                    <i className="mdi mdi-eye-settings-outline me-1 text-primary" />
                    Display Conditions
                </BootstrapModal.Title>
            </BootstrapModal.Header>
            <BootstrapModal.Body>
                <p className="text-muted small mb-3">
                    Conditions inside a block must <strong>all</strong> match (AND). If you add several blocks, matching{' '}
                    <strong>any one</strong> block is enough (OR).
                </p>
                <ConditionEditor
                    initial={initial}
                    onChange={setDraft}
                    sources={sources}
                    people={people}
                    startWithBlock
                />
            </BootstrapModal.Body>
            <BootstrapModal.Footer>
                <Button variant="outline-secondary" shadow={false} onClick={() => onSave(null)}>
                    Clear (always show)
                </Button>
                <Button variant="secondary" shadow={false} onClick={onHide}>
                    Cancel
                </Button>
                <Button shadow={false} onClick={() => onSave(draft)}>
                    Save conditions
                </Button>
            </BootstrapModal.Footer>
        </BootstrapModal>
    );
}
