import { useEffect, useState, type PropsWithChildren } from "react";
import { invoke } from "@tauri-apps/api/core";
import { setRuntimeApiBaseUrl } from "../config/env.ts";
import { appMetadata } from "../config/appMetadata.ts";
import { apiFetch, apiJson } from "../lib/api/apiClient.ts";
import { isTauriRuntime } from "../lib/tauriRuntime.ts";
import { DatabaseSetup } from "../features/bootstrap/DatabaseSetup.tsx";
import { DatabaseRepair } from "../features/bootstrap/DatabaseRepair.tsx";
import { bootstrapUiState, type BootstrapUiState } from "../features/bootstrap/databaseBootstrapState.ts";
import { shouldCheckNativeUpdates, startupSteps, type StartupStep } from "./nativeUpdatePolicy.ts";
import "../styles/boot-loader.css";

const PING_INTERVAL_MS = 1000;
const SIDECAR_STATUS_INTERVAL_MS = 250;

type SidecarBackendStatus = {
  enabled: boolean;
  baseUrl: string | null;
  error: string | null;
};

type NativeUpdateStatus = {
  available: boolean;
  latestVersion: string;
  archiveName: string | null;
  archiveUrl: string | null;
  checksumName: string | null;
  checksumUrl: string | null;
};

async function pingBackend(): Promise<"ready" | BootstrapUiState> {
  try {
    await apiFetch("/readiness");
    return "ready";
  } catch {
    try {
      const status = await apiJson<{ status: string }>("/bootstrap/status");
      return bootstrapUiState(status.status);
    } catch {
      return "offline";
    }
  }
}

async function waitForBackendBaseUrl(): Promise<void> {
  if (!isTauriRuntime()) return;

  while (true) {
    const status = await invoke<SidecarBackendStatus>("sidecar_backend_status");
    if (!status.enabled) return;
    if (status.error) throw new Error(status.error);
    if (status.baseUrl) return setRuntimeApiBaseUrl(status.baseUrl);
    await delay(SIDECAR_STATUS_INTERVAL_MS);
  }
}

async function startBackend(): Promise<void> {
  if (isTauriRuntime()) await invoke("start_sidecar_command");
}

async function runStartupStep(
  step: StartupStep,
  setUpdateStatus: (status: string) => void
): Promise<boolean> {
  if (step === "native-update") return installNativeUpdate(setUpdateStatus);
  await startBackend();
  return false;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

async function installNativeUpdate(setUpdateStatus: (status: string) => void): Promise<boolean> {
  if (!shouldCheckNativeUpdates(isTauriRuntime(), import.meta.env.DEV)) return false;

  const update = await invoke<NativeUpdateStatus>("native_update_check");
  if (!update.available) return false;

  setUpdateStatus(`Installing update ${update.latestVersion}; the app will restart...`);
  await delay(1500);
  await invoke("native_update_install", { request: requiredNativeUpdate(update) });
  return true;
}

function requiredNativeUpdate(update: NativeUpdateStatus) {
  if (!update.archiveName || !update.archiveUrl || !update.checksumName || !update.checksumUrl) {
    throw new Error(
      `native update ${update.latestVersion} is invalid; expected archive and checksum assets`
    );
  }
  return update;
}

function useBackendHealth() {
  const [isBooted, setIsBooted] = useState(false);
  const [dots, setDots] = useState("");
  const [bootError, setBootError] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [bootstrapState, setBootstrapState] = useState<BootstrapUiState | null>(null);

  useEffect(() => {
    let timeout: number;

    const checkHealth = async () => {
      if (isTauriRuntime()) {
        try {
          const steps = startupSteps(isTauriRuntime(), import.meta.env.DEV);
          for (const step of steps) {
            if (await runStartupStep(step, setUpdateStatus)) return;
          }
        } catch (e) {
          console.error("Failed to check for updates:", e);
        }
      }

      try {
        await waitForBackendBaseUrl();
      } catch (error) {
        setBootError((error as Error).message);
        return;
      }
      const backendState = await pingBackend();
      if (backendState === "ready") {
        setSetupRequired(false);
        setBootstrapState(null);
        setIsBooted(true);
      } else if (backendState === "setup" || backendState === "repair") {
        setSetupRequired(true);
        setBootstrapState(backendState);
        timeout = window.setTimeout(() => void checkHealth(), PING_INTERVAL_MS);
      } else {
        timeout = window.setTimeout(() => void checkHealth(), PING_INTERVAL_MS);
      }
    };

    void checkHealth();

    return () => {
      window.clearTimeout(timeout);
    };
  }, []);

  useEffect(() => {
    if (isBooted) return;

    const dotInterval = window.setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "" : prev + "."));
    }, 500);

    return () => window.clearInterval(dotInterval);
  }, [isBooted]);

  return { isBooted, dots, bootError, updateStatus, setupRequired, bootstrapState };
}

/**
 * Global boot loader that polls the backend until it comes online.
 * Renders a retro terminal loading screen while waiting.
 */
export function BootLoader({ children }: PropsWithChildren) {
  const { isBooted, dots, bootError, updateStatus, setupRequired, bootstrapState } = useBackendHealth();
  const [shouldRenderLoader, setShouldRenderLoader] = useState(true);

  // Allow time for fade-out animation
  useEffect(() => {
    if (isBooted) {
      const timer = window.setTimeout(() => setShouldRenderLoader(false), 500);
      return () => window.clearTimeout(timer);
    }
  }, [isBooted]);

  return (
    <>
      {shouldRenderLoader && !setupRequired && (
        <div className={`boot-loader ${isBooted ? "boot-loader--fade-out" : ""}`}>
          <div className="boot-loader__terminal">
            <p className="boot-loader__brand">{appMetadata.name} v{appMetadata.version}</p>
            {updateStatus ? (
              <p className="boot-loader__line">
                <span className="boot-loader__bracket">[</span>
                <span className="boot-loader__status">UPDATE</span>
                <span className="boot-loader__bracket">]</span> {updateStatus}
                <span className="boot-loader__cursor">_</span>
              </p>
            ) : (
              <>
                <p className="boot-loader__line">
                  <span className="boot-loader__bracket">[</span>
                  <span className="boot-loader__status">WAIT</span>
                  <span className="boot-loader__bracket">]</span> {bootError ?? `Waking up daemon${dots}`}
                </p>
                <p className="boot-loader__line">
                  <span className="boot-loader__bracket">[</span>
                  <span className="boot-loader__status">INFO</span>
                  <span className="boot-loader__bracket">]</span> Establishing connection
                  <span className="boot-loader__cursor">_</span>
                </p>
              </>
            )}
          </div>
        </div>
      )}
      {bootstrapState === "setup" ? <DatabaseSetup /> : null}
      {bootstrapState === "repair" ? <DatabaseRepair /> : null}
      {isBooted && children}
    </>
  );
}
