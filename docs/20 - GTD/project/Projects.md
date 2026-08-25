# Projects

This page is the umbrella documentation for the projects list.

## Elements

- [[Project]]

## Projects List

The projects page is the list of active project outcomes. It shows project cards with the project title, optional deadline, and the purple `P` project glyph.

Active projects with a deadline appear as all-day entries on the external Project agenda for the deadline date. Active projects without a deadline do not appear on an external agenda.

| Shortcut | Scope | Action |
| --- | --- | --- |
| `Enter` | List | Open the selected project's detail page. |
| `e` | List | Edit selected project title or deadline. |
| `d` | List | Delete selected project. |
| `x` | List | Mark selected project as done. |
| `u` | List | Undo last action. |
| `Ctrl+r` | List | Redo last action. |
| `[` | List | Open deleted projects. |
| `]` | List | Open completed projects. |
| `gg` | List | Move selection to the first project. |
| `G` | List | Move selection to the last project. |
| `h` | List | Move selection to the previous project. |
| `j` | List | Move selection to the next project. |
| `k` | List | Move selection to the previous project. |
| `l` | List | Move selection to the next project. |
| `Space k` | List | Show available keybindings. |

## Project Detail Page

The project detail page is a fullscreen page for one active project. Its first subview is the Project Actions View, titled with the project title and using the project purple page theme.

The Project Actions View is a unified list of project items with a detail preview pane beside it. It shows captured project stuff first, calendar items second, next actions with deadlines third, and next actions without deadlines last.

Project stuff created from this page remains normal stuff and also appears in Inbox until processed. Processing project stuff can turn it into a next action or calendar item; the resulting item remains in the Project Actions View and also appears in its global page.

| Shortcut | Scope | Action |
| --- | --- | --- |
| `a` | Project Actions View | Add project stuff. |
| `p` | Project Actions View | Process selected project stuff into a next action or calendar item. |
| `Enter` | Project Actions View | Edit selected project item title. |
| `l` | Project Actions View | Focus the selected project item detail/body. |
| `j` | Project Actions View | Move selection to the next project item. |
| `k` | Project Actions View | Move selection to the previous project item. |
| `gg` | Project Actions View | Move selection to the first project item. |
| `G` | Project Actions View | Move selection to the last project item. |
| `Ctrl+h` | Project Item Detail | Exit body editing and return to the Project Actions View. |
| `Space p` | Global | Open Projects using the normal global navigation behavior. |

## Completed Projects List

The completed projects subview is the review and recovery list for projects marked done. It uses the completed green page color and shows the most recently done project first.

Done projects with a deadline appear as all-day entries on the shared external Done agenda for the deadline date. Done projects without a deadline do not appear on an external agenda.

| Shortcut | Scope | Action |
| --- | --- | --- |
| `e` | List | Edit selected completed project title or deadline. |
| `d` | List | Delete selected completed project. |
| `r` | List | Restore selected completed project as active. |
| `u` | List | Undo last action. |
| `Ctrl+r` | List | Redo last action. |
| `[` | List | Open active projects. |
| `]` | List | Open deleted projects. |
| `gg` | List | Move selection to the first project. |
| `G` | List | Move selection to the last project. |
| `h` | List | Move selection to the previous project. |
| `j` | List | Move selection to the next project. |
| `k` | List | Move selection to the previous project. |
| `l` | List | Move selection to the next project. |
| `Space k` | List | Show available keybindings. |

## Deleted Projects List

The deleted projects subview is the recovery list for deleted projects. It uses the deleted gray page color and shows the most recently deleted project first.

| Shortcut | Scope | Action |
| --- | --- | --- |
| `e` | List | Edit selected deleted project title or deadline. |
| `r` | List | Recover selected project. |
| `u` | List | Undo last action. |
| `Ctrl+r` | List | Redo last action. |
| `[` | List | Open completed projects. |
| `]` | List | Open active projects. |
| `gg` | List | Move selection to the first project. |
| `G` | List | Move selection to the last project. |
| `h` | List | Move selection to the previous project. |
| `j` | List | Move selection to the next project. |
| `k` | List | Move selection to the previous project. |
| `l` | List | Move selection to the next project. |
| `Space k` | List | Show available keybindings. |

## Project Editing

Pressing `e` opens the project edit dialog.

| Shortcut | Action |
| --- | --- |
| `t` | Edit the project title. |
| `d` | Edit the project deadline. |
| `Escape` | Close the dialog, or return to the edit choices from a substep. |

In the Deadline field, pressing `t` fills the field with today's local date without saving until `Enter` is pressed.
