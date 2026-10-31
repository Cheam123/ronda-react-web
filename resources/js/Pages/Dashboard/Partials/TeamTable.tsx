import { Link } from '@inertiajs/react';
import clsx from 'clsx';
import { useMemo, useState } from 'react';
import Initials from '@/Components/surface/Initials';
import { useAuth } from '@/hooks/useAuth';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { formatMoney } from '@/lib/format';
import type { TeamMember } from '../types';
import { dueText } from './due';

type SortKey = 'name' | 'open' | 'overdue' | 'at_risk' | 'done_7d' | 'visits_7d' | 'forms_7d' | 'orders_7d';

interface Sort {
    key: SortKey;
    descending: boolean;
}

/** When their most urgent task is (was) due; people with none sort last. */
function firstDue(person: TeamMember): number {
    const due = person.urgent[0]?.due_at;
    return due ? Date.parse(due) : Infinity;
}

const byName = (a: TeamMember, b: TeamMember) => a.name.localeCompare(b.name);

// Most overdue first, then at risk, then whose task is most overdue. Infinity -
// Infinity is NaN, which is falsy, so ties fall through to the next key.
const byUrgency = (a: TeamMember, b: TeamMember) =>
    b.overdue - a.overdue || b.at_risk - a.at_risk || firstDue(a) - firstDue(b) || b.open - a.open || byName(a, b);

function compare({ key, descending }: Sort) {
    return (a: TeamMember, b: TeamMember) => {
        const primary = key === 'name' ? byName(a, b) : a[key] - b[key];
        return (descending ? -primary : primary) || byUrgency(a, b);
    };
}

interface SortHeadProps {
    column: SortKey;
    label: string;
    sort: Sort;
    onSort: (column: SortKey) => void;
    numeric?: boolean;
}

/** A column heading that sorts the table; aria-sort says which way. */
function SortHead({ column, label, sort, onSort, numeric = false }: SortHeadProps) {
    const active = sort.key === column;
    const icon = active ? (sort.descending ? 'mdi-arrow-down' : 'mdi-arrow-up') : 'mdi-swap-vertical';

    return (
        <th
            scope="col"
            className={clsx(numeric && 'num')}
            aria-sort={active ? (sort.descending ? 'descending' : 'ascending') : undefined}
        >
            <button type="button" className={clsx('dash-sort', active && 'is-active')} onClick={() => onSort(column)}>
                {label}
                <i className={`mdi ${icon}`} aria-hidden="true" />
            </button>
        </th>
    );
}

/** A count, muted at zero so the ones that matter stand out. */
function Count({ value, tone }: { value: number; tone?: 'critical' | 'serious' }) {
    return <td className={clsx('num', value === 0 ? 'rd-muted' : tone && `dash-table__${tone}`)}>{value}</td>;
}

function MostUrgent({ person, now }: { person: TeamMember; now: string }) {
    const item = person.urgent[0];

    if (!item) {
        return <span className="rd-muted">{person.open > 0 ? 'Nothing overdue or at risk' : 'Nothing open'}</span>;
    }

    return (
        <span className="dash-table__urgent">
            <Link href={route('tasks.view', item.id)}>{item.title}</Link>
            <span className={`dash-table__due dash-table__due--${item.level}`}>{dueText(item, now).main}</span>
        </span>
    );
}

interface TeamTableProps {
    team: TeamMember[];
    /** When the figures were taken (ISO). */
    now: string;
    currency: string;
}

