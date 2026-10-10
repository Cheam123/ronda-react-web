import clsx from 'clsx';

interface LogoProps {
    height: number;
    alt: string;
    className?: string;
}

/**
 * The Ronda logo. Both versions are in the markup and the theme shows one
 * (resources/scss/ronda/_dark.scss); the hidden one is out of the accessibility tree.
 */
export default function Logo({ height, alt, className }: LogoProps) {
    return (
        <>
            <img
                src="/assets/brand/ronda-logo.svg"
                alt={alt}
                height={height}
                className={clsx('rd-logo--light', className)}
            />
            <img
                src="/assets/brand/ronda-logo-white.svg"
                alt={alt}
                height={height}
                className={clsx('rd-logo--dark', className)}
            />
        </>
    );
}
