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

export type AgentRecommendationKind = "next-action" | "project" | "calendar" | "someday";

export type AgentRecommendationOption = {
  kind: AgentRecommendationKind;
  title: string;
  reason: string;
  energy: number | null;
  minutes: number | null;
  contextIds: string[];
  deadline: string | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
};

export type AgentRecommendation = {
  stuffId: string;
  sourceTitle: string;
  reason: string;
  questions: string[];
  options: AgentRecommendationOption[];
  recommendedIndex: number | null;
};

export type AgentProcessingRun = {
  runId: string;
  stuffId: string;
  stuffTitle: string;
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
  recommendation: AgentRecommendation | null;
  logPath: string;
};

export type AgentActivityKind = "status" | "reasoning" | "tool" | "response";

export type AgentActivity = {
  kind: AgentActivityKind;
  message: string;
};

export type AgentProcessingProgress = AgentActivity & {
  runId: string;
  stuffId: string;
  provider: ProcessingAgent;
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
  activities: AgentActivity[];
};
