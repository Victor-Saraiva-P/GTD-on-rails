import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  fetchSyncConflict,
  fetchSyncConflicts,
  rebootstrapSyncClient,
  resolveSyncConflict
} from "./api.ts";
import type {
  DatabaseSyncStatus,
  FileSyncStatus,
  SyncConflictChoice,
  SyncConflictDetail,
  SyncConflictSummary
} from "./types.ts";

type SyncRecoveryPanelProps = Readonly<{
  open: boolean;
  database: DatabaseSyncStatus | null;
  file: FileSyncStatus | null;
  onClose: () => void;
  onChanged: () => void;
}>;

export function SyncRecoveryPanel({
  open,
  database,
  file,
  onClose,
  onChanged
}: SyncRecoveryPanelProps) {
  const controller = useRecoveryController(open, onChanged);
  const rebootstrapRequired =
    database?.state === "REBOOTSTRAP_REQUIRED" || file?.state === "REBOOTSTRAP_REQUIRED";

  if (!open) return null;

  return (
    <div className="sync-recovery" role="dialog" aria-modal="true" aria-label="Synchronization recovery">
      <div className="sync-recovery__panel">
        <header className="sync-recovery__header">
          <div>
            <strong>Synchronization recovery</strong>
            <div className="sync-recovery__hint">Resolve conflicts or rebuild this client after a server restore.</div>
          </div>
          <button type="button" className="sync-recovery__close" onClick={onClose} aria-label="Close synchronization recovery">×</button>
        </header>

        {rebootstrapRequired ? (
          <RebootstrapSection controller={controller} />
        ) : null}

        <ConflictSection controller={controller} />

        {controller.error ? <div className="sync-recovery__error">{controller.error}</div> : null}
      </div>
    </div>
  );
}

type RecoveryController = ReturnType<typeof useRecoveryController>;

function RebootstrapSection({ controller }: Readonly<{ controller: RecoveryController }>) {
  return (
    <section className="sync-recovery__section">
      <h3>Server history changed</h3>
      <p>
        The server was restored to another dataset history. Rebootstrap creates a local recovery snapshot first,
        then rebuilds this client from the server.
      </p>
      <button
        type="button"
        className="sync-recovery__primary"
        disabled={controller.busy}
        onClick={() => void controller.rebootstrap()}
      >
        Rebootstrap from server
      </button>
      {controller.recoverySnapshot ? (
        <div className="sync-recovery__hint">Recovery snapshot: {controller.recoverySnapshot}</div>
      ) : null}
    </section>
  );
}

function ConflictSection({ controller }: Readonly<{ controller: RecoveryController }>) {
  if (controller.conflicts.length === 0) {
    return (
      <section className="sync-recovery__section">
        <h3>Conflicts</h3>
        <p>No unresolved synchronization conflicts.</p>
      </section>
    );
  }

  return (
    <section className="sync-recovery__section">
      <h3>Conflicts ({controller.conflicts.length})</h3>
      <ConflictPicker controller={controller} />
      {controller.detail ? <ConflictEditor controller={controller} detail={controller.detail} /> : null}
    </section>
  );
}

function ConflictPicker({ controller }: Readonly<{ controller: RecoveryController }>) {
  return (
    <select
      className="sync-recovery__select"
      value={controller.selectedId ?? ""}
      onChange={(event) => controller.select(Number(event.target.value))}
    >
      {controller.conflicts.map((conflict) => (
        <option key={conflict.id} value={conflict.id}>
          {conflict.objectType} · {conflict.objectId} · r{conflict.remoteRevision}
        </option>
      ))}
    </select>
  );
}

function ConflictEditor({
  controller,
  detail
}: Readonly<{ controller: RecoveryController; detail: SyncConflictDetail }>) {
  return (
    <div className="sync-recovery__conflict">
      <ContentPair detail={detail} />
      {detail.mergeSupported ? (
        <label className="sync-recovery__merge">
          <span>Merged Markdown</span>
          <textarea
            value={controller.mergedContent}
            onChange={(event) => controller.setMergedContent(event.target.value)}
          />
        </label>
      ) : null}
      <div className="sync-recovery__actions">
        <ResolveButton controller={controller} choice="LOCAL">Use local</ResolveButton>
        <ResolveButton controller={controller} choice="REMOTE">Use remote</ResolveButton>
        {detail.mergeSupported ? (
          <ResolveButton controller={controller} choice="MERGED">Use merged</ResolveButton>
        ) : null}
      </div>
    </div>
  );
}

