import React from "react";
import ReactDOM from "react-dom/client";
import { KeybindProvider } from "./features/keybinds/KeybindProvider";
import { SyncStatusProvider } from "./features/sync-status/SyncStatusProvider";
import { AppShell } from "./pages/AppShell";
import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

ReactDOM.createRoot(app).render(
  <React.StrictMode>
    <KeybindProvider>
      <SyncStatusProvider>
        <AppShell />
      </SyncStatusProvider>
    </KeybindProvider>
  </React.StrictMode>
);
