type ProjectAssociationMarkerProps = Readonly<{
  projectTitle?: string | null;
  placement?: "list" | "detail";
}>;

/**
 * Renders the owning project without turning the association into navigation.
 *
 * @example <ProjectAssociationMarker projectTitle="Website refresh" placement="list" />
 */
export function ProjectAssociationMarker({ projectTitle, placement = "detail" }: ProjectAssociationMarkerProps) {
  if (!projectTitle) return null;

  return (
    <span className={`project-association-marker project-association-marker--${placement}`} title={projectTitle}>
      <span className="project-association-marker__glyph" aria-hidden="true">P</span>
      <span className="project-association-marker__title">{projectTitle}</span>
    </span>
  );
}
