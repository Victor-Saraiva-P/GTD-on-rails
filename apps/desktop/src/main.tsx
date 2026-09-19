import React from "react";
import ReactDOM from "react-dom/client";
import { KeybindProvider } from "./features/keybinds/KeybindProvider";
import { SyncStatusProvider } from "./features/sync-status/SyncStatusProvider";
import { ConnectivityBlocker } from "./features/connectivity/ConnectivityBlocker";
import { DatabaseReadinessBlocker } from "./features/database-readiness/DatabaseReadinessBlocker";
import { DatabaseReadinessProvider } from "./features/database-readiness/DatabaseReadinessProvider";
import { ZenModeProvider } from "./features/zen-mode/ZenModeContext";
import { BootLoader } from "./components/BootLoader";
import { AppShell } from "./pages/AppShell";
import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root selector '#app' matched value 'null'; expected an HTMLDivElement mount node.");
}

ReactDOM.createRoot(app).render(
  <React.StrictMode>
    <KeybindProvider>
      <ZenModeProvider>
        <BootLoader>
          <DatabaseReadinessProvider>
            <SyncStatusProvider>
              <ConnectivityBlocker>
                <DatabaseReadinessBlocker><AppShell /></DatabaseReadinessBlocker>
              </ConnectivityBlocker>
            </SyncStatusProvider>
          </DatabaseReadinessProvider>
        </BootLoader>
      </ZenModeProvider>
    </KeybindProvider>
  </React.StrictMode>
);
