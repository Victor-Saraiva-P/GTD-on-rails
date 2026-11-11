import { useEffect, useMemo, useState } from "react";
import { ensureItemBodyLoaded } from "../inbox/itemBodyLoader";
import type { Stuff } from "../inbox/types";
import { diffReviewText, type ReviewDiffLine } from "./textReviewDiff";

type DiffRow = ReviewDiffLine | Readonly<{ kind: "omit"; text: string }>;

function compactLines(lines: ReviewDiffLine[]): DiffRow[] {
  if (lines.length <= 18) return lines;
  return [...lines.slice(0, 9), { kind: "omit", text: `${lines.length - 18} lines hidden` }, ...lines.slice(-9)];
}

function DiffLine({ line }: Readonly<{ line: DiffRow }>) {
  const sign = { same: " ", remove: "−", add: "+", omit: "…" }[line.kind];
  return <div className={`agent-detail-diff__line agent-detail-diff__line--${line.kind}`}>
    <span aria-hidden="true">{sign}</span><span>{line.text || " "}</span>
  </div>;
}

function DiffLines({ lines, expandable = false }: Readonly<{ lines: ReviewDiffLine[]; expandable?: boolean }>) {
  const [expanded, setExpanded] = useState(false);
  const visible = expandable && !expanded ? compactLines(lines) : lines;
  return <div className="agent-detail-diff__lines">
    {visible.map((line, index) => <DiffLine key={index} line={line} />)}
    {expandable && lines.length > 18 && <button type="button" onClick={() => setExpanded(value => !value)}>
      {expanded ? "Show fewer changes" : `Show all ${lines.length} lines`}
    </button>}
  </div>;
}

/** Replace the usual Stuff title with original/proposed lines only while reviewing.
 * @example <AgentReviewTitleDiff original={item.title} proposed={option.title} />
 */
export function AgentReviewTitleDiff({ original, proposed }: Readonly<{ original: string; proposed: string }>) {
  const lines = useMemo(() => diffReviewText(original, proposed), [original, proposed]);
  return <div className="inbox-detail__title agent-detail-diff__title" role="heading" aria-level={1} aria-label="Title preview">
    {lines.length ? <DiffLines lines={lines} /> : original}
  </div>;
}

function useOriginalBody(item: Stuff) {
  const [loaded, setLoaded] = useState<{ id: string; text: string | null; error: boolean } | null>(null);
  useEffect(() => {
    if (item.bodyLoaded !== false) return;
    let active = true;
    void ensureItemBodyLoaded(item).then(body => {
      if (active) setLoaded({ id: item.id, text: body.text, error: false });
    }).catch(() => {
      if (active) setLoaded({ id: item.id, text: null, error: true });
    });
    return () => { active = false; };
  }, [item.id, item.bodyLoaded]);
  const current = loaded?.id === item.id ? loaded : null;
  return { text: item.bodyLoaded !== false ? item.body.text : current?.text ?? null, error: current?.error ?? false };
}

function BodyDiffContent({ original, proposed }: Readonly<{ original: string; proposed: string }>) {
  const diff = useMemo(() => diffReviewText(original, proposed), [original, proposed]);
  const unchanged = original === "" ? [] : original.split("\n").map(text => ({ kind: "same" as const, text }));
  return <div className="agent-detail-diff__body-content">
    <span className="agent-detail-diff__legend">− Original　+ Proposed</span>
    <DiffLines lines={diff.length ? diff : unchanged} expandable />
  </div>;
}

/** Render the text changes inside the normal right-hand Stuff body surface.
 * @example <AgentReviewBodyDiff item={item} proposed={option.body ?? ""} />
 */
export function AgentReviewBodyDiff({ item, proposed }: Readonly<{ item: Stuff; proposed: string }>) {
  const body = useOriginalBody(item);
  if (body.error) return <p className="pane-state" role="alert">Failed to load original body for comparison.</p>;
  if (body.text === null) return <p className="pane-state">Loading original body...</p>;
  return <section className="inbox-detail__body agent-detail-diff__body" aria-label="Body preview">
    <BodyDiffContent original={body.text} proposed={proposed} />
  </section>;
}
