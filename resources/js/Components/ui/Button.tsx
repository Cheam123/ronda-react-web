import { Link, type InertiaLinkProps } from '@inertiajs/react';
import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant =
    | 'primary'
    | 'secondary'
    | 'success'
    | 'danger'
    | 'warning'
    | 'info'
    | 'light'
    | 'dark'
    | 'link'
    | 'outline-primary'
    | 'outline-secondary'
    | 'outline-danger'
    | 'outline-success';

interface StyleProps {
    variant?: ButtonVariant;
    size?: 'sm' | 'lg';
    /** The theme's soft drop shadow (custom-button-shadow). */
    shadow?: boolean;
    icon?: string;
}

export function buttonClass({ variant = 'primary', size, shadow = true }: StyleProps, className?: string): string {
    return clsx('btn', `btn-${variant}`, size && `btn-${size}`, shadow && 'custom-button-shadow', className);
}

function Label({ icon, loading, children }: { icon?: string; loading?: boolean; children?: ReactNode }) {
    return (
        <>
            {loading ? (
                <span className="spinner-border spinner-border-sm me-1" aria-hidden="true" />
            ) : (
                icon && <i className={clsx(icon, children ? 'me-1' : undefined)} />
            )}
            {children}
        </>
    );
}

interface ButtonProps extends StyleProps, ButtonHTMLAttributes<HTMLButtonElement> {
    loading?: boolean;
}

export default function Button({
    variant,
    size,
    shadow,
    icon,
    loading = false,
    type = 'button',
    disabled,
    className,
    children,
    ...props
}: ButtonProps) {
    return (
        <button
            type={type}
            className={buttonClass({ variant, size, shadow }, className)}
            disabled={disabled || loading}
            {...props}
        >
            <Label icon={icon} loading={loading}>
                {children}
            </Label>
        </button>
    );
}

type ButtonLinkProps = StyleProps & Omit<InertiaLinkProps, 'size'>;

/** An Inertia link styled as a button. */
export function ButtonLink({ variant, size, shadow, icon, className, children, ...props }: ButtonLinkProps) {
    return (
        <Link className={buttonClass({ variant, size, shadow }, className)} {...props}>
            <Label icon={icon}>{children}</Label>
        </Link>
    );
}
