import { defaultKeymap } from "@codemirror/commands";
import { type EditorView, type KeyBinding } from "@codemirror/view";
import { getCM } from "@replit/codemirror-vim";

const VIM_MOTION_KEYS = new Set(["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Enter", "Backspace"]);

export function isVimActiveAndNonInsert(view: EditorView): boolean {
  const cm = getCM(view);
  const vim = (cm as { state?: { vim?: { insertMode?: boolean } } } | null)?.state?.vim;
  return Boolean(cm && vim && !vim.insertMode);
}

export function isVimInModalMode(view: EditorView): boolean {
  const cm = getCM(view);
  const vim = (cm as { state?: { vim?: { insertMode?: boolean; visualMode?: boolean } } } | null)?.state?.vim;
  return Boolean(cm && vim && (vim.insertMode || vim.visualMode));
}

export function deferMotionKeysToVim(
  bindings: readonly KeyBinding[],
  motionKeys: ReadonlySet<string> = VIM_MOTION_KEYS
): KeyBinding[] {
  return bindings.map((binding) => {
    if (!binding.key || !motionKeys.has(binding.key) || !binding.run) return binding;
    const nativeRun = binding.run;
    return {
      ...binding,
      preventDefault: false,
      run: (view: EditorView): boolean => {
        if (isVimActiveAndNonInsert(view)) return false;
        return nativeRun(view);
      }
    };
  });
}

export function deferEscapeKeyToVim(bindings: readonly KeyBinding[]): KeyBinding[] {
  return bindings.map((binding) => {
    if (binding.key !== "Escape" || !binding.run) return binding;
    const nativeRun = binding.run;
    return {
      ...binding,
      preventDefault: false,
      run: (view: EditorView): boolean => {
        if (isVimInModalMode(view)) return false;
        return nativeRun(view);
      }
    };
  });
}

/**
 * Builds a Vim-aware keymap where motions and Escape yield to Vim in modal modes.
 *
 * @example const keymapExtension = keymap.of(buildVimAwareDefaultKeymap());
 */
export function buildVimAwareDefaultKeymap(): readonly KeyBinding[] {
  return deferEscapeKeyToVim(deferMotionKeysToVim(defaultKeymap));
}
