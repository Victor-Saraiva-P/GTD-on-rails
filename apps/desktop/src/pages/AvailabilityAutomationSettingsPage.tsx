import type { ReactNode } from "react";
import { ListView } from "../components/ListView";
import { ListWorkspace } from "../components/ListWorkspace";
import type { ContextItem } from "../features/contexts/types";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { availabilityAutomationTheme } from "../features/lists/listThemes";
import {
  useAvailabilityAutomationSettingsController,
  type AvailabilityAutomationSettingsController
} from "../features/availability-automation/useAvailabilityAutomationSettingsController";

/** Renders machine-local mappings from detected environment signals to GTD contexts.
 *
 * @example <AvailabilityAutomationSettingsPage />
 */
export function AvailabilityAutomationSettingsPage() {
  const controller = useAvailabilityAutomationSettingsController();
  useAvailabilityAutomationKeybinds(controller);
  return (
    <ListWorkspace theme={availabilityAutomationTheme} currentLabel={availabilityAutomationTheme.label}>
      <section className="stuff-detail-layout" aria-label="Availability Automation">
        <ListView title="Availability Automation" meta="" viewIndex={1} active className="inbox-pane inbox-pane--list">
          <AvailabilityAutomationPanel controller={controller} />
        </ListView>
      </section>
      <LeaderMenu />
    </ListWorkspace>
  );
}

function AvailabilityAutomationPanel({ controller }: Readonly<{ controller: AvailabilityAutomationSettingsController }>) {
  return (
    <div className="pane-state" style={panelStyle}>
      <header style={headerStyle}>
        <div>
          <h2 style={titleStyle}>Automatic contexts</h2>
          <p style={mutedStyle}>Map this device and each physical NetworkManager connection to contexts used by Current Availability.</p>
        </div>
        {controller.error && <span style={errorStyle}>{controller.error}</span>}
      </header>
      <SignalMappings controller={controller} />
      <SettingsFooter controller={controller} />
    </div>
  );
}

function SignalMappings({ controller }: Readonly<{ controller: AvailabilityAutomationSettingsController }>) {
  if (controller.contextsLoading) return <p style={mutedStyle}>Loading contexts...</p>;
  if (!controller.signals) return <p style={mutedStyle}>Detecting current environment...</p>;
  return (
    <div style={mappingGridStyle}>
      <MappingCard title="Device" detail={`${controller.signals.device.label} · ${deviceTypeLabel(controller.signals.device.deviceType)}`}>
        <ContextSelect contexts={controller.contexts} value={controller.settings.deviceContextId} onChange={controller.setDeviceContextId} />
      </MappingCard>
      <LocationMappings controller={controller} />
    </div>
  );
}

function LocationMappings({ controller }: Readonly<{ controller: AvailabilityAutomationSettingsController }>) {
  const locations = controller.signals?.locations ?? [];
  if (locations.length === 0) {
    return <MappingCard title="Location" detail="No active Wi-Fi or Ethernet connection detected."><span style={mutedStyle}>Nothing to map.</span></MappingCard>;
  }
  return <>{locations.map((location) => (
    <MappingCard key={location.id} title="Location" detail={`${location.label} · ${location.connectionType}`}>
      <ContextSelect
        contexts={controller.contexts}
        value={controller.settings.locationContextIds[location.id] ?? null}
        onChange={(contextId) => controller.setLocationContextId(location.id, contextId)}
      />
    </MappingCard>
  ))}</>;
}

function MappingCard({ title, detail, children }: Readonly<{ title: string; detail: string; children: ReactNode }>) {
  return (
    <section style={cardStyle}>
      <div style={cardHeaderStyle}>
        <strong style={labelStyle}>{title}</strong>
        <span style={signalDetailStyle}>{detail}</span>
      </div>
      {children}
    </section>
  );
}

