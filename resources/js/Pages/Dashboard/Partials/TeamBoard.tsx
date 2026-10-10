import { Link } from '@inertiajs/react';
import clsx from 'clsx';
import { useMemo, useState } from 'react';
import Initials from '@/Components/surface/Initials';
import Segmented from '@/Components/surface/Segmented';
import { useAuth } from '@/hooks/useAuth';
import { formatMoney } from '@/lib/format';
import type { TeamMember } from '../types';
import { dueText } from './due';

type Sort = 'urgent' | 'open' | 'name';

/** When their most urgent task is (was) due; people with none sort last. */
function firstDue(person: TeamMember): number {
    const due = person.urgent[0]?.due_at;
    return due ? Date.parse(due) : Infinity;
}

const byName = (a: TeamMember, b: TeamMember) => a.name.localeCompare(b.name);

// Infinity - Infinity is NaN, which is falsy, so ties fall through to the next key.
const SORTS: Record<Sort, (a: TeamMember, b: TeamMember) => number> = {
    urgent: (a, b) =>
        b.overdue - a.overdue || b.at_risk - a.at_risk || firstDue(a) - firstDue(b) || b.open - a.open || byName(a, b),
    open: (a, b) => b.open - a.open || b.overdue - a.overdue || byName(a, b),
    name: byName,
};

interface PersonCardProps {
    person: TeamMember;
    /** The most open tasks anyone holds; the load bar is drawn against it. */
    heaviest: number;
    now: string;
    currency: string;
    isYou: boolean;
    tasksHref: string | null;
}

function PersonCard({ person, heaviest, now, currency, isYou, tasksHref }: PersonCardProps) {
    const nameId = `member-${person.user_id}`;
    const segments = [
        { key: 'overdue', count: person.overdue, color: 'var(--rd-critical)' },
        { key: 'at_risk', count: person.at_risk, color: 'var(--rd-warning)' },
        { key: 'on_track', count: person.open - person.overdue - person.at_risk, color: 'var(--rd-brand-soft)' },
    ].filter((segment) => segment.count > 0);

    return (
        <article className="dash-member" aria-labelledby={nameId}>
            <div className="dash-member__head">
                <Initials name={person.name} colorKey={person.user_id} size="lg" />
                <div className="dash-member__who">
                    <h3 id={nameId} className="dash-member__name">
                        {tasksHref ? <Link href={tasksHref}>{person.name}</Link> : person.name}
                    </h3>
                    <span className="dash-member__role">
                        {person.role}
                        {isYou && ' · you'}
                    </span>
                </div>
                <div className="dash-member__open">
                    <span className="dash-member__count">{person.open}</span>
                    open
                </div>
            </div>

            <div className="dash-member__load">
                <span className="dash-member__track" aria-hidden="true">
                    {segments.length > 0 && (
                        <span className="rd-stack" style={{ width: `${(person.open / heaviest) * 100}%` }}>
                            {segments.map((segment) => (
                                <span
                                    key={segment.key}
                                    style={{ flexGrow: segment.count, background: segment.color }}
                                />
                            ))}
                        </span>
                    )}
                </span>
                <div className="dash-member__chips">
                    {person.overdue > 0 && (
                        <span className="rd-chip rd-chip--critical">
                            <span className="rd-dot" />
                            {person.overdue} overdue
                        </span>
                    )}
                    {person.at_risk > 0 && (
                        <span className="rd-chip rd-chip--serious">
                            <span className="rd-dot" />
                            {person.at_risk} at risk
                        </span>
                    )}
                    {person.open > 0 && person.overdue + person.at_risk === 0 && (
                        <span className="rd-chip rd-chip--good">
                            <span className="rd-dot" />
                            All on track
                        </span>
                    )}
                    {person.open === 0 && <span className="dash-member__quiet">No open tasks</span>}
                </div>
            </div>

            <div className="dash-member__urgent">
                <h4 className="dash-member__label">Most urgent</h4>
                {person.urgent.length > 0 ? (
                    <ul className="list-unstyled mb-0">
                        {person.urgent.map((item) => {
                            const due = dueText(item, now);

                            return (
                                <li key={item.id} className="dash-member__task">
                                    <div className="dash-member__what">
                                        <Link href={route('tasks.view', item.id)}>{item.title}</Link>
                                        <span>
                                            <span className="rd-mono">{item.reference}</span>
                                            {item.lead && <> &middot; {item.lead}</>}
                                        </span>
                                    </div>
                                    <span className={clsx('dash-member__due', `dash-member__due--${item.level}`)}>
                                        {due.main}
                                        {due.sub && <small>{due.sub}</small>}
                                    </span>
                                </li>
                            );
                        })}
                    </ul>
                ) : (
                    <p className="dash-member__quiet">Nothing overdue or at risk.</p>
                )}
            </div>

            <dl className="dash-member__week">
                <div>
                    <dt>Done</dt>
                    <dd>{person.done_7d}</dd>
                </div>
                <div>
                    <dt>Visits</dt>
                    <dd>{person.visits_7d}</dd>
                </div>
                <div>
                    <dt>Forms</dt>
                    <dd>{person.forms_7d}</dd>
                </div>
                <div>
                    <dt>Orders ({currency})</dt>
                    <dd>{formatMoney(person.orders_7d)}</dd>
                </div>
            </dl>
        </article>
    );
}

interface TeamBoardProps {
    team: TeamMember[];
    /** When the figures were taken (ISO). */
    now: string;
    currency: string;
}

/** A card per active team member: their open work, what is most urgent, and their last 7 days. */
export default function TeamBoard({ team, now, currency }: TeamBoardProps) {
    const { user, can } = useAuth();
    const [sort, setSort] = useState<Sort>('urgent');
    const people = useMemo(() => [...team].sort(SORTS[sort]), [team, sort]);
    const heaviest = Math.max(1, ...team.map((person) => person.open));

    // Their open tasks on the task list: as subscriber or sub-subscriber, like the counts.
    const tasksHref = (person: TeamMember) =>
        can('manage_task')
            ? route('tasks.index2', {
                  status: 1,
                  filter_subscriber: person.user_id,
                  filter_subsubscriber: person.user_id,
              })
            : null;

    return (
        <section className="dash-team" aria-labelledby="team-title">
            <div className="dash-team__head">
                <div className="dash-team__title">
                    <h2 id="team-title">Your team</h2>
                    <span className="rd-count">{team.length}</span>
                </div>
                {team.length > 1 && (
                    <div className="dash-team__sort">
                        <span aria-hidden="true">Sort by</span>
                        <Segmented
                            label="Sort by"
                            value={sort}
                            onChange={setSort}
                            options={[
                                { value: 'urgent', label: 'Most urgent' },
                                { value: 'open', label: 'Most open' },
                                { value: 'name', label: 'Name' },
                            ]}
                        />
                    </div>
                )}
            </div>

            {team.length === 0 ? (
                <div className="rd-panel">
                    <p className="rd-empty">No active team members yet.</p>
                </div>
            ) : (
                <>
                    <ul className="dash-team__grid list-unstyled mb-0">
                        {people.map((person) => (
                            <li key={person.user_id}>
                                <PersonCard
                                    person={person}
                                    heaviest={heaviest}
                                    now={now}
                                    currency={currency}
                                    isYou={person.user_id === user?.id}
                                    tasksHref={tasksHref(person)}
                                />
                            </li>
                        ))}
                    </ul>
                    <p className="dash-team__note">
                        Open tasks are the ones each person holds as subscriber or sub-subscriber. The figures along the
                        bottom of each card are the last 7 days: today and the six days before.
                    </p>
                </>
            )}
        </section>
    );
}
