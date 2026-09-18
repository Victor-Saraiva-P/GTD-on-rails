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

function isModifierKey(key: string): boolean {
  return key === "Shift" || key === "Control" || key === "Alt" || key === "Meta";
}

function triggerHintTarget(target: PositionedHint, onExit: () => void) {
  setTimeout(() => {
    target.element.focus();
    target.element.click();
    onExit();
  }, 40);
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

  useEffect(() => {
    if (buffer.length > 0 && matching.length === 1) {
      triggerHintTarget(matching[0], onExit);
    } else if (buffer.length > 0 && matching.length === 0) {
      onExit();
    }
  }, [buffer, matching, onExit]);

  useEffect(() => {
    const listener = (event: KeyboardEvent) => handleHintKey(event, setBuffer, onExit);
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, [onExit]);

  if (hints.length === 0 || typeof document === "undefined") return null;

  return createPortal(
    <div className="gtd-hint-overlay" role="dialog" aria-label="Keyboard hint overlay">
      {hints.map((hint) => {
        const isMatch = hint.label.startsWith(buffer);
        const matched = buffer;
        const remaining = hint.label.slice(buffer.length);
        return (
          <span
            key={hint.label}
            className={isMatch ? "gtd-hint-badge" : "gtd-hint-badge gtd-hint-badge--dim"}
            style={{ left: hint.left, top: hint.top }}
          >
            {matched && <span className="gtd-hint-badge__matched">{matched}</span>}
            {remaining}
          </span>
        );
      })}
    </div>,
    document.body
  );
}
