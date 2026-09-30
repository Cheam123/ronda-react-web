import clsx from 'clsx';
import { useState } from 'react';
import BootstrapModal from 'react-bootstrap/Modal';
import Button from '@/Components/ui/Button';
import type { Person } from '@/types/forms';

type Tab = 'users' | 'types';

interface AccessPickerProps {
    show: boolean;
    users: Person[];
    types: Person[];
    initial: { users: number[]; types: number[] };
    onApply: (selection: { users: number[]; types: number[] }) => void;
    /** Closed without OK. */
    onCancel: () => void;
}

/**
 * "Please select": specific members and user types allowed to submit. It
 * edits a copy; give it a new `key` for each opening so it starts afresh.
 */
export default function AccessPicker({ show, users, types, initial, onApply, onCancel }: AccessPickerProps) {
    const [tab, setTab] = useState<Tab>('users');
    const [query, setQuery] = useState('');
    const [chosen, setChosen] = useState(initial);

    const items = tab === 'users' ? users : types;
    const shown = items.filter((item) => !query.trim() || item.name.toLowerCase().includes(query.trim().toLowerCase()));
    const toggle = (id: number) =>
        setChosen((current) => ({
            ...current,
            [tab]: current[tab].includes(id)
                ? current[tab].filter((existing) => existing !== id)
                : [...current[tab], id],
        }));
    const remove = (from: Tab, id: number) =>
        setChosen((current) => ({ ...current, [from]: current[from].filter((existing) => existing !== id) }));
    const total = chosen.users.length + chosen.types.length;
    const nameOf = (from: Tab, id: number) =>
        (from === 'users' ? users : types).find((item) => item.id === id)?.name ?? `#${id}`;

    return (
        <BootstrapModal show={show} onHide={onCancel} size="lg" centered contentClassName="ap-modal">
            <BootstrapModal.Header closeButton className="border-0 pb-2">
                <BootstrapModal.Title as="h5" className="fw-bold">
                    Please select
                </BootstrapModal.Title>
            </BootstrapModal.Header>
            <BootstrapModal.Body className="pt-0">
                <div className="ap-panes">
                    <div className="ap-left">
                        <div className="ap-tabs">
                            {(['users', 'types'] as const).map((name) => (
                                <button
                                    key={name}
                                    type="button"
                                    className={clsx('ap-tab', tab === name && 'active')}
                                    onClick={() => {
                                        setTab(name);
                                        setQuery('');
                                    }}
                                >
                                    {name === 'users' ? 'Specific Users' : 'User Types'}
                                </button>
                            ))}
                        </div>
                        <div className="ap-search">
                            <i className="mdi mdi-magnify text-muted" />
                            <input
                                type="text"
                                aria-label="Search"
                                placeholder={
                                    tab === 'users' ? 'Search for the name of a member' : 'Search for a user type'
                                }
                                autoComplete="off"
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                            />
                        </div>
                        <div className="ap-list">
                            {shown.map((item) => (
                                <label key={item.id} className="ap-row">
                                    <input
                                        type="checkbox"
                                        className="form-check-input"
                                        checked={chosen[tab].includes(item.id)}
                                        onChange={() => toggle(item.id)}
                                    />
                                    <span className="ap-row-name">{item.name}</span>
                                </label>
                            ))}
                            {shown.length === 0 && (
                                <div className="ap-list-empty">
                                    No matching {tab === 'users' ? 'members' : 'user types'}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="ap-right">
                        <div className="ap-right-head">
                            <span>Selected: {total > 0 && total}</span>
                            <button
                                type="button"
                                className="btn btn-link btn-sm p-0"
                                onClick={() => setChosen({ users: [], types: [] })}
                            >
                                Clear
                            </button>
                        </div>
                        <div className="ap-selected flex-grow-1">
                            {total === 0 ? (
                                <div className="ap-empty">
                                    <i className="mdi mdi-inbox-outline" />
                                    <div>No Data</div>
                                </div>
                            ) : (
                                (['users', 'types'] as const).flatMap((from) =>
                                    chosen[from].map((id) => (
                                        <div key={`${from}-${id}`} className="ap-selected-row">
                                            <span className="ap-selected-name">{nameOf(from, id)}</span>
                                            <span className="d-flex align-items-center gap-2">
                                                <span
                                                    className={`ap-selected-tag ap-selected-tag--${from === 'users' ? 'user' : 'type'}`}
                                                >
                                                    {from === 'users' ? 'User' : 'Type'}
                                                </span>
                                                <button
                                                    type="button"
                                                    className="ap-selected-remove"
                                                    aria-label={`Remove ${nameOf(from, id)}`}
                                                    onClick={() => remove(from, id)}
                                                >
                                                    <i className="mdi mdi-close" />
                                                </button>
                                            </span>
                                        </div>
                                    )),
                                )
                            )}
                        </div>
                    </div>
                </div>
            </BootstrapModal.Body>
            <BootstrapModal.Footer className="border-0 pt-2">
                <Button variant="light" className="px-4" shadow={false} onClick={onCancel}>
                    Cancel
                </Button>
                <Button className="px-4" shadow={false} onClick={() => onApply(chosen)}>
                    OK
                </Button>
            </BootstrapModal.Footer>
        </BootstrapModal>
    );
}
