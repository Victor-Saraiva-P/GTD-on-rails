import { useEffect, useRef } from "react";

type ProcessingInitialStepProps = Readonly<{
  onNextAction: () => void;
  onCalendar: () => void;
  onProject: () => void;
  onSomedayMaybe: () => void;
  onCancel: () => void;
  allowProject?: boolean;
}>;

function handleInitialKey(
  key: string,
  actions: { allowProject: boolean; onCalendar: () => void; onCancel: () => void; onNextAction: () => void; onProject: () => void; onSomedayMaybe: () => void }
): boolean {
  if (key === "escape") { actions.onCancel(); return true; }
  if (key === "n") { actions.onNextAction(); return true; }
  if (key === "c") { actions.onCalendar(); return true; }
  if (key === "s") { actions.onSomedayMaybe(); return true; }
  if (actions.allowProject && key === "p") { actions.onProject(); return true; }
  return false;
}

export function ProcessingInitialStep({ allowProject = true, onNextAction, onCalendar, onProject, onSomedayMaybe, onCancel }: ProcessingInitialStepProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
    const listener = (event: globalThis.KeyboardEvent) => {
      const handled = handleInitialKey(event.key.toLowerCase(), { allowProject, onCalendar, onCancel, onNextAction, onProject, onSomedayMaybe });
      if (handled) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("keydown", listener, true);
    return () => window.removeEventListener("keydown", listener, true);
  }, [allowProject, onCalendar, onCancel, onNextAction, onProject, onSomedayMaybe]);

  return (
    <div ref={containerRef} className="processing-dialog__step processing-dialog__step--initial" tabIndex={-1}>
      <button className="processing-dialog__command" type="button" onClick={onNextAction}>
        <kbd>n</kbd><span>Next actions</span>
      </button>
      <button className="processing-dialog__command" type="button" onClick={onCalendar}>
        <kbd>c</kbd><span>Calendar</span>
      </button>
      {allowProject ? <button className="processing-dialog__command" type="button" onClick={onProject}><kbd>p</kbd><span>Projects</span></button> : null}
      <button className="processing-dialog__command" type="button" onClick={onSomedayMaybe}>
        <kbd>s</kbd><span>Someday/Maybe</span>
      </button>
    </div>
  );
}
