import type { ReactNode } from 'react';

interface SwitchProps {
    id: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: ReactNode;
    /** A line under the label saying what "on" means. */
    description?: ReactNode;
    disabled?: boolean;
}

/** An on / off switch (a checkbox drawn as a toggle) with its label. */
export default function Switch({ id, checked, onChange, label, description, disabled }: SwitchProps) {
    return (
        <label className="rd-toggle" htmlFor={id}>
            <input
                id={id}
                type="checkbox"
                role="switch"
                className="rd-toggle__input"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(event.target.checked)}
            />
            <span className="rd-toggle__text">
                <span className="rd-toggle__label">{label}</span>
                {description && <span className="rd-toggle__description">{description}</span>}
            </span>
        </label>
    );
}
