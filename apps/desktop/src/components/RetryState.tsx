type RetryStateProps = {
  message: string;
  onRetry: () => void;
};

/**
 * Shows a recoverable pane error with the retry action wired by the caller.
 *
 * @example <RetryState message="Failed to load inbox" onRetry={reload} />
 */
export function RetryState({ message, onRetry }: RetryStateProps) {
  return (
    <div className="pane-state">
      <p>{message}</p>
      <button type="button" className="pane-state__action" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
