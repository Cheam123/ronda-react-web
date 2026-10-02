import clsx from 'clsx';
import { forwardRef, type InputHTMLAttributes } from 'react';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
    invalid?: boolean;
    /** The 44px form size instead of the 40px toolbar size. */
    large?: boolean;
}

const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
    { invalid = false, large = false, className, autoComplete = 'off', ...props },
    ref,
) {
    return (
        <input
            ref={ref}
            autoComplete={autoComplete}
            aria-invalid={invalid || undefined}
            className={clsx('rd-input', !large && 'rd-input--md', invalid && 'is-invalid', className)}
            {...props}
        />
    );
});

export default TextInput;
