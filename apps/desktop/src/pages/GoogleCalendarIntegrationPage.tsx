import { type Dispatch, type SetStateAction, useState } from "react";
import { ListView } from "../components/ListView";
import { ListWorkspace } from "../components/ListWorkspace";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import { googleCalendarIntegrationTheme } from "../features/lists/listThemes";
import type { GoogleCalendarIntegrationController } from "../features/integrations/useGoogleCalendarIntegrationController";
import { saveGoogleCredentials } from "../features/integrations/googleCalendarApi";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { ApiRequestError } from "../lib/api/apiClient";

type Props = Readonly<{
  controller: GoogleCalendarIntegrationController;
}>;

type CredentialsFormProps = Readonly<{
  credentialsConfigured: boolean;
  initialClientId: string;
  initialClientSecret: string;
  isOpen: boolean;
  onSave: (clientId: string, clientSecret: string) => Promise<void>;
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}>;

type KeybindsProps = Readonly<{
  controller: GoogleCalendarIntegrationController;
  isFormOpen: boolean;
  setIsFormOpen: Dispatch<SetStateAction<boolean>>;
}>;

type IntegrationPanelProps = Props & KeybindsProps;

/**
 * Renders the Google Calendar integration setup, connection, and mirror calendar status screen.
 *
 * @param controller The Google Calendar integration controller state and actions.
 * @example <GoogleCalendarIntegrationPage controller={controllers.googleCalendarIntegration} />
 */
export function GoogleCalendarIntegrationPage({ controller }: Props) {
  const [isFormOpen, setIsFormOpen] = useState(false);
  useGoogleCalendarKeybinds({ controller, isFormOpen, setIsFormOpen });

  return (
    <ListWorkspace theme={googleCalendarIntegrationTheme} currentLabel={googleCalendarIntegrationTheme.label}>
      <section className="inbox-terminal-layout" aria-label="Integration">
        <ListView title="Integration Status" meta="" viewIndex={1} active={true} className="inbox-pane inbox-pane--list">
          <IntegrationPanel controller={controller} isFormOpen={isFormOpen} setIsFormOpen={setIsFormOpen} />
        </ListView>
      </section>
      <LeaderMenu />
    </ListWorkspace>
  );
}

function IntegrationPanel({ controller, isFormOpen, setIsFormOpen }: IntegrationPanelProps) {
  return (
    <div className="pane-state" style={panelStyle}>
      {controller.error && <div style={errorBannerStyle}>{controller.error}</div>}
      <CredentialsForm
        credentialsConfigured={Boolean(controller.status?.credentialsConfigured)}
        initialClientId=""
        initialClientSecret=""
        isOpen={isFormOpen}
        onSave={async (clientId, clientSecret) => saveCredentials(clientId, clientSecret, controller)}
        setIsOpen={setIsFormOpen}
      />
      <ConnectionStatus controller={controller} />
      <CalendarsList controller={controller} />
    </div>
  );
}

function CredentialsForm(props: CredentialsFormProps) {
  const [clientId, setClientId] = useState(props.initialClientId);
  const [clientSecret, setClientSecret] = useState(props.initialClientSecret);
  const [formError, setFormError] = useState<string | null>(null);
  const closeForm = () => props.setIsOpen(false);
  const submitForm = async () => saveCredentialForm(clientId, clientSecret, props.onSave, closeForm, setFormError);

  return (
    <div style={sectionStyle}>
      <CredentialsSummary credentialsConfigured={props.credentialsConfigured} />
      {props.isOpen && <CredentialInputs clientId={clientId} clientSecret={clientSecret} formError={formError} setClientId={setClientId} setClientSecret={setClientSecret} submitForm={submitForm} closeForm={closeForm} />}
    </div>
  );
}

function CredentialsSummary({ credentialsConfigured }: Readonly<{ credentialsConfigured: boolean }>) {
  return (
    <>
      <h2 style={headingStyle}>Client Credentials</h2>
      <p>{credentialsConfigured ? <span style={doneStyle}>Configured</span> : <span style={mutedStyle}>Not configured (Press 's' to configure)</span>}</p>
      <p style={tokenHelpStyle}>Google Calendar tokens are encrypted locally. The Token Encryption Key is generated automatically and must sync before connecting.</p>
    </>
  );
}

