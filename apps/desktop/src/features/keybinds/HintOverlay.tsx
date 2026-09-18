import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { generateHintLabels } from "./hintLabels.ts";
import { getInteractiveHintTargets } from "./hintTargets.ts";

interface PositionedHint {
  element: HTMLElement;
  label: string;
  left: number;
  top: number;
}

function computeHintPosition(rect: DOMRect): { left: number; top: number } {
  const scrollX = typeof window !== "undefined" ? window.scrollX : 0;
  const scrollY = typeof window !== "undefined" ? window.scrollY : 0;
  const left = Math.max(10, rect.left + scrollX + 8);
  const top = Math.max(10, rect.top + scrollY + 8);
  return { left, top };
}

function buildPositionedHints(): PositionedHint[] {
  const elements = getInteractiveHintTargets();
  const labels = generateHintLabels(elements.length);

  return elements.map((element, index) => {
    const rect = element.getBoundingClientRect();
    const pos = computeHintPosition(rect);
    return {
      element,
      label: labels[index] || "",
      left: pos.left,
      top: pos.top
    };
  });
}

function isModifierKey(key: string): boolean {
  return (
    key === "Shift" ||
    key === "Control" ||
    key === "Alt" ||
    key === "Meta" ||
    key === "CapsLock" ||
    key === "AltGraph"
  );
}

function handleHintKey(
  event: KeyboardEvent,
  setBuffer: (updater: (prev: string) => string) => void,
  onExit: () => void
): void {
  event.preventDefault();
  event.stopPropagation();
  if (event.key === "Escape") return onExit();
  if (event.key === "Backspace") {
    return setBuffer((b) => (b.length > 0 ? b.slice(0, -1) : b));
  }
  if (isModifierKey(event.key)) return;
  if (event.key.length === 1 && /^[a-zA-Z]$/.test(event.key)) {
    return setBuffer((b) => b + event.key.toLowerCase());
  }
  onExit();
}

function triggerHintTarget(target: PositionedHint, onExit: () => void): () => void {
  const timer = setTimeout(() => {
    target.element.click();
    target.element.focus();
    onExit();
  }, 40);
  return () => clearTimeout(timer);
}

function HintBadgeItem({ hint, buffer }: Readonly<{ hint: PositionedHint; buffer: string }>) {
  const isMatch = hint.label.startsWith(buffer);
  const matched = isMatch ? buffer : "";
  const remaining = isMatch ? hint.label.slice(buffer.length) : hint.label;
  const badgeClass = isMatch ? "gtd-hint-badge" : "gtd-hint-badge gtd-hint-badge--dim";

  return (
    <span key={hint.label} className={badgeClass} style={{ left: hint.left, top: hint.top }}>
      {matched ? <span className="gtd-hint-badge__matched">{matched}</span> : null}
      {remaining}
    </span>
  );
}

function useHintKeyboardListener(
  setBuffer: (updater: (prev: string) => string) => void,
  onExit: () => void
) {
  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleHintKey(event, setBuffer, onExit);
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, [onExit, setBuffer]);
}

function useHintMatchEffect(
  buffer: string,
  matching: PositionedHint[],
  onExit: () => void
) {
  useEffect(() => {
    if (buffer.length > 0 && matching.length === 1) {
      return triggerHintTarget(matching[0], onExit);
    }
    if (buffer.length > 0 && matching.length === 0) {
      onExit();
    }
    return undefined;
  }, [buffer, matching, onExit]);
}

/**
 * Full-screen hint mode overlay enabling direct jump to any interactive UI element.
 *
 * @example <HintOverlay onExit={() => setHintActive(false)} />
 */
export function HintOverlay({ onExit }: Readonly<{ onExit: () => void }>) {
  const [buffer, setBuffer] = useState("");
  const hints = useMemo(() => buildPositionedHints(), []);
  const matching = useMemo(
    () => hints.filter((hint) => hint.label.startsWith(buffer)),
    [hints, buffer]
  );

  useHintMatchEffect(buffer, matching, onExit);
  useHintKeyboardListener(setBuffer, onExit);

  if (hints.length === 0 || typeof document === "undefined") return null;

  return createPortal(
    <div className="gtd-hint-overlay" role="dialog" aria-modal="true" aria-label="Keyboard hint overlay">
      {hints.map((hint) => (
        <HintBadgeItem key={hint.label} hint={hint} buffer={buffer} />
      ))}
    </div>,
    document.body
  );
}
