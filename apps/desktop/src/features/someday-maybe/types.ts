import type { ItemBody, Stuff } from "../inbox/types.ts";

export type SomedayMaybeItem = Stuff & {
  status: "SOMEDAY_MAYBE";
};

export type SomedayMaybeSubview = "active" | "deleted";

export type SomedayMaybePatch = {
  title?: string;
  body?: ItemBody;
  projectId?: string | null;
};