function CredentialInputs(props: CredentialInputsProps) {
  return (
    <div style={formStyle}>
      <h3 style={formHeadingStyle}>Setup Credentials</h3>
      {props.formError && <p style={formErrorStyle}>{props.formError}</p>}
      <div style={fieldsStyle}>
        <CredentialInput autoFocus placeholder="Client ID" value={props.clientId} onChange={props.setClientId} submitForm={props.submitForm} closeForm={props.closeForm} />
        <CredentialInput placeholder="Client Secret" value={props.clientSecret} onChange={props.setClientSecret} submitForm={props.submitForm} closeForm={props.closeForm} />
        <button onClick={props.submitForm} style={saveButtonStyle}>Save</button>
      </div>
    </div>
  );
}

type CredentialInputsProps = Readonly<{
  clientId: string;
  clientSecret: string;
  closeForm: () => void;
  formError: string | null;
  setClientId: (value: string) => void;
  setClientSecret: (value: string) => void;
  submitForm: () => Promise<void>;
}>;

function CredentialInput(props: CredentialInputProps) {
  return <input autoFocus={props.autoFocus} style={inputStyle} placeholder={props.placeholder} value={props.value} onChange={e => props.onChange(e.target.value)} onKeyDown={e => handleCredentialKey(e, props.submitForm, props.closeForm)} />;
}

type CredentialInputProps = Readonly<{
  autoFocus?: boolean;
  closeForm: () => void;
  onChange: (value: string) => void;
  placeholder: string;
  submitForm: () => Promise<void>;
  value: string;
}>;

function ConnectionStatus({ controller }: Props) {
  const canConnect = controller.status?.configurationStatus === "READY";
  const reason = controller.status?.configurationMessage ?? "Loading Google Calendar configuration.";
  return (
    <div style={sectionStyle}>
      <h2 style={headingStyle}>Connection Status</h2>
      <p>{controller.status?.connected ? <span style={doneStyle}>Connected</span> : <span style={mutedStyle}>{canConnect ? "Disconnected (Press 'c' to connect)" : `Disconnected (${reason})`}</span>}</p>
      <button disabled={!canConnect} onClick={controller.connect} style={{ ...connectButtonStyle, opacity: canConnect ? 1 : 0.5 }}>Connect to Google Calendar</button>
    </div>
  );
}

function CalendarsList({ controller }: Props) {
  return (
    <div>
      <h2 style={headingStyle}>Calendars</h2>
      {controller.status?.calendars.length === 0 && <p style={mutedStyle}>No calendars created yet.</p>}
      <ul style={calendarsListStyle}>{controller.status?.calendars.map(cal => <CalendarRow key={cal.googleCalendarId} colorHex={cal.colorHex} name={cal.name} />)}</ul>
    </div>
  );
}

function CalendarRow({ colorHex, name }: Readonly<{ colorHex: string; name: string }>) {
  return (
    <li style={calendarRowStyle}>
      <div style={{ ...calendarColorStyle, backgroundColor: colorHex }}></div>
      <span style={primaryTextStyle}>{name}</span>
    </li>
  );
}

function useGoogleCalendarKeybinds({ controller, isFormOpen, setIsFormOpen }: KeybindsProps) {
  const { setActiveScreen } = useActiveScreen();
  const canConnect = controller.status?.configurationStatus === "READY";
  const reason = controller.status?.configurationMessage ?? "Loading Google Calendar configuration.";
  useKeybindScreen("google-calendar-integration");
  useRegisterKeybinds([
    googleCalendarBackKeybind(isFormOpen, setIsFormOpen, setActiveScreen),
    googleCalendarSetupKeybind(isFormOpen, setIsFormOpen),
    googleCalendarConnectKeybind(controller, isFormOpen, canConnect, reason)
  ]);
}

function googleCalendarBackKeybind(isFormOpen: boolean, setIsFormOpen: Dispatch<SetStateAction<boolean>>, setActiveScreen: (screen: "inbox") => void) {
  return { id: "gcal.go-back", key: "Escape", description: "Go back", screen: "google-calendar-integration" as const, runKeybind: () => isFormOpen ? setIsFormOpen(false) : setActiveScreen("inbox") };
}

