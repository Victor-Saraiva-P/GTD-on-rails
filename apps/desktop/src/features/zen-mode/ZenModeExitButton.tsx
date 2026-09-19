type ZenModeExitButtonProps = Readonly<{
  onExit: () => void;
}>;

/**
 * Floating button in the corner during Zen Mode allowing quick exit with Esc or mouse.
 *
 * @example <ZenModeExitButton onExit={exitZenMode} />
 */
export function ZenModeExitButton({ onExit }: ZenModeExitButtonProps) {
  return (
    <button
      type="button"
      className="zen-mode-exit-button"
      onClick={onExit}
      title="Exit Zen Mode (Esc or Space z)"
      aria-label="Exit Zen Mode"
    >
      <span className="zen-mode-exit-button__pulse" aria-hidden="true" />
      <span className="zen-mode-exit-button__label">Zen Mode</span>
      <kbd className="zen-mode-exit-button__kbd">Esc</kbd>
    </button>
  );
}
