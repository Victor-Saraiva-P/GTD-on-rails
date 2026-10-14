import type { AgentActivity } from "./types";

type AgentActivityFeedProps = Readonly<{
  activities: AgentActivity[];
  active: boolean;
  label?: string;
}>;

/** Renders concise provider-emitted reasoning/progress summaries without exposing raw run logs.
 *
 * @example <AgentActivityFeed activities={run.activities} active={true} />
 */
export function AgentActivityFeed({ activities, active, label = "Agent activity" }: AgentActivityFeedProps) {
  if (activities.length === 0) return null;
  return (
    <section className="agent-activity-feed" aria-label={label}>
      <header className="agent-activity-feed__header">
        <span>{label}</span>
        {active ? <span className="agent-activity-feed__live">live</span> : null}
      </header>
      <ol className="agent-activity-feed__items">
        {activities.map((activity, index) => <AgentActivityRow key={`${activity.kind}-${activity.message}-${index}`} activity={activity} />)}
      </ol>
    </section>
  );
}

function AgentActivityRow({ activity }: Readonly<{ activity: AgentActivity }>) {
  return (
    <li className={`agent-activity-feed__item agent-activity-feed__item--${activity.kind}`}>
      <span className="agent-activity-feed__kind">{activity.kind}</span>
      <span className="agent-activity-feed__message">{activity.message}</span>
    </li>
  );
}
