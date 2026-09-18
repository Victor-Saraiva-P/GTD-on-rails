const TARGET_SELECTORS = [
  "button:not([disabled])",
  "a[href]",
  "input:not([disabled]):not([type='hidden'])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "[role='button']:not([aria-disabled='true'])",
  "[role='tab']",
  ".stuff-list__item",
  ".next-actions-list__item",
  ".project-card",
  "[data-hintable='true']"
].join(", ");

function isElementWithinViewport(rect: DOMRect): boolean {
  if (rect.width === 0 || rect.height === 0) return false;
  const innerHeight = typeof window !== "undefined" ? window.innerHeight : 1000;
  const innerWidth = typeof window !== "undefined" ? window.innerWidth : 1000;
  if (rect.bottom < 0 || rect.top > innerHeight) return false;
  if (rect.right < 0 || rect.left > innerWidth) return false;
  return true;
}

function isElementVisible(element: HTMLElement, rect: DOMRect): boolean {
  if (!isElementWithinViewport(rect)) return false;
  if (typeof window === "undefined" || !window.getComputedStyle) return true;
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
}

function shouldSkipElement(element: HTMLElement): boolean {
  if (element.closest(".gtd-hint-overlay")) return true;
  if (element.matches("[data-hint-ignore]") || element.closest("[data-hint-ignore]")) return true;
  return false;
}

/**
 * Collects all currently visible and interactive elements available for hints.
 *
 * @example const targets = getInteractiveHintTargets(document)
 */
export function getInteractiveHintTargets(root: Document | HTMLElement = document): HTMLElement[] {
  const elements = root.querySelectorAll<HTMLElement>(TARGET_SELECTORS);
  const visibleTargets: HTMLElement[] = [];

  for (const el of elements) {
    if (shouldSkipElement(el)) continue;
    const rect = el.getBoundingClientRect();
    if (isElementVisible(el, rect)) {
      visibleTargets.push(el);
    }
  }

  return visibleTargets;
}
