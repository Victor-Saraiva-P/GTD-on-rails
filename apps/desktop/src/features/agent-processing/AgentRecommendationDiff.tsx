import { useEffect, useMemo, useState } from "react";
import { ensureItemBodyLoaded } from "../inbox/itemBodyLoader";
import type { Stuff } from "../inbox/types";
import type { AgentRecommendationOption } from "./types";
import { diffReviewText, type ReviewDiffLine } from "./textReviewDiff";

type DiffRow = ReviewDiffLine | Readonly<{ kind: "omit"; text: string }>;

function shortDiff(lines: ReviewDiffLine[]): DiffRow[] {
  if (lines.length <= 18) return lines;
  return [...lines.slice(0, 9), { kind: "omit", text: `${lines.length - 18} lines hidden` }, ...lines.slice(-9)];
}

function DiffBlock({ label, before, after }: Readonly<{ label: string; before: string; after: string }>) {
  const [full, setFull] = useState(false);
  const lines = useMemo(() => diffReviewText(before, after), [before, after]);
  const visible = full ? lines : shortDiff(lines);
  return <div className="agent-review__diff-file" aria-label={`${label} changes`}>
    <div className="agent-review__diff-file-heading">{label} {lines.length === 0 && <span>Unchanged</span>}</div>
    {lines.length > 0 && <div className="agent-review__diff-lines">
      {visible.map((line, index) => <div key={index} className={`agent-review__diff-line agent-review__diff-line--${line.kind}`}>
        <span aria-hidden="true">{line.kind === "remove" ? "−" : line.kind === "add" ? "+" : line.kind === "omit" ? "…" : " "}</span>
        <span>{line.text || " "}</span>
      </div>)}
    </div>}
    {lines.length > 18 && <button type="button" onClick={() => setFull(value => !value)}>
      {full ? "Show less" : `Show all ${lines.length} diff lines`}
    </button>}
  </div>;
}

function useOriginalBody(item: Stuff, needed: boolean) {
  const [loaded, setLoaded] = useState<{ id: string; text: string | null; error: boolean } | null>(null);
  useEffect(() => {
    if (!needed || item.bodyLoaded !== false) return;
    let active = true;
    void ensureItemBodyLoaded(item).then(body => {
      if (active) setLoaded({ id: item.id, text: body.text, error: false });
    }).catch(() => {
      if (active) setLoaded({ id: item.id, text: null, error: true });
    });
    return () => { active = false; };
  }, [item.id, item.bodyLoaded, needed]);
  const current = loaded?.id === item.id ? loaded : null;
  return { text: item.bodyLoaded !== false ? item.body.text : current?.text ?? null, error: current?.error ?? false };
}

/** Shows Git-style original/proposed text without the oversized editing controls.
 * @example <AgentRecommendationDiff item={stuff} option={suggestion} />
 */
export function AgentRecommendationDiff({ item, option }: Readonly<{ item: Stuff; option: AgentRecommendationOption }>) {
  const body = useOriginalBody(item, option.body != null);
  return <section className="agent-review__text-preview" aria-label="Proposed text changes">
    <div className="agent-review__text-preview-heading">
      <strong>Text changes</strong><span><b>−</b> Original <b>+</b> Proposed</span>
    </div>
    <DiffBlock label="Title" before={item.title} after={option.title} />
    {option.body == null ? <div className="agent-review__diff-unchanged">Body unchanged</div> :
      body.error ? <p className="agent-review__error" role="alert">Could not load original body for comparison.</p> :
      body.text === null ? <p className="agent-review__hint">Loading original body…</p> :
      <DiffBlock label="Body" before={body.text} after={option.body} />}
  </section>;
}
