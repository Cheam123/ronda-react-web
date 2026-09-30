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
            className={clsx('form-control form-control-sm custom-font-small', invalid && 'is-invalid', className)}
            {...props}
        />
    );
});

export default TextArea;
