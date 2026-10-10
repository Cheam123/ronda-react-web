import type { ChartOptions } from 'chart.js';
import type { Theme } from './theme';

/**
 * Chart.js settings shared by the surface pages' bar charts, matching
 * resources/scss/ronda/_surface.scss. Chart.js draws on a canvas, so it
 * cannot read the CSS custom properties; each theme has its own set. The
 * series pair (blue / ochre) was checked for colour-blind separation and 3:1
 * contrast on the panel, in both themes.
 */
export interface ChartColors {
    brand: string;
    /** The bar still being filled (today, this month): lighter on white, dimmer on dark. */
    brandToday: string;
    brandPast: string;
    ochre: string;
    ink: string;
    ink2: string;
    muted: string;
    grid: string;
    axis: string;
    tooltipBg: string;
    tooltipBorder: string;
    font: string;
}

const FONT = "'Instrument Sans', system-ui, sans-serif";

const LIGHT: ChartColors = {
    brand: '#0D729E',
    brandToday: '#9CC3D5',
    brandPast: '#7FB0C6',
    ochre: '#BF7E32',
    ink: '#15171A',
    ink2: '#464A4F',
    muted: '#6B6A64',
    grid: '#EEEDE6',
    axis: '#D6D4CB',
    tooltipBg: '#FFFFFF',
    tooltipBorder: 'rgba(21, 23, 26, 0.15)',
    font: FONT,
};

const DARK: ChartColors = {
    brand: '#47B0DD',
    brandToday: '#2D7EA3',
    brandPast: '#2D7EA3',
    ochre: '#E0A25C',
    ink: '#F2F4F7',
    ink2: '#A9B1BF',
    muted: '#8B95A7',
    grid: '#1F2837',
    axis: '#2F394A',
    tooltipBg: '#1A2230',
    tooltipBorder: 'rgba(255, 255, 255, 0.14)',
    font: FONT,
};

export const chartColors = (theme: Theme): ChartColors => (theme === 'dark' ? DARK : LIGHT);

/** Bars with rounded tops sitting on the baseline. */
export const BAR_STYLE = {
    borderRadius: 4,
    borderSkipped: 'start' as const,
    maxBarThickness: 28,
};

interface BarOptions {
    colors: ChartColors;
    /** A value in the tooltip: "RM 1,850.00". */
    format?: (value: number) => string;
    /** A value on the y axis: "2K". */
    formatTick?: (value: number) => string;
    /** Tooltip titles, one per bar, when the axis labels are abbreviated. */
    titles?: string[];
    /** Show every x label as given (blank ones included) instead of thinning them. */
    keepLabels?: boolean;
}

/** A bar chart with a recessive grid, no legend (the panel names the series) and a white tooltip. */
export function barOptions({
    colors: CHART,
    format = String,
    formatTick,
    titles,
    keepLabels = false,
}: BarOptions): ChartOptions<'bar'> {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: CHART.tooltipBg,
                titleColor: CHART.ink,
                bodyColor: CHART.ink2,
                borderColor: CHART.tooltipBorder,
                borderWidth: 1,
                padding: 10,
                boxWidth: 10,
                boxHeight: 10,
                titleFont: { family: CHART.font, weight: 600 },
                bodyFont: { family: CHART.font },
                callbacks: {
                    title: (items) => (titles && items.length > 0 ? titles[items[0].dataIndex] : items[0]?.label),
                    label: (context) => ` ${context.dataset.label}: ${format(Number(context.parsed.y))}`,
                },
            },
        },
        scales: {
            x: {
                grid: { display: false },
                border: { display: true, color: CHART.axis },
                ticks: {
                    color: CHART.muted,
                    font: { family: CHART.font, size: 11 },
                    maxRotation: 0,
                    autoSkip: !keepLabels,
                    autoSkipPadding: 12,
                },
            },
            y: {
                beginAtZero: true,
                grid: { color: CHART.grid },
                border: { display: false },
                ticks: {
                    color: CHART.muted,
                    font: { family: CHART.font, size: 11 },
                    precision: 0,
                    maxTicksLimit: 5,
                    callback: (value) => (formatTick ? formatTick(Number(value)) : value),
                },
            },
        },
    };
}
