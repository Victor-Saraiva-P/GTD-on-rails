import assert from "node:assert/strict";
import test, { describe } from "node:test";

import {
  applyJumpEntry,
  getCurrentJumpEntry,
  type JumpControllers,
  type NavigableController,
  type OnGoingNavigableController
} from "../src/features/navigation/jumpEntryState.ts";
import type { Project } from "../src/features/projects/types.ts";

function createMockController(selectedId: string | null = null): NavigableController & { selectedIdState: string | null; activeZoneState: string | null } {
  const state = {
    selectedIdState: selectedId,
    activeZoneState: null as string | null
  };
  return {
    get selectedItem() {
      return state.selectedIdState ? { id: state.selectedIdState } : null;
    },
    get selectedIdState() {
      return state.selectedIdState;
    },
    get activeZoneState() {
      return state.activeZoneState;
    },
    setSelectedId: (id: string | null) => {
      state.selectedIdState = id;
    },
    setActiveZone: (zone: string) => {
      state.activeZoneState = zone;
    }
  };
}
function createMockOnGoingController(selectedId: string | null = null): OnGoingNavigableController & { selectedIdState: string | null; activeZoneState: string | null } {
  const state = {
    selectedIdState: selectedId,
    activeZoneState: null as string | null
  };
  return {
    get selectedItem() {
      return state.selectedIdState ? { item: { id: state.selectedIdState } } : null;
    },
    get selectedIdState() {
      return state.selectedIdState;
    },
    get activeZoneState() {
      return state.activeZoneState;
    },
    setSelectedId: (id: string | null) => {
      state.selectedIdState = id;
    },
    setActiveZone: (zone: any) => {
      state.activeZoneState = zone;
    }
  };
}

function createMockControllers(): JumpControllers & {
  inboxMock: ReturnType<typeof createMockController>;
  nextActionsMock: ReturnType<typeof createMockController>;
  calendarsMock: ReturnType<typeof createMockController>;
  ongoingMock: ReturnType<typeof createMockOnGoingController>;
  projectsMock: ReturnType<typeof createMockController>;
  projectDetailMock: ReturnType<typeof createMockController>;
} {
  const inboxMock = createMockController("inbox-1");
  const nextActionsMock = createMockController("na-1");
  const calendarsMock = createMockController("cal-1");
  const ongoingMock = createMockOnGoingController("on-1");
  const projectsMock = {
    ...createMockController("p-1"),
    projects: [{ id: "p-1", title: "Project One" }] as Project[]
  };
  const projectDetailMock = createMockController("item-1");

  return {
    inbox: inboxMock,
    inboxMock,
    nextActions: nextActionsMock,
    nextActionsMock,
    calendars: calendarsMock,
    calendarsMock,
    ongoing: ongoingMock,
    ongoingMock,
    projects: projectsMock,
    projectsMock,
    projectDetail: projectDetailMock,
    projectDetailMock
  };
}

describe("jumpEntryState", () => {
  describe("getCurrentJumpEntry", () => {
    test("captures project-detail jump entry with project metadata and selected item", () => {
      const mocks = createMockControllers();
      const project: Project = { id: "p-1", title: "Project One" };
      const entry = getCurrentJumpEntry("project-detail", mocks, project);

      assert.deepEqual(entry, {
        screen: "project-detail",
        zone: "project-actions-list",
        projectId: "p-1",
        projectTitle: "Project One",
        selectedItemId: "item-1"
      });
    });

    test("captures next-actions jump entry", () => {
      const mocks = createMockControllers();
      const entry = getCurrentJumpEntry("next-actions", mocks, null);

      assert.deepEqual(entry, {
        screen: "next-actions",
        zone: "next-actions-list",
        selectedItemId: "na-1"
      });
    });

    test("captures inbox jump entry", () => {
      const mocks = createMockControllers();
      const entry = getCurrentJumpEntry("inbox", mocks, null);

      assert.deepEqual(entry, {
        screen: "inbox",
        zone: "inbox-list",
        selectedItemId: "inbox-1"
      });
    });
  });

  describe("applyJumpEntry", () => {
    test("restores project-detail screen, sets project and item selection", () => {
      const mocks = createMockControllers();
      let activeScreen = "inbox";
      let projectDetailProject: Project | null = null;

      applyJumpEntry(
        {
          screen: "project-detail",
          projectId: "p-1",
          projectTitle: "Project One",
          selectedItemId: "item-42"
        },
        mocks,
        (s) => { activeScreen = s; },
        (p) => { projectDetailProject = p; }
      );

      assert.equal(activeScreen, "project-detail");
      assert.deepEqual(projectDetailProject, { id: "p-1", title: "Project One" });
      assert.equal(mocks.projectDetailMock.selectedIdState, "item-42");
      assert.equal(mocks.projectDetailMock.activeZoneState, "project-actions-list");
    });

    test("restores next-actions screen and item selection", () => {
      const mocks = createMockControllers();
      let activeScreen = "inbox";

      applyJumpEntry(
        { screen: "next-actions", selectedItemId: "na-99" },
        mocks,
        (s) => { activeScreen = s; },
        () => {}
      );

      assert.equal(activeScreen, "next-actions");
      assert.equal(mocks.nextActionsMock.selectedIdState, "na-99");
      assert.equal(mocks.nextActionsMock.activeZoneState, "next-actions-list");
    });
  });
});
