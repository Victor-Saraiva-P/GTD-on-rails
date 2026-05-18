import { useEffect, useState, type PropsWithChildren } from "react";
import { invoke } from "@tauri-apps/api/core";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { setRuntimeApiBaseUrl } from "../config/env.ts";
import { apiJson } from "../lib/api/apiClient.ts";
import { isTauriRuntime } from "../lib/tauriRuntime.ts";
import "../styles/boot-loader.css";

const PING_INTERVAL_MS = 1000;
const SIDECAR_STATUS_INTERVAL_MS = 250;

type SidecarBackendStatus = {
  enabled: boolean;
  baseUrl: string | null;
  error: string | null;
};

async function pingBackend(): Promise<boolean> {
  try {
    await apiJson("/sync/status");
    return true;
  } catch {
    return false;
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

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function useBackendHealth() {
  const [isBooted, setIsBooted] = useState(false);
  const [dots, setDots] = useState("");
  const [bootError, setBootError] = useState<string | null>(null);
  const [updateStatus, setUpdateStatus] = useState<string | null>(null);

  useEffect(() => {
    let timeout: number;

    const checkHealth = async () => {
      if (isTauriRuntime()) {
        try {
          const update = await check();
          if (update) {
            setUpdateStatus(`Downloading update ${update.version}...`);
            await update.downloadAndInstall();
            setUpdateStatus("Restarting...");
            await relaunch();
            return; // Stop boot process, wait for restart
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
      const isOnline = await pingBackend();
      if (isOnline) {
        setIsBooted(true);
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

  return { isBooted, dots, bootError, updateStatus };
}

/**
 * Global boot loader that polls the backend until it comes online.
 * Renders a retro terminal loading screen while waiting.
 */
export function BootLoader({ children }: PropsWithChildren) {
  const { isBooted, dots, bootError, updateStatus } = useBackendHealth();
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
      {shouldRenderLoader && (
        <div className={`boot-loader ${isBooted ? "boot-loader--fade-out" : ""}`}>
          <div className="boot-loader__terminal">
            <p className="boot-loader__brand">GTD ON RAILS v0.1.0</p>
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
      {isBooted && children}
    </>
  );
}
