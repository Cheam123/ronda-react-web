import clsx from 'clsx';
import { forwardRef, type TextareaHTMLAttributes } from 'react';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
    invalid?: boolean;
}

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
    { invalid = false, className, rows = 3, ...props },
    ref,
) {
    return (
        <textarea
            ref={ref}
            rows={rows}
            aria-invalid={invalid || undefined}
            className={clsx('rd-input', invalid && 'is-invalid', className)}
            {...props}
        />
    );
});

export default TextArea;
