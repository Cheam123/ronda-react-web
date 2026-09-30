import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip, type ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { TrendDay } from '../types';

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

const SERIES = { created: '#2a78d6', done: '#eb6834' };
const INK_2 = '#52514e';
const MUTED = '#898781';

const barStyle = {
    maxBarThickness: 24,
    borderRadius: 4,
    borderSkipped: 'start' as const,
    categoryPercentage: 0.7,
    barPercentage: 0.85,
};

const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
        legend: {
            position: 'top',
            align: 'start',
            labels: { color: INK_2, boxWidth: 10, boxHeight: 10, font: { size: 11 } },
        },
        tooltip: {
            backgroundColor: '#ffffff',
            titleColor: '#0b0b0b',
            bodyColor: INK_2,
            borderColor: 'rgba(11,11,11,0.15)',
            borderWidth: 1,
            padding: 8,
            boxWidth: 10,
            boxHeight: 10,
        },
    },
    scales: {
        x: {
            grid: { display: false },
            border: { display: true, color: '#c3c2b7' },
            ticks: { color: MUTED, font: { size: 11 } },
        },
        y: {
            beginAtZero: true,
            grid: { color: '#e1e0d9' },
            border: { display: false },
            ticks: { color: MUTED, precision: 0, font: { size: 11 } },
        },
    },
};

function shortDate(date: string): string {
    return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Tasks created vs. done per day, with a table fallback for screen readers. */
export default function TrendChart({ trend }: { trend: TrendDay[] }) {
    const data = {
        labels: trend.map((day) => shortDate(day.date)),
        datasets: [
            { label: 'Created', data: trend.map((day) => day.created), backgroundColor: SERIES.created, ...barStyle },
            { label: 'Done', data: trend.map((day) => day.done), backgroundColor: SERIES.done, ...barStyle },
        ],
    };

    return (
        <>
            <div className="dash-chart">
                <Bar
                    data={data}
                    options={options}
                    aria-label="Tasks created and done per day, last 14 days"
                    role="img"
                />
            </div>
            <details className="mt-2">
                <summary className="dash-sub">Show as table</summary>
                <table className="dash-table mt-1">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th className="num">Created</th>
                            <th className="num">Done</th>
                        </tr>
                    </thead>
                    <tbody>
                        {trend.map((day) => (
                            <tr key={day.date}>
                                <td>{day.label}</td>
                                <td className="num">{day.created}</td>
                                <td className="num">{day.done}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </details>
        </>
    );
}
