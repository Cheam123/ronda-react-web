import clsx from 'clsx';
import { useEffect, useState } from 'react';
import { phoneFromInput, phoneInputText } from '@/lib/phone';

interface PhoneInputProps {
    id: string;
    /** As stored: "60" and the digits ("60123456789"), or '' */
    value: string;
    onChange: (value: string) => void;
    invalid?: boolean;
    required?: boolean;
    readOnly?: boolean;
}

/**
 * A Malaysian phone number after a fixed +60. People type it any way they
 * like ("012 345 6789", "+6012-3456789"); it is stored as digits with the
 * country code and tidied into "12-345 6789" when they leave the field.
 */
export default function PhoneInput({ id, value, onChange, invalid = false, required, readOnly }: PhoneInputProps) {
    const [text, setText] = useState(() => phoneInputText(value));
    const [editing, setEditing] = useState(false);

    // Follow the value when it changes from outside (a reset) but not while typing.
    useEffect(() => {
        if (!editing) {
            setText(phoneInputText(value));
        }
    }, [value, editing]);

    return (
        <div className={clsx('rd-affix rd-affix--full', invalid && 'is-invalid')}>
            <span className="rd-affix__start" aria-hidden="true">
                +60
            </span>
            <input
                id={id}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                aria-invalid={invalid || undefined}
                aria-describedby={invalid ? `${id}-error` : undefined}
                required={required}
                readOnly={readOnly}
                maxLength={16}
                value={text}
                onFocus={() => setEditing(true)}
                onChange={(event) => {
                    setText(event.target.value);
                    onChange(phoneFromInput(event.target.value));
                }}
                onBlur={() => {
                    setEditing(false);
                    setText(phoneInputText(value));
                }}
            />
        </div>
    );
}
