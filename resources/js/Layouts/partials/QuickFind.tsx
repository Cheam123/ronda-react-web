import { router } from '@inertiajs/react';
import clsx from 'clsx';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import Modal from 'react-bootstrap/Modal';
import { getJson } from '@/lib/http';

interface Hit {
    id: number;
    title: string;
    sub: string;
    href: string;
}

interface Results {
    outlets: Hit[];
    tasks: Hit[];
}

const EMPTY: Results = { outlets: [], tasks: [] };
const GROUPS = [
    { key: 'outlets', label: 'Outlets', icon: 'mdi-storefront-outline' },
    { key: 'tasks', label: 'Tasks', icon: 'mdi-format-list-checks' },
] as const;

/** Pressing "/" outside a text box opens quick find, as on most sites with a search. */
function typingIn(target: EventTarget | null): boolean {
    return (
        target instanceof HTMLElement && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
    );
}

/** The top bar's "Find": any outlet or task by name, shop, customer ID, mobile, title or reference. */
export default function QuickFind() {
    const [open, setOpen] = useState(false);

    useEffect(() => {
        const onKey = (event: KeyboardEvent) => {
            if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || typingIn(event.target)) return;
            event.preventDefault();
            setOpen(true);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, []);

    // A visit closes it (picking a result, or Back).
    useEffect(() => router.on('navigate', () => setOpen(false)), []);

    return (
        <>
            <button
                type="button"
                className="rd-find"
                aria-haspopup="dialog"
                aria-keyshortcuts="/"
                aria-label="Find an outlet or task"
                onClick={() => setOpen(true)}
            >
                <i className="mdi mdi-magnify" aria-hidden="true" />
                <span className="rd-find__label" aria-hidden="true">
                    Find
                </span>
                <kbd className="rd-find__key" aria-hidden="true">
                    /
                </kbd>
            </button>
            {open && <QuickFindDialog onClose={() => setOpen(false)} />}
        </>
    );
}

function QuickFindDialog({ onClose }: { onClose: () => void }) {
    const [term, setTerm] = useState('');
    const [results, setResults] = useState<Results>(EMPTY);
    const [state, setState] = useState<'idle' | 'loading' | 'done' | 'failed'>('idle');
    const [active, setActive] = useState(0);
    const latest = useRef(0);
    const inputRef = useRef<HTMLInputElement>(null);

    const hits = useMemo(() => [...results.outlets, ...results.tasks], [results]);
    const query = term.trim();

    // Look up a moment after typing stops; an answer to an older question is dropped.
    useEffect(() => {
        if (query.length < 2) {
            setResults(EMPTY);
            setState('idle');
            return;
        }
        const asked = ++latest.current;
        setState('loading');
        const timer = window.setTimeout(() => {
            getJson<Results>(route('search'), { q: query })
                .then((found) => {
                    if (asked !== latest.current) return;
                    setResults(found);
                    setActive(0);
                    setState('done');
                })
                .catch(() => asked === latest.current && setState('failed'));
        }, 200);
        return () => window.clearTimeout(timer);
    }, [query]);

    const go = (hit: Hit | undefined) => {
        if (!hit) return;
        onClose();
        router.visit(hit.href);
    };

    const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'ArrowDown' && hits.length) {
            event.preventDefault();
            setActive((index) => (index + 1) % hits.length);
        } else if (event.key === 'ArrowUp' && hits.length) {
            event.preventDefault();
            setActive((index) => (index - 1 + hits.length) % hits.length);
        } else if (event.key === 'Enter') {
            event.preventDefault();
            go(hits[active]);
        }
    };

    const optionId = (index: number) => `rd-find-option-${index}`;
    let index = -1;

    return (
        <Modal
            show
            onHide={onClose}
            onEntered={() => inputRef.current?.focus()}
            dialogClassName="rd-dialog rd-find-dialog"
            aria-label="Find an outlet or task"
        >
            <div className="rd-find-dialog__search">
                <i className="mdi mdi-magnify" aria-hidden="true" />
                <label htmlFor="rd-find-input" className="visually-hidden">
                    Find an outlet or task
                </label>
                <input
                    ref={inputRef}
                    id="rd-find-input"
                    type="search"
                    role="combobox"
                    autoComplete="off"
                    aria-expanded={hits.length > 0}
                    aria-controls="rd-find-results"
                    aria-autocomplete="list"
                    aria-activedescendant={hits.length ? optionId(active) : undefined}
                    placeholder="Outlet, customer ID, mobile, task or reference"
                    value={term}
                    onChange={(event) => setTerm(event.target.value)}
                    onKeyDown={onKeyDown}
                />
                <button type="button" className="rd-btn rd-btn--icon" aria-label="Close" onClick={onClose}>
                    <i className="mdi mdi-close" aria-hidden="true" />
                </button>
            </div>

            <div className="rd-find-dialog__body">
                {/* The results speak for themselves on screen; the count is for screen readers only. */}
                <p
                    className={clsx('rd-find-dialog__status', state === 'done' && hits.length > 0 && 'visually-hidden')}
                    role="status"
                >
                    {state === 'idle' && 'Type two letters or more.'}
                    {state === 'loading' && 'Searching…'}
                    {state === 'failed' && 'Search didn’t work just now. Try again.'}
                    {state === 'done' && (hits.length === 0 ? `Nothing matches “${query}”.` : `${hits.length} found`)}
                </p>

                <div id="rd-find-results" role="listbox" aria-label="Results">
                    {GROUPS.map((group) =>
                        results[group.key].length === 0 ? null : (
                            <div key={group.key} role="group" aria-labelledby={`rd-find-${group.key}`}>
                                <div id={`rd-find-${group.key}`} className="rd-find-dialog__group" role="presentation">
                                    {group.label}
                                </div>
                                {results[group.key].map((hit) => {
                                    index += 1;
                                    const position = index;

                                    return (
                                        <div
                                            key={`${group.key}-${hit.id}`}
                                            id={optionId(position)}
                                            role="option"
                                            aria-selected={position === active}
                                            className={clsx('rd-find-dialog__hit', position === active && 'is-active')}
                                            onMouseEnter={() => setActive(position)}
                                            onClick={() => go(hit)}
                                        >
                                            <i className={`mdi ${group.icon}`} aria-hidden="true" />
                                            <span className="rd-find-dialog__text">
                                                <span className="rd-find-dialog__title">{hit.title}</span>
                                                {hit.sub && <span className="rd-find-dialog__sub">{hit.sub}</span>}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        ),
                    )}
                </div>
            </div>

            <p className="rd-find-dialog__foot" aria-hidden="true">
                <kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open · <kbd>Esc</kbd> to close
            </p>
        </Modal>
    );
}
