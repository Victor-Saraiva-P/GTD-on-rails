import { useEffect, useRef } from "react";
import { buildApiUrl } from "../../config/env.ts";
import { refreshLoadedItemBody } from "../inbox/itemBodyLoader.ts";
import type { DatabaseSyncStatus } from "./types.ts";

export type DomainChange = Readonly<{
  cursor: number;
  objectType: string;
  objectId: string;
  operation: string;
  revision: number;
}>;

export const DOMAIN_CHANGE_EVENT = "gtd:domain-change";
export const DATABASE_SYNC_STATUS_EVENT = "gtd:database-sync-status";
const DOMAIN_REVALIDATION_DELAY_MS = 50;

export type DomainRevalidationScheduler = Readonly<{
  cancel: () => void;
  schedule: () => void;
}>;

/**
 * Coalesces bursts of domain-change events into one collection revalidation.
 *
 * @example const scheduler = createDomainRevalidationScheduler(reload)
 */
export function createDomainRevalidationScheduler(
  reload: () => void,
  delayMs = DOMAIN_REVALIDATION_DELAY_MS
): DomainRevalidationScheduler {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return {
    cancel: () => {
      if (timer === null) return;
      clearTimeout(timer);
      timer = null;
    },
    schedule: () => {
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        reload();
      }, delayMs);
    }
  };
}

export function useDomainChangeStream(): void {
  useEffect(() => {
    const source = new EventSource(buildApiUrl("/events/domain"));

    const handleChange = (event: MessageEvent<string>) => {
      const change = parseDomainChange(event.data);
      if (!change) return;
      window.dispatchEvent(new CustomEvent<DomainChange>(DOMAIN_CHANGE_EVENT, { detail: change }));
    };

    const handleDatabaseSyncStatus = (event: MessageEvent<string>) => {
      try {
        const status = JSON.parse(event.data) as DatabaseSyncStatus;
        window.dispatchEvent(new CustomEvent<DatabaseSyncStatus>(DATABASE_SYNC_STATUS_EVENT, { detail: status }));
      } catch {
        // Ignore malformed SSE payloads and let polling provide the fallback snapshot.
      }
    };

    source.addEventListener("domain-change", handleChange as EventListener);
    source.addEventListener("database-sync-status", handleDatabaseSyncStatus as EventListener);
    return () => source.close();
  }, []);
}

export function useDatabaseSyncStatusListener(
  listener: (status: DatabaseSyncStatus) => void
): void {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    const handleStatus = (event: Event) => {
      listenerRef.current((event as CustomEvent<DatabaseSyncStatus>).detail);
    };
    window.addEventListener(DATABASE_SYNC_STATUS_EVENT, handleStatus);
    return () => window.removeEventListener(DATABASE_SYNC_STATUS_EVENT, handleStatus);
  }, []);
}

export function useDomainChangeListener(
  listener: (change: DomainChange) => void
): void {
  const listenerRef = useRef(listener);
  listenerRef.current = listener;

  useEffect(() => {
    const handleChange = (event: Event) => {
      listenerRef.current((event as CustomEvent<DomainChange>).detail);
    };
    window.addEventListener(DOMAIN_CHANGE_EVENT, handleChange);
    return () => window.removeEventListener(DOMAIN_CHANGE_EVENT, handleChange);
  }, []);
}

export function useDomainRevalidation(
  objectTypes: readonly string[],
  reload: () => void
): void {
  const typesRef = useRef(new Set(objectTypes));
  const reloadRef = useRef(reload);
  const schedulerRef = useRef<DomainRevalidationScheduler | null>(null);
  typesRef.current = new Set(objectTypes);
  reloadRef.current = reload;
  schedulerRef.current ??= createDomainRevalidationScheduler(() => reloadRef.current());

  useDomainChangeListener((change) => {
    if (!typesRef.current.has(change.objectType)) return;
    if (change.objectType === "body_document" && change.operation !== "DELETE") {
      void refreshLoadedItemBody(change.objectId);
      return;
    }
    schedulerRef.current?.schedule();
  });
  useEffect(() => () => schedulerRef.current?.cancel(), []);
}

function parseDomainChange(value: string): DomainChange | null {
  try {
    const parsed = JSON.parse(value) as Partial<DomainChange>;
    if (
      typeof parsed.objectType !== "string" ||
      typeof parsed.objectId !== "string" ||
      typeof parsed.operation !== "string"
    ) return null;
    return {
      cursor: Number(parsed.cursor ?? 0),
      objectType: parsed.objectType,
      objectId: parsed.objectId,
      operation: parsed.operation,
      revision: Number(parsed.revision ?? 0)
    };
  } catch {
    return null;
  }
}
