import { router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import SearchSelect from '@/Components/form/SearchSelect';
import Button from '@/Components/ui/Button';
import Modal from '@/Components/ui/Modal';
import type { PageProps } from '@/types';
import type { Person } from '@/types/forms';

/**
 * "Choose the next handler". When submitting, approving or completing a
 * section starts a Handler step whose handler is decided at that moment, the
 * server saves nothing and flashes the request back (flash.needsAssignee).
 * This asks who handles it and posts the same request again with
 * next_assignee_ids[].
 */
export default function AssigneePicker({ people }: { people: Person[] }) {
    const pending = usePage<PageProps>().props.flash.needsAssignee;
    const [open, setOpen] = useState(false);
    const [picked, setPicked] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        setOpen(pending !== null);
        setPicked('');
    }, [pending]);

    if (!pending) return null;

    const replay = () => {
        router.post(
            pending.action,
            { ...pending.fields, next_assignee_ids: [picked] },
            { onStart: () => setSending(true), onFinish: () => setSending(false) },
        );
    };

    return (
        <Modal
            show={open}
            onHide={() => setOpen(false)}
            title="Choose the next handler"
            footer={
                <>
                    <Button variant="light" size="sm" onClick={() => setOpen(false)}>
                        Cancel
                    </Button>
                    <Button size="sm" disabled={!picked} loading={sending} onClick={replay}>
                        Assign &amp; Continue
                    </Button>
                </>
            }
        >
            <div className="assignee-hint mb-2">
                This form is not finished yet — pick who should handle{' '}
                <strong>{pending.name || 'the next step'}</strong> next.
            </div>
            <SearchSelect
                options={people.map((person) => ({ value: person.id, label: person.name }))}
                placeholder="Search and select a person..."
                value={picked}
                onChange={setPicked}
            />
        </Modal>
    );
}
