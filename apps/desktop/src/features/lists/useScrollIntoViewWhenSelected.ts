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
    if (selected) {
      elementRef.current?.scrollIntoView({ block: "nearest" });
    }
  }, [selected]);

  return elementRef;
}
