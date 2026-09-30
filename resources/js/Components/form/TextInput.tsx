import clsx from 'clsx';
import { forwardRef, type InputHTMLAttributes } from 'react';

interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
    invalid?: boolean;
    /** Full-size control instead of the compact default. */
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
            className={clsx(
                'form-control custom-font-small',
                !large && 'form-control-sm',
                invalid && 'is-invalid',
                className,
            )}
            {...props}
        />
    );
});

export default TextInput;
