import { router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import Field from '@/Components/form/Field';
import SearchSelect from '@/Components/form/SearchSelect';
import Dialog from '@/Components/surface/Dialog';
import type { PageProps } from '@/types';
import type { Person } from '@/types/forms';

/**
 * "Who fills in the next step?". When submitting, approving or filling in a
 * part starts a fill-in step whose person is decided at that moment, the
 * server saves nothing and flashes the request back (flash.needsAssignee).
 * This asks who it goes to and posts the same request again with
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
        <Dialog
            show={open}
            onHide={() => setOpen(false)}
            title="Who fills in the next step?"
            text={
                <>
                    The form isn&rsquo;t finished yet. Pick who does <strong>{pending.name || 'the next step'}</strong>.
                </>
            }
            icon="mdi-account-arrow-right-outline"
            tone="neutral"
            footer={
                <>
                    <button type="button" className="rd-btn rd-btn--lg" onClick={() => setOpen(false)}>
                        Cancel
                    </button>
                    <button
                        type="button"
                        className="rd-btn rd-btn--primary rd-btn--lg"
                        disabled={!picked || sending}
                        onClick={replay}
                    >
                        {sending && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
                        Send it on
                    </button>
                </>
            }
        >
            <Field label="Person" htmlFor="next-assignee">
                <SearchSelect
                    id="next-assignee"
                    options={people.map((person) => ({ value: person.id, label: person.name }))}
                    placeholder="Search for a person"
                    value={picked}
                    onChange={setPicked}
                />
            </Field>
        </Dialog>
    );
}
