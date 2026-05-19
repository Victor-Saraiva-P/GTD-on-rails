import React from "react";
import ReactDOM from "react-dom/client";
import { KeybindProvider } from "./features/keybinds/KeybindProvider";
import { SyncStatusProvider } from "./features/sync-status/SyncStatusProvider";
import { ConnectivityBlocker } from "./features/connectivity/ConnectivityBlocker";
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
      <BootLoader>
        <SyncStatusProvider>
          <ConnectivityBlocker>
            <AppShell />
          </ConnectivityBlocker>
        </SyncStatusProvider>
      </BootLoader>
    </KeybindProvider>
  </React.StrictMode>
);
