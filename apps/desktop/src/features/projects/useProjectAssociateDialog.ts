import { useCallback, useState } from "react";

export type ProjectAssociateDialogState = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  setIsOpen: (isOpen: boolean) => void;
};

/**
 * Manages open/close state for the project associate dialog.
 *
 * @example const associateDialog = useProjectAssociateDialog();
 */
export function useProjectAssociateDialog(): ProjectAssociateDialogState {
  const [isOpen, setIsOpen] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  return { isOpen, open, close, setIsOpen };
}
