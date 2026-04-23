import { useEffect, useState } from "react";
import { useActiveZone } from "../keybinds/hooks";
import { useInboxStuffsQuery } from "./useInboxStuffsQuery";
import type { Stuff } from "./types";

const DRAFT_STUFF_ID = "__draft_stuff__";

function buildDraftStuff(): Stuff {
  return {
    id: DRAFT_STUFF_ID,
    title: "",
    body: null,
    status: "INBOX",
    createdAt: new Date().toISOString()
  };
}

export function useInboxWorkspaceController() {
  const {
    stuffs,
    isLoading,
    isCreating,
    isDeleting,
    isUpdating,
    errorMessage,
    reload,
    createStuff,
    deleteStuff,
    updateStuffBody,
    updateStuffTitle
  } = useInboxStuffsQuery();
  const [draftStuff, setDraftStuff] = useState<Stuff | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingBodyId, setEditingBodyId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [pendingBodyEditId, setPendingBodyEditId] = useState<string | null>(null);
  const { activeZone, setActiveZone } = useActiveZone();
  const visibleStuffs = draftStuff ? [draftStuff, ...stuffs] : stuffs;
  const selectedItem =
    visibleStuffs.find((item) => item.id === selectedId) ?? (visibleStuffs.length > 0 ? visibleStuffs[0] : null);
  const selectedIndex = selectedItem
    ? visibleStuffs.findIndex((item) => item.id === selectedItem.id)
    : -1;

  useEffect(() => {
    if (visibleStuffs.length === 0) {
      setSelectedId(null);
      setEditingId(null);
      setEditingTitle("");
      setEditingBodyId(null);
      setEditingBody("");
      setPendingBodyEditId(null);
      return;
    }

    if (!selectedId || !visibleStuffs.some((item) => item.id === selectedId)) {
      setSelectedId(visibleStuffs[0].id);
    }

    if (editingId && !visibleStuffs.some((item) => item.id === editingId)) {
      setEditingId(null);
      setEditingTitle("");
    }

    if (editingBodyId && !visibleStuffs.some((item) => item.id === editingBodyId)) {
      setEditingBodyId(null);
      setEditingBody("");
    }

    if (pendingBodyEditId && !visibleStuffs.some((item) => item.id === pendingBodyEditId)) {
      setPendingBodyEditId(null);
    }
  }, [draftStuff, editingBodyId, editingId, pendingBodyEditId, selectedId, visibleStuffs]);

  const selectNextStuff = () => {
    if (visibleStuffs.length === 0) {
      return;
    }

    const nextIndex = Math.min(selectedIndex + 1, visibleStuffs.length - 1);
    setSelectedId(visibleStuffs[nextIndex].id);
  };

  const selectPreviousStuff = () => {
    if (visibleStuffs.length === 0) {
      return;
    }

    const previousIndex = Math.max(selectedIndex - 1, 0);
    setSelectedId(visibleStuffs[previousIndex].id);
  };

  const createNewStuff = async () => {
    const nextDraft = buildDraftStuff();

    setDraftStuff(nextDraft);
    setSelectedId(nextDraft.id);
    setEditingId(nextDraft.id);
    setEditingTitle("");
    setEditingBodyId(null);
    setEditingBody("");
    setPendingBodyEditId(nextDraft.id);
    setActiveZone("inbox-list");
  };

  const deleteSelectedStuff = async () => {
    if (!selectedItem) {
      return;
    }

    await deleteStuff(selectedItem.id);
    setEditingId(null);
    setEditingTitle("");
    setEditingBodyId(null);
    setEditingBody("");
    setPendingBodyEditId(null);
    setActiveZone("inbox-list");
  };

  const startEditingSelectedStuff = () => {
    if (!selectedItem) {
      return;
    }

    setEditingId(selectedItem.id);
    setEditingTitle(selectedItem.id === DRAFT_STUFF_ID ? "" : selectedItem.title);
    setPendingBodyEditId(selectedItem.id === DRAFT_STUFF_ID ? selectedItem.id : null);
  };

  const cancelEditingSelectedStuff = () => {
    if (editingId === DRAFT_STUFF_ID) {
      setDraftStuff(null);
      setSelectedId(stuffs[0]?.id ?? null);
    }

    setEditingId(null);
    setEditingTitle("");
    setPendingBodyEditId(null);
  };

  const startEditingSelectedStuffBody = () => {
    if (!selectedItem) {
      return;
    }

    setEditingBodyId(selectedItem.id);
    setEditingBody(selectedItem.body ?? "");
  };

  const cancelEditingSelectedStuffBody = () => {
    setEditingBodyId(null);
    setEditingBody("");
  };

  const commitEditingSelectedStuff = async () => {
    if (!selectedItem || editingId !== selectedItem.id) {
      return;
    }

    const normalizedTitle = editingTitle.trim();
    const shouldContinueToBody = pendingBodyEditId === selectedItem.id;

    if (!normalizedTitle) {
      if (selectedItem.id === DRAFT_STUFF_ID) {
        setDraftStuff(null);
        setSelectedId(stuffs[0]?.id ?? null);
      }

      setEditingId(null);
      setEditingTitle("");
      if (shouldContinueToBody) {
        setActiveZone("inbox-list");
      }
      setPendingBodyEditId(null);
      return;
    }

    if (selectedItem.id === DRAFT_STUFF_ID) {
      const createdStuff = await createStuff(normalizedTitle);

      setDraftStuff(null);
      setSelectedId(createdStuff.id);
      setEditingId(null);
      setEditingTitle("");
      if (shouldContinueToBody) {
        setActiveZone("stuff-detail");
        setEditingBodyId(createdStuff.id);
        setEditingBody(createdStuff.body ?? "");
      }
      setPendingBodyEditId(null);
      return;
    }

    if (normalizedTitle === selectedItem.title) {
      setEditingId(null);
      setEditingTitle("");
      if (shouldContinueToBody) {
        setActiveZone("stuff-detail");
        setEditingBodyId(selectedItem.id);
        setEditingBody(selectedItem.body ?? "");
      }
      setPendingBodyEditId(null);
      return;
    }

    const updatedStuff = await updateStuffTitle(selectedItem, normalizedTitle);

    setSelectedId(updatedStuff.id);
    setEditingId(null);
    setEditingTitle("");
    if (shouldContinueToBody) {
      setActiveZone("stuff-detail");
      setEditingBodyId(updatedStuff.id);
      setEditingBody(updatedStuff.body ?? "");
    }
    setPendingBodyEditId(null);
  };

  const commitEditingSelectedStuffBody = async () => {
    if (!selectedItem || editingBodyId !== selectedItem.id) {
      return;
    }

    const normalizedBody = editingBody.trim();
    const nextBody = normalizedBody ? editingBody : null;

    if ((selectedItem.body ?? null) === nextBody) {
      setEditingBodyId(null);
      setEditingBody("");
      return;
    }

    const updatedStuff = await updateStuffBody(selectedItem, nextBody);

    setSelectedId(updatedStuff.id);
    setEditingBodyId(null);
    setEditingBody("");
    setPendingBodyEditId(null);
  };

  return {
    activeZone,
    createNewStuff,
    deleteSelectedStuff,
    editingBody,
    editingBodyId,
    editingId,
    editingTitle,
    errorMessage,
    isCreating,
    isDeleting,
    isLoading,
    isUpdating,
    reload,
    selectedId,
    selectedIndex,
    selectedItem,
    setActiveZone,
    setEditingBody,
    setEditingTitle,
    setPendingBodyEditId,
    setSelectedId,
    selectNextStuff,
    selectPreviousStuff,
    startEditingSelectedStuff,
    startEditingSelectedStuffBody,
    cancelEditingSelectedStuff,
    cancelEditingSelectedStuffBody,
    commitEditingSelectedStuff,
    commitEditingSelectedStuffBody,
    stuffs: visibleStuffs
  };
}

export type InboxWorkspaceController = ReturnType<typeof useInboxWorkspaceController>;
