import type { ReactNode } from "react";
import { ListView } from "../components/ListView";
import { ListWorkspace } from "../components/ListWorkspace";
import { useAgentProcessingController, type AgentProcessingController } from "../features/agent-processing/useAgentProcessingController";
import type { AgentModelOption, AgentProviderOptions, ProcessingAgent } from "../features/agent-processing/types";
import { useActiveScreen, useKeybindScreen, useRegisterKeybinds } from "../features/keybinds/hooks";
import { LeaderMenu } from "../features/keybinds/LeaderMenu";
import { agentProcessingTheme } from "../features/lists/listThemes";

/** Renders machine-local settings for headless GTD processing agents.
 *
 * @example <AgentProcessingSettingsPage />
 */
export function AgentProcessingSettingsPage() {
  const controller = useAgentProcessingController();
  useAgentProcessingKeybinds(controller);
  return (
    <ListWorkspace theme={agentProcessingTheme} currentLabel={agentProcessingTheme.label}>
      <section className="stuff-detail-layout" aria-label="Agent Processing">
        <ListView title="Agent Processing" meta="" viewIndex={1} active className="inbox-pane inbox-pane--list">
          <AgentProcessingPanel controller={controller} />
        </ListView>
      </section>
      <LeaderMenu />
    </ListWorkspace>
  );
}

function AgentProcessingPanel({ controller }: Readonly<{ controller: AgentProcessingController }>) {
  if (controller.loading) return <div className="pane-state" style={panelStyle}>Loading agent settings...</div>;
  return (
    <div className="pane-state" style={panelStyle}>
      <Header controller={controller} />
      <ProcessorField controller={controller} />
      <div style={providersGridStyle}>
        <ProviderSection provider="antigravity" title="Antigravity" controller={controller} />
        <ProviderSection provider="codex" title="Codex" controller={controller} />
      </div>
      <Footer controller={controller} />
    </div>
  );
}

function Header({ controller }: Readonly<{ controller: AgentProcessingController }>) {
  return (
    <div style={headerStyle}>
      <div>
        <h2 style={titleStyle}>Headless Processing</h2>
        <p style={mutedStyle}>Choose which local agent processes GTD stuff and the model/thinking settings passed to that harness.</p>
      </div>
      {controller.error && <span style={errorStyle}>{controller.error}</span>}
    </div>
  );
}

function ProcessorField({ controller }: Readonly<{ controller: AgentProcessingController }>) {
  return (
    <Field label="Processing agent" help="The selected harness will be used when GTD starts an agent processing run.">
      <select style={controlStyle} value={controller.settings.processor} onChange={event => controller.updateProcessor(event.target.value as ProcessingAgent)} onKeyDown={stopKeyPropagation}>
        <option value="antigravity">Antigravity</option>
        <option value="codex">Codex</option>
      </select>
    </Field>
  );
}

function ProviderSection({ provider, title, controller }: Readonly<{ provider: ProcessingAgent; title: string; controller: AgentProcessingController }>) {
  const settings = controller.settings[provider];
  const options = controller.options[provider];
  const thinking = thinkingOptions(settings.model, options);
  return (
    <section style={cardStyle} aria-label={`${title} settings`}>
      <ProviderHeader title={title} active={controller.settings.processor === provider} available={options.available} />
      <Field label="Model" help="Choose CLI default to let the harness select its configured model.">
        <ModelSelect value={settings.model ?? ""} options={options.models} onChange={value => controller.updateProvider(provider, "model", value)} />
      </Field>
      <Field label="Thinking" help="Leave on CLI default to use the harness default reasoning effort.">
        <ThinkingSelect value={settings.thinking ?? ""} options={thinking} onChange={value => controller.updateProvider(provider, "thinking", value)} />
      </Field>
    </section>
  );
}

function ProviderHeader({ title, active, available }: Readonly<{ title: string; active: boolean; available: boolean }>) {
  return (
    <div style={providerHeaderStyle}>
      <h3 style={providerTitleStyle}>{title}</h3>
      <div style={badgeRowStyle}>
        {active && <span style={activeBadgeStyle}>Selected</span>}
        <span style={available ? availableBadgeStyle : missingBadgeStyle}>{available ? "CLI available" : "CLI not detected"}</span>
      </div>
    </div>
  );
}