function googleCalendarSetupKeybind(isFormOpen: boolean, setIsFormOpen: Dispatch<SetStateAction<boolean>>) {
  return { id: "gcal.setup-credentials", key: "s", description: "Setup Credentials", screen: "google-calendar-integration" as const, runKeybind: () => { if (!isFormOpen) setIsFormOpen(true); } };
}

function googleCalendarConnectKeybind(controller: GoogleCalendarIntegrationController, isFormOpen: boolean, canConnect: boolean, reason: string) {
  return { id: "gcal.connect", key: "c", description: "Connect to Google Calendar", screen: "google-calendar-integration" as const, runKeybind: () => connectFromKeybind(controller, isFormOpen, canConnect, reason) };
}

function connectFromKeybind(controller: GoogleCalendarIntegrationController, isFormOpen: boolean, canConnect: boolean, reason: string) {
  if (!isFormOpen && canConnect) {
    controller.connect();
    return;
  }
  controller.setError(reason);
}

async function saveCredentials(clientId: string, clientSecret: string, controller: GoogleCalendarIntegrationController) {
  await saveGoogleCredentials(clientId, clientSecret);
  controller.reload();
}

async function saveCredentialForm(clientId: string, clientSecret: string, onSave: CredentialsFormProps["onSave"], closeForm: () => void, setFormError: (error: string | null) => void) {
  try {
    await onSave(clientId, clientSecret);
    setFormError(null);
    closeForm();
  } catch (e: unknown) {
    setFormError(formErrorMessageFrom(e));
  }
}

function formErrorMessageFrom(error: unknown): string {
  if (error instanceof ApiRequestError && error.status === 503) return "Google Calendar configuration could not be synced; fix persistence sync and try again before connecting.";
  return errorMessageFrom(error);
}

function errorMessageFrom(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) return String((error as { message?: unknown }).message) || "Failed to save credentials.";
  return String(error) || "Failed to save credentials.";
}

function handleCredentialKey(event: React.KeyboardEvent<HTMLInputElement>, submitForm: () => Promise<void>, closeForm: () => void) {
  event.stopPropagation();
  if (event.key === "Enter") submitForm();
  if (event.key === "Escape") closeForm();
}

const panelStyle = { textAlign: "left", padding: "1rem", height: "100%", overflowY: "auto", display: "block" } as const;
const errorBannerStyle = { color: "var(--color-critical)", marginBottom: "1rem" } as const;
const sectionStyle = { marginBottom: "2rem" } as const;
const headingStyle = { fontSize: "1.2rem", fontWeight: "bold", marginBottom: "0.5rem", color: "var(--color-primary-text)" } as const;
const doneStyle = { color: "var(--color-done)" } as const;
const mutedStyle = { color: "var(--color-muted-text)" } as const;
const tokenHelpStyle = { color: "var(--color-muted-text)", marginTop: "0.5rem" } as const;
const formStyle = { marginTop: "1rem", padding: "1rem", background: "var(--color-app-surface)", border: "1px solid var(--color-border)", borderRadius: "4px" } as const;
const formHeadingStyle = { fontWeight: "bold", marginBottom: "0.5rem" } as const;
const formErrorStyle = { color: "var(--color-critical)", marginBottom: "0.5rem" } as const;
const fieldsStyle = { display: "flex", flexDirection: "column", gap: "0.5rem" } as const;
const inputStyle = { padding: "0.5rem", background: "var(--color-workspace-bg)", color: "var(--color-primary-text)", border: "1px solid var(--color-border)" } as const;
const saveButtonStyle = { padding: "0.5rem", background: "var(--color-accent)", color: "var(--color-accent-text)", marginTop: "0.5rem", border: "none", cursor: "pointer" } as const;
const connectButtonStyle = { padding: "0.5rem", marginTop: "0.75rem" } as const;
const calendarsListStyle = { listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.5rem" } as const;
const calendarRowStyle = { display: "flex", alignItems: "center", gap: "0.5rem" } as const;
const calendarColorStyle = { width: "12px", height: "12px", borderRadius: "50%" } as const;
const primaryTextStyle = { color: "var(--color-primary-text)" } as const;
