import { lazy, Suspense } from "react";
import { projectBriefEditorConfig, projectBriefPresentation, type ProjectBriefProps } from "./projectBriefView.ts";

const LazyItemBodyMarkdownEditor = lazy(async () => {
  const module = await import("../inbox/ItemBodyMarkdownEditor.tsx");
  return { default: module.ItemBodyMarkdownEditor };
});

function BriefState({ children }: Readonly<{ children: string }>) {
  return <p className="pane-state" aria-live="polite">{children}</p>;
}

function BriefLoadError({ errorMessage }: Readonly<{ errorMessage: string }>) {
  return <p className="pane-state" role="alert">Failed to load project brief: {errorMessage}</p>;
}

function BriefSaveError({ errorMessage }: Readonly<{ errorMessage: string | null }>) {
  if (!errorMessage) return null;
  return <p className="pane-state" role="alert">Project brief: {errorMessage}</p>;
}

function ProjectBriefEditor(props: ProjectBriefProps) {
  const editorConfig = projectBriefEditorConfig(props);
  if (!editorConfig) return <BriefState>Loading project brief...</BriefState>;
  return (
    <div className="project-brief__surface" aria-label="Project brief">
      <BriefSaveError errorMessage={props.errorMessage} />
      <Suspense fallback={<BriefState>Loading project brief editor...</BriefState>}>
        <LazyItemBodyMarkdownEditor {...editorConfig} />
      </Suspense>
    </div>
  );
}

/**
 * Renders the selected project's Markdown brief in preview or edit mode.
 *
 * @example <ProjectBrief projectId="project-1" body={body} isLoading={false} isEditing={false} ...callbacks />
 */
export function ProjectBrief(props: ProjectBriefProps) {
  const presentation = projectBriefPresentation(props);
  if (presentation === "no-project") return <BriefState>Select a project to view its brief.</BriefState>;
  if (presentation === "loading") return <BriefState>Loading project brief...</BriefState>;
  if (presentation === "error") return <BriefLoadError errorMessage={props.errorMessage ?? "Unknown error."} />;
  if (presentation === "empty") return <BriefState>Project brief is empty.</BriefState>;
  return <ProjectBriefEditor {...props} />;
}