/** The team board: a row per active person, their open work and their last 7 days. */
export default function TeamTable({ team, now, currency }: TeamTableProps) {
    const { user, can } = useAuth();
    const wide = useMediaQuery('(min-width: 992px)');
    const [sort, setSort] = useState<Sort>({ key: 'overdue', descending: true });
    const people = useMemo(() => [...team].sort(compare(sort)), [team, sort]);

    const onSort = (key: SortKey) =>
        setSort((current) =>
            current.key === key ? { key, descending: !current.descending } : { key, descending: key !== 'name' },
        );

    // Their open tasks on the task list: as subscriber or sub-subscriber, like the counts.
    const tasksHref = (person: TeamMember) =>
        can('manage_task')
            ? route('tasks.index2', {
                  status: 'open',
                  filter_subscriber: person.user_id,
                  filter_subsubscriber: person.user_id,
              })
            : null;

    const name = (person: TeamMember) => {
        const href = tasksHref(person);
        return href ? (
            <Link href={href} className="rd-person__name">
                {person.name}
            </Link>
        ) : (
            <span className="rd-person__name">{person.name}</span>
        );
    };
    const role = (person: TeamMember) => (person.user_id === user?.id ? `${person.role} · you` : person.role);

    return (
        <section className="rd-panel" aria-labelledby="team-title">
            <div className="rd-panel__head">
                <div>
                    <h2 id="team-title" className="rd-panel__title">
                        Your team <span className="rd-count">{team.length}</span>
                    </h2>
                    <p className="rd-panel__sub">
                        Open is what each person is assigned to or helping with
                        {can('manage_task') && '; a name opens their open tasks'}. The last 7 days are today and the six
                        days before.
                    </p>
                </div>
            </div>

            {team.length === 0 ? (
                <p className="rd-empty">
                    No active team members yet. They appear here once they are added as users and set to active.{' '}
                    {can('manage_user') && <Link href={route('users.create')}>Add a user</Link>}
                </p>
            ) : wide ? (
                <table className="rd-table dash-table">
                    <thead>
                        <tr className="dash-table__group">
                            <td colSpan={5} />
                            <th scope="colgroup" colSpan={4} className="num">
                                Last 7 days
                            </th>
                        </tr>
                        <tr>
                            <SortHead column="name" label="Person" sort={sort} onSort={onSort} />
                            <SortHead column="open" label="Open" sort={sort} onSort={onSort} numeric />
                            <SortHead column="overdue" label="Overdue" sort={sort} onSort={onSort} numeric />
                            <SortHead column="at_risk" label="At risk" sort={sort} onSort={onSort} numeric />
                            <th scope="col">Most urgent</th>
                            <SortHead column="done_7d" label="Done" sort={sort} onSort={onSort} numeric />
                            <SortHead column="visits_7d" label="Visits" sort={sort} onSort={onSort} numeric />
                            <SortHead column="forms_7d" label="Forms" sort={sort} onSort={onSort} numeric />
                            <SortHead
                                column="orders_7d"
                                label={`Orders (${currency})`}
                                sort={sort}
                                onSort={onSort}
                                numeric
                            />
                        </tr>
                    </thead>
                    <tbody>
                        {people.map((person) => (
                            <tr key={person.user_id}>
                                <td>
                                    <span className="rd-person">
                                        <Initials name={person.name} colorKey={person.user_id} />
                                        <span className="rd-person__text">
                                            {name(person)}
                                            <span className="rd-person__sub">{role(person)}</span>
                                        </span>
                                    </span>
                                </td>
                                <Count value={person.open} />
                                <Count value={person.overdue} tone="critical" />
                                <Count value={person.at_risk} tone="serious" />
                                <td className="dash-table__urgent-cell">
                                    <MostUrgent person={person} now={now} />
                                </td>
                                <Count value={person.done_7d} />
                                <Count value={person.visits_7d} />
                                <Count value={person.forms_7d} />
                                <td className={clsx('num', person.orders_7d === 0 && 'rd-muted')}>
                                    {formatMoney(person.orders_7d)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            ) : (
                <ul className="dash-people list-unstyled mb-0">
                    {people.map((person) => (
                        <li key={person.user_id} className="dash-people__row">
                            <Initials name={person.name} colorKey={person.user_id} />
                            <div className="dash-people__text">
                                {name(person)}
                                <span className="rd-person__sub">{role(person)}</span>
                                <span className="dash-people__urgent">
                                    <MostUrgent person={person} now={now} />
                                </span>
                                <span className="dash-people__week">
                                    Last 7 days: {person.done_7d} done &middot; {person.visits_7d} visits &middot;{' '}
                                    {person.forms_7d} forms &middot; {currency} {formatMoney(person.orders_7d)}
                                </span>
                            </div>
                            <div className="dash-people__counts">
                                {person.overdue > 0 && (
                                    <span className="rd-chip rd-chip--critical">
                                        <i className="mdi mdi-alert-octagon" aria-hidden="true" />
                                        {person.overdue} overdue
                                    </span>
                                )}
                                {person.at_risk > 0 && (
                                    <span className="rd-chip rd-chip--serious">
                                        <i className="mdi mdi-alert" aria-hidden="true" />
                                        {person.at_risk} at risk
                                    </span>
                                )}
                                <span className="rd-muted">{person.open} open</span>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
