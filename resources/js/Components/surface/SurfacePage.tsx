import clsx from 'clsx';
import type { ReactNode } from 'react';
import { useBodyAttributes } from '@/hooks/useBodyAttributes';

/**
 * The frame of a redesigned page (dashboards, products, leads, users): the
 * grey page ground and the .rd type and spacing (resources/scss/ronda/_surface.scss).
 */
export default function SurfacePage({ className, children }: { className?: string; children: ReactNode }) {
    useBodyAttributes({ 'data-surface': 'grey' });

    return <div className={clsx('rd', className)}>{children}</div>;
}
