/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_DATA_ROOT_DIRECTORY_NAME?: string;
  readonly VITE_GTD_AGENT_STATE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

type GtdAgentState = {
  route?: string;
  activeView?: string;
  focusedPanel?: string | null;
  selectedItemId?: string | null;
  selectedItemTitle?: string | null;
  selectedListName?: string | null;
  listItemCount?: number | null;
  modalOpen?: boolean;
  modalTitle?: string | null;
  commandPaletteOpen?: boolean;
  leaderKeyActive?: boolean;
  processingStep?: string | null;
  lastToast?: string | null;
  syncStatusSummary?: string | null;
};

interface Window {
  __GTD_AGENT_STATE__?: GtdAgentState;
}
