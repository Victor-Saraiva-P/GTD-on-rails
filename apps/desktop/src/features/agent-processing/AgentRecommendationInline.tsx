import { useEffect, useRef, useState } from "react";
import { hasActiveModalKeybindScope } from "../keybinds/KeybindProvider";
import type { Stuff } from "../inbox/types";
import { useAgentProcessing } from "./AgentProcessingProvider";
import { AgentProcessingStuffStatus } from "./AgentProcessingStatus";
import { applyRecommendation } from "./applyRecommendation";
import type { AgentRecommendationOption } from "./types";

type Props = Readonly<{
  item: Stuff;
  selected: boolean;
  onConverted: (kind: AgentRecommendationOption["kind"]) => void;
  onManualProcessing: () => void;
}>;

const labels = {
  "next-action": "Next Action",
  project: "Project",
  calendar: "Calendar",
  someday: "Someday / Maybe",
};

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function useReviewSelection(item: Stuff, recommendation: ReturnType<ReturnType<typeof useAgentProcessing>["recommendationForStuff"]>) {
  const [expanded, setExpanded] = useState(false);
  const [index, setIndex] = useState<number | null>(recommendation?.recommendedIndex ?? null);
  const [title, setTitle] = useState("");
  const [draft, setDraft] = useState<AgentRecommendationOption | null>(null);
  useEffect(() => {
    setIndex(recommendation?.recommendedIndex ?? null);
    const selected = recommendation?.options[recommendation.recommendedIndex ?? -1];
    setDraft(selected ? { ...selected } : null);
    setTitle(selected?.title ?? item.title);
  }, [recommendation, item.id]);
  function choose(next: number) {
    const option = recommendation?.options[next];
    if (!option) return;
    setIndex(next);
    setDraft({ ...option });
    setTitle(option.title);
  }
  return { expanded, setExpanded, index, choose, title, setTitle, draft, setDraft };
}

function OptionalReviewDate({ label, value, onChange }: Readonly<{
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
}>) {
  const [adding, setAdding] = useState(false);
  const chooseDate = (date: string) => { onChange(date || null); if (date) setAdding(false); };
  return <div className="agent-review__date">
    <span>{label}</span>
    {value ? <div className="agent-review__date-controls">
      <input aria-label={label} type="date" value={value} onChange={event => chooseDate(event.target.value)} />
      <button type="button" onClick={() => { onChange(null); setAdding(false); }}>Clear date</button>
    </div> : <>
      <span className="agent-review__date-empty">No date suggested</span>
      {!adding ? <button type="button" onClick={() => setAdding(true)}>Add date</button> :
        <input aria-label={label} type="date" value="" onChange={event => chooseDate(event.target.value)} />}
    </>}
  </div>;
}

function ReviewFields({ draft, title, onTitle, onDraft }: Readonly<{
  draft: AgentRecommendationOption;
  title: string;
  onTitle: (title: string) => void;
  onDraft: (option: AgentRecommendationOption) => void;
}>) {
  const update = (values: Partial<AgentRecommendationOption>) => onDraft({ ...draft, ...values });
  return <div className="agent-review__fields">
    <label>Title <input aria-label="Proposed title" value={title} onChange={event => onTitle(event.target.value)} /></label>
    <label>Body (optional) <textarea aria-label="Proposed body" rows={3} placeholder="Leave empty to keep the original body"
      value={draft.body ?? ""} onChange={event => update({ body: event.target.value || null })} /></label>
    {draft.kind === "next-action" && <>
      <label>Energy (0–10) <input aria-label="Proposed energy" type="number" min="0" max="10" step="0.5" value={draft.energy ?? ""} onChange={event => update({ energy: event.target.value === "" ? null : Number(event.target.value) })} /></label>
      <label>Minutes <input aria-label="Proposed minutes" type="number" min="0" step="1" value={draft.minutes ?? ""} onChange={event => update({ minutes: event.target.value === "" ? null : Number(event.target.value) })} /></label>
    </>}
    {(draft.kind === "next-action" || draft.kind === "project") && <OptionalReviewDate label="Deadline (optional)" value={draft.deadline} onChange={deadline => update({ deadline })} />}
    {draft.kind === "calendar" && <>
      <OptionalReviewDate label="Scheduled date" value={draft.scheduledDate} onChange={scheduledDate => update({ scheduledDate })} />
      <label>Time (optional) <input aria-label="Proposed scheduled time" type="time" value={draft.scheduledTime ?? ""} onChange={event => update({ scheduledTime: event.target.value || null })} /></label>
    </>}
    {draft.kind === "next-action" && draft.contextIds.length > 0 && <span className="agent-review__context">Suggested context IDs: {draft.contextIds.join(", ")}</span>}
  </div>;
}

function isTypingInReview(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest("input, textarea, select, [contenteditable=true]"));
}

function useReviewShortcuts(
  active: boolean,
  optionCount: number,
  choose: (index: number) => void,
  confirm: () => Promise<void>,
  close: () => void,
  manual: () => void
) {
  useEffect(() => {
    if (!active) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (hasActiveModalKeybindScope()) return;
      if (event.key === "Escape") close();
      else if (isTypingInReview(event.target)) return;
      else if (event.key === "Enter" && !(event.target instanceof HTMLElement && event.target.closest("button"))) void confirm();
      else if (/^[1-3]$/.test(event.key) && Number(event.key) <= optionCount) choose(Number(event.key) - 1);
      else if (event.key === "p") manual();
      else return;
      event.preventDefault();
      event.stopPropagation();
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return () => window.removeEventListener("keydown", onKey, { capture: true });
  }, [active, optionCount, choose, confirm, close, manual]);
}

