import clsx from 'clsx';
import { useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface TabItem<K extends string> {
    key: K;
    label: ReactNode;
    count?: number;
}

interface TabListProps<K extends string> {
    /** Names the set for screen readers ("Activity"). */
    label: string;
    tabs: TabItem<K>[];
    value: K;
    onChange: (key: K) => void;
    /** Ties each tab to its panel: tabs get `${id}-tab-${key}`, the panel `${id}-panel`. */
    id: string;
    className?: string;
}

/**
 * Tabs that switch a panel in place (an outlet's activity, the task drawer):
 * a real tablist, with the arrow keys, Home and End moving between tabs. Tabs
 * that filter a list and reload the page stay buttons with aria-pressed.
 */
export default function TabList<K extends string>({ label, tabs, value, onChange, id, className }: TabListProps<K>) {
    const buttons = useRef<(HTMLButtonElement | null)[]>([]);

    const move = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
        const last = tabs.length - 1;
        const next =
            event.key === 'ArrowRight'
                ? (index + 1) % tabs.length
                : event.key === 'ArrowLeft'
                  ? (index - 1 + tabs.length) % tabs.length
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? last
                      : null;
        if (next === null) return;
        event.preventDefault();
        buttons.current[next]?.focus();
        onChange(tabs[next].key);
    };

    return (
        <div role="tablist" aria-label={label} className={clsx('rd-tabs', className)}>
            {tabs.map((tab, index) => {
                const selected = tab.key === value;

                return (
                    <button
                        key={tab.key}
                        ref={(element) => {
                            buttons.current[index] = element;
                        }}
                        type="button"
                        role="tab"
                        id={`${id}-tab-${tab.key}`}
                        aria-selected={selected}
                        aria-controls={`${id}-panel`}
                        tabIndex={selected ? 0 : -1}
                        className={clsx('rd-tabs__tab', selected && 'is-active')}
                        onClick={() => onChange(tab.key)}
                        onKeyDown={(event) => move(event, index)}
                    >
                        {tab.label}
                        {tab.count !== undefined && <span className="rd-count">{tab.count}</span>}
                    </button>
                );
            })}
        </div>
    );
}
