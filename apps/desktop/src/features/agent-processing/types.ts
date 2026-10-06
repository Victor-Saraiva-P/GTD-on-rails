export type ProcessingAgent = "antigravity" | "codex";

export type AgentProviderSettings = {
  model: string | null;
  thinking: string | null;
};

export type AgentProcessingSettings = {
  processor: ProcessingAgent;
  antigravity: AgentProviderSettings;
  codex: AgentProviderSettings;
};

export type AgentModelOption = {
  id: string;
  label: string;
  thinking: string[];
};

export type AgentProviderOptions = {
  available: boolean;
  models: AgentModelOption[];
  thinking: string[];
};

export type AgentProcessingOptions = {
  antigravity: AgentProviderOptions;
  codex: AgentProviderOptions;
};

export type AgentProcessingRun = {
  runId: string;
  stuffId: string;
  provider: ProcessingAgent;
  model: string | null;
  thinking: string | null;
  processId: number;
  logPath: string;
};

export type AgentProcessingFinished = {
  runId: string;
  stuffId: string;
  provider: ProcessingAgent;
  success: boolean;
  processed: boolean;
  denied: boolean;
  response: string | null;
  logPath: string;
};

export type AgentProcessingProgress = {
  runId: string;
  stuffId: string;
  provider: ProcessingAgent;
  message: string;
};

export type TrackedAgentProcessingRun = {
  runId: string | null;
  stuffId: string;
  stuffTitle: string;
  provider: ProcessingAgent | null;
  model: string | null;
  thinking: string | null;
  processId: number | null;
  logPath: string | null;
  state: "starting" | "running" | "processed" | "finished" | "failed";
  activity: string;
  startedAt: number;
  finishedAt: number | null;
  denied: boolean;
  response: string | null;
};
