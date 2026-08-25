import type { KeyboardEvent } from "react";
import { InlineTitleInput } from "../../components/InlineTitleInput";
import { calendarItemIconText } from "../lists/listThemes";
import type { ProjectItem } from "./projectItems";

type ProjectActionsListProps = Readonly<{
  editingId: string | null;
  editingTitle: string;
  editingTitleError: string | null;
  items: ProjectItem[];
  selectedId: string;
  onCancelEditing: () => void;
  onCommitEditing: () => void;
  onCommitEditingAndContinue: () => void;
  onEditingTitleChange: (value: string) => void;
  onSelect: (id: string) => void;
  onStartEditing: () => void;
}>;

function projectItemGlyph(item: ProjectItem): string {
  if (item.kind === "CALENDAR") return calendarItemIconText;
  if (item.kind === "NEXT_ACTION") return "N";
  return "S";
}

function projectItemGlyphClass(item: ProjectItem): string {
  if (item.kind === "CALENDAR") return "tree-entry__glyph--project-calendar";
  if (item.kind === "NEXT_ACTION") return "tree-entry__glyph--project-next-action";
  return "tree-entry__glyph--project-stuff";
}

function ProjectActionGlyph({ item }: Readonly<{ item: ProjectItem }>) {
  const className = ["tree-entry__glyph", projectItemGlyphClass(item)].join(" ");
  return <span className={className} aria-hidden="true">{projectItemGlyph(item)}</span>;
}

function handleEditKeyDown(event: KeyboardEvent<HTMLInputElement>, commit: () => void) {
  if (event.key !== "Enter" && event.key !== "Escape") return;
  event.preventDefault(); commit();
}

function EditingProjectAction(props: ProjectActionCardProps) {
  const commit = props.onCommitEditingAndContinue;
  return (
    <li className="tree-list__item">
      <div className="tree-entry tree-entry--active unified-item-entry">
        <ProjectActionGlyph item={props.item} />
        <div className="tree-entry__edit">
          <InlineTitleInput initialValue={props.editingTitle} onBlur={props.onCommitEditing} onEditKeyDown={(event) => handleEditKeyDown(event, commit)} onValueChange={props.onEditingTitleChange} />
          {props.editingTitleError ? <p className="tree-entry__error">{props.editingTitleError}</p> : null}
        </div>
      </div>
    </li>
  );
}

type ProjectActionCardProps = ProjectActionsListProps & Readonly<{
  item: ProjectItem;
  selected: boolean;
}>;

function ReadOnlyProjectAction(props: ProjectActionCardProps) {
  return (
    <li className="tree-list__item">
      <button type="button" className={`tree-entry unified-item-entry${props.selected ? " tree-entry--active" : ""}`} onClick={() => props.onSelect(props.item.id)} onDoubleClick={props.onStartEditing}>
        <ProjectActionGlyph item={props.item} />
        <span className="tree-entry__label">{props.item.title}</span>
      </button>
    </li>
  );
}

function ProjectActionCard(props: ProjectActionCardProps) {
  if (props.editingId === props.item.id) return <EditingProjectAction {...props} />;
  return <ReadOnlyProjectAction {...props} />;
}

export function ProjectActionsList(props: ProjectActionsListProps) {
  return (
    <div className="tree-list__scroll-container">
      <ol className="tree-list tree-list--inbox" aria-label="Project actions">
        {props.items.map((item) => <ProjectActionCard {...props} item={item} key={item.id} selected={props.selectedId === item.id} />)}
      </ol>
    </div>
  );
}