function ModelSelect(props: Readonly<{ value: string; options: AgentModelOption[]; onChange: (value: string) => void }>) {
  const known = props.options.some(option => option.id === props.value);
  return (
    <select style={controlStyle} value={props.value} onChange={event => props.onChange(event.target.value)} onKeyDown={stopKeyPropagation}>
      <option value="">CLI default</option>
      {!known && props.value && <option value={props.value}>{props.value}</option>}
      {props.options.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
    </select>
  );
}

function ThinkingSelect(props: Readonly<{ value: string; options: string[]; onChange: (value: string) => void }>) {
  return (
    <select style={controlStyle} value={props.value} onChange={event => props.onChange(event.target.value)} onKeyDown={stopKeyPropagation}>
      <option value="">CLI default</option>
      {props.options.map(option => <option key={option} value={option}>{thinkingLabel(option)}</option>)}
    </select>
  );
}

function Field({ label, help, children }: Readonly<{ label: string; help: string; children: ReactNode }>) {
  return (
    <label style={fieldStyle}>
      <span style={labelStyle}>{label}</span>
      {children}
      <span style={helpStyle}>{help}</span>
    </label>
  );
}

function Footer({ controller }: Readonly<{ controller: AgentProcessingController }>) {
  return (
    <div style={footerStyle}>
      <button type="button" style={saveButtonStyle} disabled={controller.saving} onClick={() => void controller.save()}>{controller.saving ? "Saving..." : "Save settings"}</button>
      <button type="button" style={secondaryButtonStyle} disabled={controller.refreshing} onClick={() => void controller.refreshOptions()}>{controller.refreshing ? "Refreshing models..." : "Refresh detected models"}</button>
      {controller.saved && <span style={savedStyle}>Saved</span>}
      <span style={shortcutStyle}>s save · r reload · Esc back</span>
    </div>
  );
}

function thinkingOptions(model: string | null, options: AgentProviderOptions): string[] {
  const selected = options.models.find(option => option.id === model);
  return selected?.thinking.length ? selected.thinking : options.thinking;
}

function thinkingLabel(value: string): string {
  if (value === "xhigh") return "Extra High";
  if (value === "max") return "Max";
  if (value === "ultra") return "Ultra";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function useAgentProcessingKeybinds(controller: AgentProcessingController) {
  const { setActiveScreen } = useActiveScreen();
  useKeybindScreen("agent-processing-settings");
  useRegisterKeybinds([
    { id: "agent-processing.back", key: "Escape", description: "Go back", screen: "agent-processing-settings", runKeybind: () => setActiveScreen("inbox") },
    { id: "agent-processing.save", key: "s", description: "Save agent processing settings", screen: "agent-processing-settings", runKeybind: () => void controller.save() },
    { id: "agent-processing.reload", key: "r", description: "Refresh detected agent models", screen: "agent-processing-settings", runKeybind: () => void controller.refreshOptions() }
  ]);
}

function stopKeyPropagation(event: React.KeyboardEvent) {
  event.stopPropagation();
}

const panelStyle = { textAlign: "left", padding: "1rem", height: "100%", overflowY: "auto", display: "block" } as const;
const headerStyle = { display: "flex", justifyContent: "space-between", gap: "1rem", marginBottom: "1.5rem", alignItems: "flex-start" } as const;
const titleStyle = { fontSize: "1.2rem", fontWeight: "bold", margin: 0, color: "var(--color-primary-text)" } as const;
const mutedStyle = { color: "var(--color-muted-text)", marginTop: "0.4rem", maxWidth: "54rem" } as const;
const errorStyle = { color: "var(--color-critical)", maxWidth: "28rem", textAlign: "right" } as const;
const providersGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(22rem, 1fr))", gap: "1rem", width: "100%" } as const;
const cardStyle = { padding: "1rem", marginTop: "1rem", border: "1px solid var(--color-border)", background: "var(--color-app-surface)", borderRadius: "4px", minWidth: 0 } as const;
const providerHeaderStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", marginBottom: "1rem" } as const;
const providerTitleStyle = { margin: 0, fontSize: "1.05rem", color: "var(--color-primary-text)" } as const;
const badgeRowStyle = { display: "flex", gap: "0.4rem", flexWrap: "wrap" } as const;
const badgeBaseStyle = { padding: "0.15rem 0.45rem", border: "1px solid var(--color-border)", fontSize: "0.78rem" } as const;
const activeBadgeStyle = { ...badgeBaseStyle, color: "var(--color-accent)" } as const;
const availableBadgeStyle = { ...badgeBaseStyle, color: "var(--color-done)" } as const;
const missingBadgeStyle = { ...badgeBaseStyle, color: "var(--color-muted-text)" } as const;
const fieldStyle = { display: "grid", gridTemplateColumns: "8rem minmax(0, 1fr)", columnGap: "1rem", rowGap: "0.35rem", alignItems: "center", marginBottom: "1rem" } as const;
const labelStyle = { color: "var(--color-primary-text)", fontWeight: 600 } as const;
const helpStyle = { gridColumn: "2", color: "var(--color-muted-text)", fontSize: "0.82rem" } as const;
const controlStyle = { width: "100%", boxSizing: "border-box", padding: "0.5rem", background: "var(--color-workspace-bg)", color: "var(--color-primary-text)", border: "1px solid var(--color-border)" } as const;
const footerStyle = { display: "flex", gap: "0.6rem", alignItems: "center", marginTop: "1.2rem", flexWrap: "wrap" } as const;
const saveButtonStyle = { padding: "0.5rem 0.8rem", background: "var(--color-accent)", color: "var(--color-accent-text)", border: "none", cursor: "pointer" } as const;
const secondaryButtonStyle = { padding: "0.5rem 0.8rem", background: "transparent", color: "var(--color-primary-text)", border: "1px solid var(--color-border)", cursor: "pointer" } as const;
const savedStyle = { color: "var(--color-done)" } as const;
const shortcutStyle = { color: "var(--color-muted-text)", marginLeft: "auto", fontSize: "0.82rem" } as const;
