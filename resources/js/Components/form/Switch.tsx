import type { ReactNode } from 'react';

interface SwitchProps {
    id: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: ReactNode;
    disabled?: boolean;
}

export default function Switch({ id, checked, onChange, label, disabled }: SwitchProps) {
    return (
        <div className="form-check form-switch">
            <input
                id={id}
                type="checkbox"
                className="form-check-input"
                checked={checked}
                disabled={disabled}
                onChange={(event) => onChange(event.target.checked)}
            />
            <label className="form-check-label" htmlFor={id}>
                {label}
            </label>
        </div>
    );
}
