import React from "react";
import ReactDOM from "react-dom/client";
import { KeybindProvider } from "./features/keybinds/KeybindProvider";
import { InboxPage } from "./pages/InboxPage";
import "./styles.css";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("App root not found");
}

ReactDOM.createRoot(app).render(
  <React.StrictMode>
    <KeybindProvider>
      <InboxPage />
    </KeybindProvider>
  </React.StrictMode>
);
