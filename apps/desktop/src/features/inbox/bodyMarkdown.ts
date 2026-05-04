export const MAX_MARKDOWN_BODY_LENGTH = 100_000;

export type MarkdownBodySaveState = "saved" | "saving" | "unsaved" | "error";

type MarkdownDocumentView = {
  state: {
    doc: {
      toString: () => string;
    };
  };
};

/**
 * Normalizes item body markdown before sending it to the backend.
 *
 * @example normalizeMarkdownBody("one\r\ntwo")
 */
export function normalizeMarkdownBody(value: string | null | undefined): string {
  const normalizedValue = (value ?? "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  validateMarkdownBodyLength(normalizedValue);
  validateMarkdownBodyCharacters(normalizedValue);
  return normalizedValue;
}

/**
 * Runs post-save item body effects after the backend accepts the markdown.
 *
 * @example await runPostSaveEffects()
 */
export async function runPostSaveEffects(): Promise<void> {
  await Promise.resolve();
}

/**
 * Creates a CodeMirror command that saves the editor document as markdown.
 *
 * @example createSaveItemBodyCommand(async (body) => save(body))(view)
 */
export function createSaveItemBodyCommand(
  saveMarkdownBody: (body: string) => Promise<void> | void,
  runAfterSave: () => Promise<void> = runPostSaveEffects,
  onSaveError: (error: unknown) => void = console.error
) {
  return (view: MarkdownDocumentView): boolean => {
    const markdownBody = safeNormalizeMarkdownBody(view.state.doc.toString(), onSaveError);
    if (markdownBody === null) {
      return true;
    }

    void Promise.resolve(saveMarkdownBody(markdownBody))
      .then(runAfterSave)
      .catch(onSaveError);

    return true;
  };
}

function safeNormalizeMarkdownBody(value: string, onSaveError: (error: unknown) => void): string | null {
  try {
    return normalizeMarkdownBody(value);
  } catch (error) {
    onSaveError(error);
    return null;
  }
}

function validateMarkdownBodyLength(value: string): void {
  if (value.length > MAX_MARKDOWN_BODY_LENGTH) {
    throw new Error(
      `body length '${value.length}' is invalid; expected at most ${MAX_MARKDOWN_BODY_LENGTH} characters`
    );
  }
}

function validateMarkdownBodyCharacters(value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    validateMarkdownBodyCharacter(value.charCodeAt(index));
  }
}

function validateMarkdownBodyCharacter(codePoint: number): void {
  if (codePoint < 32 && codePoint !== 9 && codePoint !== 10) {
    throw new Error(
      `body character U+${codePoint.toString(16).padStart(4, "0").toUpperCase()} is invalid; expected printable markdown text`
    );
  }
}