/** Places pending AI advice directly beneath the corresponding real Inbox row.
 * @example <AgentRecommendationInline item={stuff} selected onConverted={reload} onManualProcessing={openWizard} />
 */
export function AgentRecommendationInline({ item, selected, onConverted, onManualProcessing }: Props) {
  const agent = useAgentProcessing();
  const recommendation = agent.recommendationForStuff(item.id);
  const run = agent.runForStuff(item.id);
  const review = useReviewSelection(item, recommendation);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const running = run?.state === "running" || run?.state === "starting";
  useEffect(() => {
    if (run?.state === "finished" && recommendation) review.setExpanded(true);
  }, [run?.finishedAt, recommendation, review.setExpanded]);

  const stale = recommendation != null && recommendation.sourceTitle !== item.title;
  const abstained = recommendation?.recommendedIndex == null;
  const status = abstained ? "Needs clarification · no AI classification" : "Awaiting your decision · agent suggestion available";

  async function confirm() {
    if (!recommendation || !review.draft || stale || saving) return;
    setSaving(true); setError(null);
    try {
      await applyRecommendation(item, review.draft, review.title);
      await agent.dismissRecommendation(item.id);
      onConverted(review.draft.kind);
    } catch (cause) { setError(errorText(cause)); }
    finally { setSaving(false); }
  }

  async function dismiss() {
    if (!recommendation || saving) return;
    setSaving(true); setError(null);
    try { await agent.dismissRecommendation(item.id); }
    catch (cause) { setError(errorText(cause)); }
    finally { setSaving(false); }
  }

  function openReview() {
    review.setExpanded(true);
    requestAnimationFrame(() => root.current?.focus());
  }

  useReviewShortcuts(
    selected && review.expanded && !running,
    recommendation?.options.length ?? 0,
    review.choose,
    confirm,
    () => review.setExpanded(false),
    onManualProcessing
  );
  useEffect(() => {
    if (selected && review.expanded) requestAnimationFrame(() => root.current?.focus());
  }, [selected, review.expanded]);
  if (!recommendation && !run) return null;

  return <li className="agent-review__row">
    <div id={`agent-review-root-${item.id}`} ref={root} className="agent-review" tabIndex={review.expanded ? 0 : -1} data-agent-review-active={selected && review.expanded ? "true" : undefined}
      aria-label={`Agent recommendation for ${item.title}`}>
      {recommendation && <div className="agent-review__summary">
        <span className="agent-review__indicator">{abstained ? "◇" : "●"}</span>
        <span>{stale ? "Stuff changed since analysis · reanalyze before confirming" : status}</span>
        {selected && !review.expanded && <button id={`agent-review-trigger-${item.id}`} onClick={openReview}>Review</button>}
        {selected && review.expanded && <button onClick={() => review.setExpanded(false)}>Decide later <kbd>Esc</kbd></button>}
      </div>}
      {selected && running && <AgentProcessingStuffStatus stuffId={item.id} />}
      {selected && !running && !recommendation && run?.state === "failed" && <AgentProcessingStuffStatus stuffId={item.id} />}
      {selected && recommendation && review.expanded && <div className="agent-review__content">
        <p>{recommendation.reason}</p>
        {abstained && <div className="agent-review__clarification">
          <strong>No destination selected by the agent.</strong>
          {recommendation.questions.map(question => <p key={question}>? {question}</p>)}
          <span>Choose an alternative manually or leave the Stuff in Inbox.</span>
        </div>}
        <div className="agent-review__options">{recommendation.options.map((option, index) =>
          <button key={`${option.kind}-${index}`} className={review.index === index ? "agent-review__option agent-review__option--selected" : "agent-review__option"}
            onClick={() => review.choose(index)}><kbd>{index + 1}</kbd><span><strong>{labels[option.kind]}</strong>{index === recommendation.recommendedIndex ? " · Suggested" : " · Alternative"}<small>{option.reason}</small></span></button>)}</div>
        {review.draft ? <ReviewFields draft={review.draft} title={review.title} onTitle={review.setTitle} onDraft={review.setDraft} /> :
          <p className="agent-review__hint">No option selected. You can leave this undecided.</p>}
        {error && <p role="alert" className="agent-review__error">{error}</p>}
        <div className="agent-review__actions">
          {review.draft && !stale && <button disabled={saving} onClick={() => void confirm()}>Confirm conversion <kbd>Enter</kbd></button>}
          <button disabled={saving} onClick={() => review.setExpanded(false)}>Decide later <kbd>Esc</kbd></button>
          <button disabled={saving} onClick={onManualProcessing}>Process manually <kbd>p</kbd></button>
          <button disabled={saving} onClick={() => void dismiss()}>Dismiss suggestion</button>
          <button disabled={saving || running} onClick={() => void agent.start(item.id, item.title)}>Continue analysis <kbd>Space a</kbd></button>
          <button disabled={saving || running} onClick={() => void agent.start(item.id, item.title, true)}>New analysis <kbd>Space A</kbd></button>
        </div>
      </div>}
      {selected && !recommendation && !running && run?.state === "finished" && <button onClick={() => void agent.start(item.id, item.title, true)}>New analysis</button>}
    </div>
  </li>;
}
