import clsx from 'clsx';
import { useTheme, type ThemePreference } from '@/lib/theme';
import Segmented, { type SegmentedOption } from './Segmented';

const OPTIONS: SegmentedOption<ThemePreference>[] = [
    {
        value: 'light',
        label: (
            <>
                <i className="mdi mdi-white-balance-sunny" aria-hidden="true" />
                Light
            </>
        ),
    },
    {
        value: 'dark',
        label: (
            <>
                <i className="mdi mdi-weather-night" aria-hidden="true" />
                Dark
            </>
        ),
    },
    {
        value: 'system',
        label: (
            <>
                <i className="mdi mdi-monitor" aria-hidden="true" />
                System
            </>
        ),
    },
];

/** Light, dark, or whatever the device is set to. */
export default function ThemeSwitch({ className }: { className?: string }) {
    const { preference, setPreference } = useTheme();

    return (
        <Segmented
            label="Theme"
            options={OPTIONS}
            value={preference}
            onChange={setPreference}
            className={clsx('rd-seg--fill', className)}
        />
    );
}
