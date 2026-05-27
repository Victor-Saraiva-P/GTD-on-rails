import { useState } from "react";
import { ListView } from "../components/ListView";
import { ListWorkspace } from "../components/ListWorkspace";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import { googleCalendarIntegrationTheme } from "../features/lists/listThemes";
import type { GoogleCalendarIntegrationController } from "../features/integrations/useGoogleCalendarIntegrationController";
import { saveGoogleCredentials } from "../features/integrations/googleCalendarApi";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";

type Props = {
  controller: GoogleCalendarIntegrationController;
};

export function GoogleCalendarIntegrationPage({ controller }: Props) {
  const { setActiveScreen } = useActiveScreen();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const closeForm = () => setIsFormOpen(false);

  const submitForm = async () => {
    try {
      await saveGoogleCredentials(clientId, clientSecret);
      setFormError(null);
      closeForm();
      controller.reload();
    } catch (e: any) {
      setFormError("Failed to save credentials.");
    }
  };

  useKeybindScreen("google-calendar-integration");
  useRegisterKeybinds([
    {
      id: "gcal.go-back",
      key: "Escape",
      description: "Go back",
      screen: "google-calendar-integration",
      runKeybind: () => {
        if (isFormOpen) {
          closeForm();
        } else {
          setActiveScreen("inbox");
        }
      }
    },
    {
      id: "gcal.setup-credentials",
      key: "s",
      description: "Setup Credentials",
      screen: "google-calendar-integration",
      runKeybind: () => {
        if (!isFormOpen) setIsFormOpen(true);
      }
    },
    {
      id: "gcal.connect",
      key: "c",
      description: "Connect to Google Calendar",
      screen: "google-calendar-integration",
      runKeybind: () => {
        if (!isFormOpen && controller.status?.credentialsConfigured) {
          controller.connect();
        } else if (!controller.status?.credentialsConfigured) {
          controller.setError("Configure credentials first.");
        }
      }
    }
  ]);

  return (
    <ListWorkspace theme={googleCalendarIntegrationTheme} currentLabel={googleCalendarIntegrationTheme.label}>
      <section className="inbox-terminal-layout" aria-label="Integration">
        <ListView title="Integration Status" meta="" viewIndex={1} active={true} className="inbox-pane inbox-pane--list">
          <div className="pane-state" style={{ textAlign: "left", padding: "1rem", height: "100%", overflowY: "auto", display: "block" }}>
            {controller.error && (
              <div style={{ color: "var(--color-critical)", marginBottom: "1rem" }}>
                {controller.error}
              </div>
            )}

            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "0.5rem", color: "var(--color-primary-text)" }}>Client Credentials</h2>
              <p>
                {controller.status?.credentialsConfigured 
                  ? <span style={{ color: "var(--color-done)" }}>Configured</span> 
                  : <span style={{ color: "var(--color-muted-text)" }}>Not configured (Press 's' to configure)</span>}
              </p>
              
              {isFormOpen && (
                <div style={{ marginTop: "1rem", padding: "1rem", background: "var(--color-app-surface)", border: "1px solid var(--color-border)", borderRadius: "4px" }}>
                  <h3 style={{ fontWeight: "bold", marginBottom: "0.5rem" }}>Setup Credentials</h3>
                  {formError && <p style={{ color: "var(--color-critical)", marginBottom: "0.5rem" }}>{formError}</p>}
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    <input 
                      autoFocus
                      style={{ padding: "0.5rem", background: "var(--color-workspace-bg)", color: "var(--color-primary-text)", border: "1px solid var(--color-border)" }}
                      placeholder="Client ID" 
                      value={clientId} 
                      onChange={e => setClientId(e.target.value)}
                      onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") submitForm(); if (e.key === "Escape") closeForm(); }}
                    />
                    <input 
                      style={{ padding: "0.5rem", background: "var(--color-workspace-bg)", color: "var(--color-primary-text)", border: "1px solid var(--color-border)" }}
                      placeholder="Client Secret" 
                      value={clientSecret} 
                      onChange={e => setClientSecret(e.target.value)}
                      onKeyDown={e => { e.stopPropagation(); if (e.key === "Enter") submitForm(); if (e.key === "Escape") closeForm(); }}
                    />
                    <button onClick={submitForm} style={{ padding: "0.5rem", background: "var(--color-accent)", color: "var(--color-accent-text)", marginTop: "0.5rem", border: "none", cursor: "pointer" }}>Save</button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: "2rem" }}>
              <h2 style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "0.5rem", color: "var(--color-primary-text)" }}>Connection Status</h2>
              <p>
                {controller.status?.connected 
                  ? <span style={{ color: "var(--color-done)" }}>Connected</span> 
                  : <span style={{ color: "var(--color-muted-text)" }}>Disconnected (Press 'c' to connect)</span>}
              </p>
            </div>

            <div>
              <h2 style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "0.5rem", color: "var(--color-primary-text)" }}>Calendars</h2>
              {controller.status?.calendars.length === 0 && <p style={{ color: "var(--color-muted-text)" }}>No calendars created yet.</p>}
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                {controller.status?.calendars.map(cal => (
                  <li key={cal.googleCalendarId} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: cal.colorHex }}></div>
                    <span style={{ color: "var(--color-primary-text)" }}>{cal.name}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </ListView>
      </section>
      <LeaderMenu />
    </ListWorkspace>
  );
}
