# Global Shortcuts

The app uses a leader-key model. `Space` starts a leader sequence. For example, `Space m a` means press `Space`, then `m`, then `a`.

## Navigation

These shortcuts are registered globally by the desktop shell.

| Shortcut | Action |
| --- | --- |
| `Space c` | Open calendars and reset the calendar workspace to Today. |
| `Space C` | Open contexts. |
| `Space i` | Open inbox and reset the inbox workspace. |
| `Space n` | Open next actions. |
| `Space o` | Open on going next actions. |

Calendars use `[` and `]` inside the page to cycle through Today, Weekly, Completed, and Deleted subviews.

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

## Discoverability

| Shortcut  | Action                                                           |
| --------- | ---------------------------------------------------------------- |
| `Space k` | Show available keybindings for the active screen and focus zone. |

## Conflict Rule

No two actions may use the same shortcut sequence in the same screen, focus zone, and modifier scope.

For example, `Space m a` must not be assigned to another action in a body/detail zone where it already inserts an asset.
