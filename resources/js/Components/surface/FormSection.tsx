import { Link } from '@inertiajs/react';
import clsx from 'clsx';
import type { ReactNode } from 'react';

interface FormSectionProps {
    title: string;
    /** A line under the title saying what the section is for. */
    intro?: ReactNode;
    /** Title above the fields instead of beside them, for a table that needs the width. */
    wide?: boolean;
    className?: string;
    children: ReactNode;
}

/**
 * One block of a surface form: its title and intro on the left, the fields on
 * the right (stacked on narrow screens). Sits inside a `.rd-form` panel.
 */
export function FormSection({ title, intro, wide = false, className, children }: FormSectionProps) {
    return (
        <section className={clsx('rd-form__section', wide && 'rd-form__section--wide', className)}>
            <div className="rd-form__intro">
                <h2>{title}</h2>
                {intro && <p>{intro}</p>}
            </div>
            <div className="rd-form__fields">{children}</div>
        </section>
    );
}

interface FormRowProps {
    /** Equal columns, or a grid-template-columns value ("minmax(0, 1fr) 190px"). */
    columns?: 1 | 2 | 3 | 4 | string;
    className?: string;
    children: ReactNode;
}

/** Fields side by side; one column on phones. */
export function FormRow({ columns = 2, className, children }: FormRowProps) {
    const template = typeof columns === 'number' ? `repeat(${columns}, minmax(0, 1fr))` : columns;

    return (
        <div className={clsx('rd-form__row', className)} style={{ ['--rd-form-columns' as string]: template }}>
            {children}
        </div>
    );
}

interface FormFootProps {
    /** Where Cancel goes. */
    cancelHref: string;
    submitLabel: string;
    processing?: boolean;
    /** Buttons before Cancel (a secondary action). */
    children?: ReactNode;
}

/** The bar at the foot of a surface form: Cancel and the submit button. */
export function FormFoot({ cancelHref, submitLabel, processing = false, children }: FormFootProps) {
    return (
        <div className="rd-form__foot">
            {children}
            <Link href={cancelHref} className="rd-btn rd-btn--quiet rd-btn--lg">
                Cancel
            </Link>
            <button type="submit" className="rd-btn rd-btn--primary rd-btn--lg" disabled={processing}>
                {processing && <span className="spinner-border spinner-border-sm" aria-hidden="true" />}
                {submitLabel}
            </button>
        </div>
    );
}
