type ZoomModeExitButtonProps = Readonly<{
  onExit: () => void;
}>;

/**
 * Floating button in the corner during Zoom Mode allowing quick exit with Esc or mouse.
 *
 * @example <ZoomModeExitButton onExit={exitZoomMode} />
 */
export function ZoomModeExitButton({ onExit }: ZoomModeExitButtonProps) {
  return (
    <button
      type="button"
      className="zoom-mode-exit-button"
      onClick={onExit}
      title="Exit Zoom Mode (Esc or Space z)"
      aria-label="Exit Zoom Mode"
    >
      <span className="zoom-mode-exit-button__pulse" aria-hidden="true" />
      <span className="zoom-mode-exit-button__label">Zoom Mode</span>
      <kbd className="zoom-mode-exit-button__kbd">Esc</kbd>
    </button>
  );
}
