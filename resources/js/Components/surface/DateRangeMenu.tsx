import { useState } from 'react';
import Dropdown from 'react-bootstrap/Dropdown';

interface DateRangeMenuProps {
    /** What the dates filter ("Created"). */
    label: string;
    /** Y-m-d, or '' for open-ended. */
    start: string;
    end: string;
    onApply: (start: string, end: string) => void;
    /** Offer "Any time". Off where the server always applies a range (IFE reports). */
    clearable?: boolean;
}

const SHORT = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' });
const LONG = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** "1 Sep – 30 Sep 2026", "from 1 Sep 2026", "any time". */
export function describeRange(start: string, end: string): string {
    const from = start ? new Date(`${start}T00:00:00`) : null;
    const to = end ? new Date(`${end}T00:00:00`) : null;

    if (from && to) {
        return `${SHORT.format(from)} – ${LONG.format(to)}`;
    }
    if (from) {
        return `from ${LONG.format(from)}`;
    }
    if (to) {
        return `until ${LONG.format(to)}`;
    }

    return 'any time';
}

/** A toolbar button that opens a from / to date pair. */
export default function DateRangeMenu({ label, start, end, onApply, clearable = true }: DateRangeMenuProps) {
    const [open, setOpen] = useState(false);
    const [draft, setDraft] = useState({ start, end });

    const toggle = (next: boolean) => {
        if (next) {
            setDraft({ start, end });
        }
        setOpen(next);
    };

    const apply = (from: string, to: string) => {
        setOpen(false);
        onApply(from, to);
    };

    return (
        <Dropdown show={open} onToggle={toggle} autoClose="outside" align="end">
            <Dropdown.Toggle as="button" type="button" bsPrefix="rd-btn">
                <i className="mdi mdi-calendar-blank-outline" aria-hidden="true" />
                {label}: {describeRange(start, end)}
            </Dropdown.Toggle>
            <Dropdown.Menu className="rd-pop">
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        apply(draft.start, draft.end);
                    }}
                >
                    <div className="rd-pop__fields">
                        <label className="rd-field">
                            <span className="rd-field__label">From</span>
                            <input
                                type="date"
                                className="rd-input rd-input--md"
                                value={draft.start}
                                required={!clearable}
                                max={draft.end || undefined}
                                onChange={(event) => setDraft({ ...draft, start: event.target.value })}
                            />
                        </label>
                        <label className="rd-field">
                            <span className="rd-field__label">To</span>
                            <input
                                type="date"
                                className="rd-input rd-input--md"
                                value={draft.end}
                                min={draft.start || undefined}
                                onChange={(event) => setDraft({ ...draft, end: event.target.value })}
                            />
                        </label>
                    </div>
                    <div className="rd-pop__foot">
                        {clearable && (
                            <button type="button" className="rd-btn rd-btn--quiet" onClick={() => apply('', '')}>
                                Any time
                            </button>
                        )}
                        <button type="submit" className="rd-btn rd-btn--primary">
                            Apply
                        </button>
                    </div>
                </form>
            </Dropdown.Menu>
        </Dropdown>
    );
}
