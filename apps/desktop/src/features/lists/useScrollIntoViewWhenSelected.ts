import { useEffect, useRef, type RefObject } from "react";

/**
 * Scrolls the attached element into view whenever it becomes selected.
 *
 * @example
 * const buttonRef = useScrollIntoViewWhenSelected(isSelected);
 * return <button ref={buttonRef}>Item</button>;
 */
export function useScrollIntoViewWhenSelected<T extends HTMLElement = HTMLButtonElement>(
  selected: boolean
): RefObject<T | null> {
  const elementRef = useRef<T>(null);

  useEffect(() => {
    if (!selected) return;
    elementRef.current?.scrollIntoView({ block: "nearest" });
    if (document.activeElement?.classList.contains("tree-entry")) {
      elementRef.current?.focus({ preventScroll: true });
    }
  }, [selected]);

  return elementRef;
}
