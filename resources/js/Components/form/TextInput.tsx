import clsx from 'clsx';
import { forwardRef, type InputHTMLAttributes } from 'react';
import { useField } from './Field';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
    invalid?: boolean;
    /** The 44px form size instead of the 40px toolbar size. */
    large?: boolean;
}

/** A text input; inside a Field it is described by the Field's hint or error. */
const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
    { invalid = false, large = false, className, autoComplete = 'off', ...props },
    ref,
) {
    const field = useField();
    const bad = invalid || field.invalid;

    return (
        <input
            ref={ref}
            autoComplete={autoComplete}
            aria-invalid={bad || undefined}
            aria-describedby={field.describedBy}
            className={clsx('rd-input', !large && 'rd-input--md', bad && 'is-invalid', className)}
            {...props}
        />
    );
});

export default TextInput;