function ContentPair({ detail }: Readonly<{ detail: SyncConflictDetail }>) {
  const hasText = detail.localContent !== null || detail.remoteContent !== null;
  if (!hasText) {
    return <p>This is a binary conflict. Choose whether the local or remote version should win.</p>;
  }

  return (
    <div className="sync-recovery__compare">
      <ContentBlock label="Local" value={detail.localContent} />
      <ContentBlock label="Remote" value={detail.remoteContent} />
    </div>
  );
}

function ContentBlock({ label, value }: Readonly<{ label: string; value: string | null }>) {
  return (
    <div>
      <strong>{label}</strong>
      <pre>{value ?? "(deleted)"}</pre>
    </div>
  );
}

function ResolveButton({
  controller,
  choice,
  children
}: Readonly<{ controller: RecoveryController; choice: SyncConflictChoice; children: string }>) {
  return (
    <button
      type="button"
      disabled={controller.busy}
      onClick={() => void controller.resolve(choice)}
    >
      {children}
    </button>
  );
}

function useRecoveryController(open: boolean, onChanged: () => void) {
  const [conflicts, setConflicts] = useState<SyncConflictSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<SyncConflictDetail | null>(null);
  const [mergedContent, setMergedContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoverySnapshot, setRecoverySnapshot] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    void reloadConflicts(setConflicts, setSelectedId, setError);
  }, [open]);

  useEffect(() => {
    if (selectedId === null) {
      setDetail(null);
      return;
    }
    void loadDetail(selectedId, setDetail, setMergedContent, setError);
  }, [selectedId]);

  return useMemo(() => ({
    conflicts,
    selectedId,
    detail,
    mergedContent,
    busy,
    error,
    recoverySnapshot,
    setMergedContent,
    select: setSelectedId,
    resolve: async (choice: SyncConflictChoice) => {
      if (selectedId === null) return;
      await runBusy(setBusy, setError, async () => {
        await resolveSyncConflict(selectedId, choice, choice === "MERGED" ? mergedContent : undefined);
        await reloadConflicts(setConflicts, setSelectedId, setError);
        onChanged();
      });
    },
    rebootstrap: async () => {
      await runBusy(setBusy, setError, async () => {
        const result = await rebootstrapSyncClient();
        setRecoverySnapshot(result.recoverySnapshot);
        await reloadConflicts(setConflicts, setSelectedId, setError);
        onChanged();
      });
    }
  }), [
    busy,
    conflicts,
    detail,
    error,
    mergedContent,
    onChanged,
    recoverySnapshot,
    selectedId
  ]);
}

async function reloadConflicts(
  setConflicts: (value: SyncConflictSummary[]) => void,
  setSelectedId: Dispatch<SetStateAction<number | null>>,
  setError: (value: string | null) => void
) {
  try {
    const next = await fetchSyncConflicts();
    setConflicts(next);
    setSelectedId((current) => next.some((item) => item.id === current) ? current : next[0]?.id ?? null);
  } catch (error) {
    setError(error instanceof Error ? error.message : String(error));
  }
}

async function loadDetail(
  id: number,
  setDetail: (value: SyncConflictDetail) => void,
  setMergedContent: (value: string) => void,
  setError: (value: string | null) => void
) {
  try {
    const next = await fetchSyncConflict(id);
    setDetail(next);
    setMergedContent(next.localContent ?? "");
  } catch (error) {
    setError(error instanceof Error ? error.message : String(error));
  }
}

async function runBusy(
  setBusy: (value: boolean) => void,
  setError: (value: string | null) => void,
  action: () => Promise<void>
) {
  setBusy(true);
  setError(null);
  try {
    await action();
  } catch (error) {
    setError(error instanceof Error ? error.message : String(error));
  } finally {
    setBusy(false);
  }
}