function ContextSelect({ contexts, value, onChange }: Readonly<{ contexts: ContextItem[]; value: string | null; onChange: (contextId: string | null) => void }>) {
  const knownValue = value == null || contexts.some((context) => context.id === value);
  return (
    <select
      aria-label="Mapped context"
      style={controlStyle}
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
      onKeyDown={stopKeyPropagation}
    >
      <option value="">No automatic context</option>
      {!knownValue && value ? <option value={value}>Unavailable context ({value})</option> : null}
      {contexts.map((context) => <option key={context.id} value={context.id}>{context.name}</option>)}
    </select>
  );
}

function SettingsFooter({ controller }: Readonly<{ controller: AvailabilityAutomationSettingsController }>) {
  return (
    <footer style={footerStyle}>
      <button type="button" style={saveButtonStyle} onClick={controller.save}>Save settings</button>
      <button type="button" style={secondaryButtonStyle} onClick={() => void controller.refresh()}>Refresh detected environment</button>
      {controller.saved && <span style={savedStyle}>Saved</span>}
      <span style={shortcutStyle}>s save · r refresh · Esc back to Next Actions</span>
    </footer>
  );
}

function deviceTypeLabel(value: string): string {
  if (value === "notebook") return "Notebook";
  if (value === "desktop") return "Desktop";
  return "Computer";
}

function useAvailabilityAutomationKeybinds(controller: AvailabilityAutomationSettingsController) {
  const { setActiveScreen } = useActiveScreen();
  useKeybindScreen("availability-automation-settings");
  useRegisterKeybinds([
    { id: "availability-automation.back", key: "Escape", description: "Go back to Next Actions", screen: "availability-automation-settings", runKeybind: () => setActiveScreen("next-actions") },
    { id: "availability-automation.save", key: "s", description: "Save automatic context mappings", screen: "availability-automation-settings", runKeybind: controller.save },
    { id: "availability-automation.refresh", key: "r", description: "Refresh detected environment", screen: "availability-automation-settings", runKeybind: () => void controller.refresh() }
  ]);
}

function stopKeyPropagation(event: React.KeyboardEvent) {
  event.stopPropagation();
}

const panelStyle = { textAlign: "left", padding: "1rem", height: "100%", overflowY: "auto", display: "block" } as const;
const headerStyle = { display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "1.5rem", alignItems: "flex-start" } as const;
const titleStyle = { fontSize: "1.2rem", fontWeight: "bold", margin: 0, color: "var(--color-primary-text)" } as const;
const mutedStyle = { color: "var(--color-muted-text)", marginTop: "0.4rem", maxWidth: "58rem" } as const;
const errorStyle = { color: "var(--color-critical)", maxWidth: "32rem", textAlign: "right" } as const;
const mappingGridStyle = { display: "grid", gap: "0.8rem", width: "100%", maxWidth: "60rem" } as const;
const cardStyle = { padding: "1rem", border: "1px solid var(--color-border)", background: "var(--color-app-surface)", borderRadius: "4px" } as const;
const cardHeaderStyle = { display: "grid", gridTemplateColumns: "8rem minmax(0, 1fr)", gap: "1rem", marginBottom: "0.8rem", alignItems: "center" } as const;
const labelStyle = { color: "var(--color-primary-text)" } as const;
const signalDetailStyle = { color: "var(--color-muted-text)" } as const;
const controlStyle = { width: "100%", boxSizing: "border-box", padding: "0.5rem", background: "var(--color-workspace-bg)", color: "var(--color-primary-text)", border: "1px solid var(--color-border)" } as const;
const footerStyle = { display: "flex", gap: "0.6rem", alignItems: "center", marginTop: "1.2rem", flexWrap: "wrap" } as const;
const saveButtonStyle = { padding: "0.5rem 0.8rem", background: "var(--color-accent)", color: "var(--color-accent-text)", border: "none", cursor: "pointer" } as const;
const secondaryButtonStyle = { padding: "0.5rem 0.8rem", background: "transparent", color: "var(--color-primary-text)", border: "1px solid var(--color-border)", cursor: "pointer" } as const;
const savedStyle = { color: "var(--color-done)" } as const;
const shortcutStyle = { color: "var(--color-muted-text)", marginLeft: "auto", fontSize: "0.82rem" } as const;
