type RetryStateProps = {
  message: string;
  onRetry: () => void;
};

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
