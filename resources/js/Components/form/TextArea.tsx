import clsx from 'clsx';
import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { useField } from './Field';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    invalid?: boolean;
}

/** A multi-line input; inside a Field it is described by the Field's hint or error. */
const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
    { invalid = false, className, rows = 3, ...props },
    ref,
) {
    const field = useField();
    const bad = invalid || field.invalid;

    return (
        <textarea
            ref={ref}
            rows={rows}
            aria-invalid={bad || undefined}
            aria-describedby={field.describedBy}
            className={clsx('rd-input', bad && 'is-invalid', className)}
            {...props}
        />
    );
});

export default TextArea;
