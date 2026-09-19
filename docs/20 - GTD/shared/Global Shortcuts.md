# Global Shortcuts

The app uses a leader-key model. `Space` starts a leader sequence. For example, `Space m a` means press `Space`, then `m`, then `a`.

## Navigation

These shortcuts are registered globally by the desktop shell.

| Shortcut | Action |
| --- | --- |
| `Ctrl+o` | Jump backward to the previous location in navigation history (e.g. after `gd`). |
| `Ctrl+i` | Jump forward to the newer location in navigation history. |
| `Space c` | Open calendars and reset the calendar workspace to Today. |
| `Space C` | Open contexts. |
| `Space i` | Open inbox and reset the inbox workspace. |
| `Space n` | Open next actions. |
| `Space o` | Open on going next actions. |
| `Space p` | Open projects. |
| `Space s` | Open someday/maybe. |
| `Space h` | Open Hint Mode to jump directly to any visible UI element. |
| `Space z` | Toggle Zen / Focus Mode (collapses side lists into a centered, distraction-free reading and writing canvas; exit with `Esc` or `Space z`). |

Calendars use `[` and `]` inside the page to cycle through Today, Weekly, Completed, and Deleted subviews.

Projects use `[` and `]` inside the page to cycle between Projects and Completed Projects.

Someday/Maybe uses `[` and `]` inside the page to cycle between Someday/Maybe and Deleted Someday/Maybe.

## Master Lists

These shortcuts are available in master-list focus zones for Inbox, Deleted Inbox, Next Actions, Ongoing Next Actions, Done Next Actions, Deleted Next Actions, Projects, Completed Projects, Someday/Maybe, Deleted Someday/Maybe, and Contexts. They do not apply to Calendar panels.

| Shortcut | Action |
| --- | --- |
| `gg` | Move selection to the first item. |
| `G` | Move selection to the last item. |

## Calendars

These shortcuts are available in the Calendars workspace when a modal dialog or body/title edit is not active.

| Shortcut | Action |
| --- | --- |
| `e` | Edit the selected calendar scheduled date and optional time. |
| `Enter` | Edit the selected calendar title in Today and Weekly list panels. |
| `Space Enter` | Open the selected calendar full detail page. |
| `P` | Associate the selected calendar to a project. |
| `gd` | Open the owner project detail page of the selected calendar and focus it. |
| `o` | Mark the selected Today Due or Weekly calendar as On Going and open its On Going calendar detail page. |
| `H` | Move the Weekly view one week backward. |
| `L` | Move the Weekly view one week forward. |
| `t` | Return Weekly to the current week and focus today. |
| `h` / `l` | Move Weekly focus to the previous or next day. |

In the calendar schedule edit dialog opened with `e`, pressing `t` in the Scheduled date field fills the field with today's local date without saving until `Enter` is pressed.

## Item Navigation

These shortcuts navigate between items and their owner projects or destination workspaces.

| Shortcut | Scope | Action |
| --- | --- | --- |
| `gd` | Inbox, Next Actions, Ongoing Next Actions, Calendars | Navigate directly to the owner project detail page of the selected item and focus that item. |
| `gd` | Project Detail | Navigate directly to the corresponding screen (Next Actions, Calendars, or Inbox) of the selected item and focus that item. |

## Shared Body Formatting

These shortcuts are available in body/detail editing zones that register markdown formatting bindings in the [[Body Content]].

| Shortcut      | Action                                               |
| ------------- | ---------------------------------------------------- |
| `Space m b`   | Format current block as a bullet point.              |
| `Space m n`   | Format current block as a numbered list.             |
| `Space m l`   | Format current block as a lettered list.             |
| `Space m c`   | Format current block as a checklist.                 |
| `Space m c c` | Format current block as a checked checklist item.    |
| `Space m c u` | Format current block as an unchecked checklist item. |
| `Space m d`   | Insert a divider.                                    |
| `Space m q`   | Format current block as a quote.                     |
| `Space m t`   | Format current block as normal text.                 |
| `Space m 1`   | Format current block as heading 1.                   |
| `Space m 2`   | Format current block as heading 2.                   |
| `Space m 3`   | Format current block as heading 3.                   |
| `Space m a`   | Insert an asset.                                     |
| `Space t b`   | Format selected inline text as bold.                 |
| `Space t i`   | Format selected inline text as italic.               |
| `Space t l`   | Insert a link.                                       |
| `Space t c`   | Format selected inline text as code.                 |
| `Space t t`   | Clear inline formatting.                             |
| `Space g d`   | Open the link or asset at the cursor target.         |

## Markdown Editor Vim Motions

These motions and operators enhance editing inside the markdown body editor:

| Shortcut | Scope | Action |
| --- | --- | --- |
| `j` / `k` | Body editor | Move down/up by visual display row in soft-wrapped text (counts like `3j` or visual line mode move by logical lines). |
| `$` | Body editor | Move to the end of the current visible display row (or logical end when count > 1). |
| `g0` | Body editor | Move to the beginning of the current visible display row. |
| `A` | Body editor | Enter insert mode at the end of the current visible display row. |
| `I` | Body editor | Enter insert mode at the beginning of the current visible display row. |
| `]]` | Body editor | Jump to next markdown heading (`#`, `##`, etc.) with jumplist support. |
| `[[` | Body editor | Jump to previous markdown heading with jumplist support. |
| `y` | Body editor | Yank selection with visual highlight pulse and synchronization to system clipboard. |
| `p` / `P` | Body editor | Paste from system clipboard into the editor in normal and visual mode. |
| `jk` | Body editor (Insert mode) | Exit insert mode immediately to normal mode without reaching for physical Escape. |

## Discoverability

| Shortcut  | Action                                                           |
| --------- | ---------------------------------------------------------------- |
| `Space k` | Open interactive Which-Key cheat sheet dialog for the active focus zone with search filtering and category groupings. |

## Conflict Rule

No two actions may use the same shortcut sequence in the same screen, focus zone, and modifier scope.

For example, `Space m a` must not be assigned to another action in a body/detail zone where it already inserts an asset.

Detail zones protect Vim-compatible body interaction. They may register only `Escape`, `Ctrl+h`, `PageUp`, `PageDown`, and leader-prefixed shortcuts such as shared body formatting commands.
