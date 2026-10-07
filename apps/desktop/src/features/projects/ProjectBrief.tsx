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

function projectBriefSurfaceClass(isEditing: boolean): string {
  if (isEditing) return "inbox-detail__body-surface";
  return "inbox-detail__body inbox-detail__body-preview inbox-detail__body-surface";
}

function ProjectBriefEditor(props: ProjectBriefProps) {
  const editorConfig = projectBriefEditorConfig(props);
  if (!editorConfig) return <BriefState>Loading project brief...</BriefState>;
  return (
    <div className="inbox-detail project-brief" aria-label="Project brief">
      <BriefSaveError errorMessage={props.errorMessage} />
      <div className={projectBriefSurfaceClass(props.isEditing)}>
        <Suspense fallback={<BriefState>Loading project brief editor...</BriefState>}>
          <LazyItemBodyMarkdownEditor {...editorConfig} />
        </Suspense>
      </div>
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
