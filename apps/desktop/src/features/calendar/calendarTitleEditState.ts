import { useState } from "react";

export type CalendarTitleEditState = ReturnType<typeof useCalendarTitleEditState>;

export function useCalendarTitleEditState() {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingTitleError, setEditingTitleError] = useState<string | null>(null);

  return { editingId, editingTitle, editingTitleError, setEditingId, setEditingTitle, setEditingTitleError };
}

export function clearCalendarTitleEdit(edit: CalendarTitleEditState): void {
  edit.setEditingId(null);
  edit.setEditingTitle("");
  edit.setEditingTitleError(null);
}
