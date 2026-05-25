# Next Actions

This page is the umbrella documentation for the next-action lists and related pages.

## Elements

- [[Next Action]]

## Supporting Attributes

- [[Context]]

## Next Actions List

The next actions page is the list of available concrete actions. It supports [[Context]] filtering, ordering, status changes, editing, and deletion.

| Shortcut | Scope | Action |
| --- | --- | --- |
| `d` | List or detail | Delete selected next action. |
| `x` | List or detail | Mark selected next action as done. |
| `c` | List or detail | Filter by context. |
| `t` | List or detail | Set available time. |
| `e` | List or detail | Set available energy. |
| `E` | List or detail | Edit next action attributes. |
| `o` | List or detail | Mark selected next action as on going and open its detail. |
| `O` | List or detail | Cycle ordering. |
| `u` | List or detail | Undo last deletion. |
| `Ctrl+r` | List or detail | Redo last action. |
| `j` | List | Move selection down. |
| `k` | List | Move selection up. |
| `Enter` | List | Edit selected title. |
| `l` | List | Edit selected body. |
| `h` | Detail | Focus next actions list. |
| `Enter` | Detail | Edit selected body. |
| `Space Enter` | List or detail | Open full detail. |
| `[` | List or detail | Open deleted next actions. |
| `]` | List or detail | Open completed next actions. |
| `Space k` | List or detail | Show available keybindings. |

The next action detail body is [[Body Content]] and supports the shared formatting shortcuts from [[Global Shortcuts]].

## Next Action Detail Page

The next action detail page is the focused detail view for a selected next action.

Focused detail pages start body editing automatically when opened. `Enter` starts editing again when the body is not already being edited.

| Shortcut | Action |
| --- | --- |
| `Enter` | Edit selected body. |
| `Escape` | Back to next actions when body editing is not active. |
| `Space k` | Show available keybindings. |

The body is [[Body Content]] and supports the shared formatting shortcuts from [[Global Shortcuts]].

## On Going Next Actions List

The on going next actions page is the list of actions currently pulled into active execution.

| Shortcut | Scope | Action |
| --- | --- | --- |
| `d` | List or detail | Delete selected on going action. |
| `x` | List or detail | Mark selected action as done. |
| `e` | List or detail | Edit attributes. |
| `o` | List or detail | Cycle ordering. |
| `u` | List or detail | Undo last deletion. |
| `r` | List or detail | Restore selected action as a next action. |
| `Ctrl+r` | List or detail | Redo last action. |
| `j` | List | Move selection down. |
| `k` | List | Move selection up. |
| `Enter` | List | Edit selected title. |
| `l` | List | Edit selected body. |
| `h` | Detail | Focus on going actions list. |
| `Enter` | Detail | Edit selected body. |
| `Space Enter` | List or detail | Open full detail. |
| `Space k` | List or detail | Show available keybindings. |

The on going action detail body is [[Body Content]] and supports the shared formatting shortcuts from [[Global Shortcuts]].

## On Going Next Action Detail Page

The on going next action detail page is the focused detail view for an action in active execution.

Focused detail pages start body editing automatically when opened. `Enter` starts editing again when the body is not already being edited.

| Shortcut | Action |
| --- | --- |
| `Enter` | Edit selected body. |
| `Escape` | Back to on going actions when body editing is not active. |
| `r` | Restore selected action as a next action. |
| `Space k` | Show available keybindings. |

The body is [[Body Content]] and supports the shared formatting shortcuts from [[Global Shortcuts]].

## Completed Next Actions List

The completed next actions page is the recovery and review list for actions marked done.

| Shortcut | Scope | Action |
| --- | --- | --- |
| `d` | List or detail | Delete selected completed next action. |
| `r` | List or detail | Restore selected completed action as a next action. |
| `j` | List | Move selection down. |
| `k` | List | Move selection up. |
| `l` | List | Focus next action detail. |
| `h` | Detail | Focus next actions list. |
| `[` | List or detail | Open next actions. |
| `]` | List or detail | Open deleted next actions. |
| `Space k` | List or detail | Show available keybindings. |

## Deleted Next Actions List

The deleted next actions page is the recovery list for deleted next actions.

| Shortcut | Scope | Action |
| --- | --- | --- |
| `r` | List or detail | Recover selected next action. |
| `j` | List | Move selection down. |
| `k` | List | Move selection up. |
| `l` | List | Focus next action detail. |
| `h` | Detail | Focus next actions list. |
| `[` | List or detail | Open completed next actions. |
| `]` | List or detail | Open next actions. |
| `Space k` | List or detail | Show available keybindings. |

Items can arrive here by processing captured material from [[Inbox]].
