import { useState, type FormEvent, type ReactNode } from 'react';
import Collapse from 'react-bootstrap/Collapse';
import Button from './Button';

interface FilterPanelProps {
    onSearch: () => void;
    onReset: () => void;
    /** Right-hand toolbar (e.g. an Add button), always visible. */
    actions?: ReactNode;
    /** Start expanded instead of collapsed. */
    defaultOpen?: boolean;
    children: ReactNode;
}

/** A collapsible "Filter" block with Reset / Search buttons. */
export default function FilterPanel({ onSearch, onReset, actions, defaultOpen = false, children }: FilterPanelProps) {
    const [open, setOpen] = useState(defaultOpen);

    const submit = (event: FormEvent) => {
        event.preventDefault();
        onSearch();
    };

    return (
        <div className="filter-panel">
            <div className="d-flex align-items-center justify-content-between">
                <button
                    type="button"
                    className="btn btn-link p-0 text-reset text-decoration-none"
                    onClick={() => setOpen((current) => !current)}
                    aria-expanded={open}
                >
                    Filter <i className={`fa fa-lg ms-1 ${open ? 'fa-caret-up' : 'fa-caret-down'}`} />
                </button>
                {actions}
            </div>
            <Collapse in={open}>
                <div>
                    <form className="pt-2" onSubmit={submit}>
                        {children}
                        <div className="d-flex gap-1 pt-2">
                            <Button variant="light" size="sm" className="filter-button" onClick={onReset}>
                                Reset
                            </Button>
                            <Button type="submit" size="sm" className="filter-button">
                                Search
                            </Button>
                        </div>
                    </form>
                </div>
            </Collapse>
        </div>
    );
}
