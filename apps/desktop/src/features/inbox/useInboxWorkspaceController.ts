import { useEffect, useState } from "react";
import { useActiveZone } from "../keybinds/hooks";
import { useInboxStuffsQuery } from "./useInboxStuffsQuery";

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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingBodyId, setEditingBodyId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [pendingBodyEditId, setPendingBodyEditId] = useState<string | null>(null);
  const { activeZone, setActiveZone } = useActiveZone();
  const selectedItem =
    stuffs.find((item) => item.id === selectedId) ?? (stuffs.length > 0 ? stuffs[0] : null);
  const selectedIndex = selectedItem
    ? stuffs.findIndex((item) => item.id === selectedItem.id)
    : -1;

  useEffect(() => {
    if (stuffs.length === 0) {
      setSelectedId(null);
      setEditingId(null);
      setEditingTitle("");
      setEditingBodyId(null);
      setEditingBody("");
      setPendingBodyEditId(null);
      return;
    }

    if (!selectedId || !stuffs.some((item) => item.id === selectedId)) {
      setSelectedId(stuffs[0].id);
    }

    if (editingId && !stuffs.some((item) => item.id === editingId)) {
      setEditingId(null);
      setEditingTitle("");
    }

    if (editingBodyId && !stuffs.some((item) => item.id === editingBodyId)) {
      setEditingBodyId(null);
      setEditingBody("");
    }

    if (pendingBodyEditId && !stuffs.some((item) => item.id === pendingBodyEditId)) {
      setPendingBodyEditId(null);
    }
  }, [editingBodyId, editingId, pendingBodyEditId, selectedId, stuffs]);

  const selectNextStuff = () => {
    if (stuffs.length === 0) {
      return;
    }

    const nextIndex = Math.min(selectedIndex + 1, stuffs.length - 1);
    setSelectedId(stuffs[nextIndex].id);
  };

  const selectPreviousStuff = () => {
    if (stuffs.length === 0) {
      return;
    }

    const previousIndex = Math.max(selectedIndex - 1, 0);
    setSelectedId(stuffs[previousIndex].id);
  };

  const createNewStuff = async () => {
    const createdStuff = await createStuff();

    setSelectedId(createdStuff.id);
    setEditingId(createdStuff.id);
    setEditingTitle("");
    setEditingBodyId(null);
    setEditingBody("");
    setPendingBodyEditId(createdStuff.id);
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
    setEditingTitle(selectedItem.title);
    setPendingBodyEditId(null);
  };

  const cancelEditingSelectedStuff = () => {
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
    stuffs
  };
}

export type InboxWorkspaceController = ReturnType<typeof useInboxWorkspaceController>;
