---
name: gtd-processing
description: Clarify and process GTD on Rails inbox stuff through the controlled gtd CLI. Use when deciding what a capture means, identifying its desired outcome and next physical action, inspecting relevant attachments, or converting it into the correct GTD destination.
---

# GTD processing

Use the `gtd` CLI as the only GTD on Rails interface. Process one captured item to a clear decision: what it is, whether it is actionable, the desired outcome when relevant, and the next physical/visible action.

## Process

1. **Inspect one item.** If an ID was supplied, run `gtd stuff show <id>` for exactly that item. Otherwise use `gtd inbox list`; it is oldest-first. Never substitute another item for a missing/stale ID.
2. **Use all captured evidence.** Read the title and Markdown body. When the body references `assets/...`, run `gtd stuff export <id> --output <directory>` and inspect only the relevant exported files before deciding or asking the user.
3. **Clarify what this is.** Decide whether the capture represents something actionable now. Do not organize an amorphous capture before its meaning is clear.
4. **If it is not actionable now, classify it:**
   - **Someday/Maybe** when the user may want to act on it later but has no present commitment: `gtd stuff process someday-maybe <id>`.
   - **Trash** when it has no future action or reference value.
   - **Reference** when it is useful information but requires no action.
   GTD on Rails currently exposes no controlled CLI destination for Trash or Reference in this workflow. For those classifications, leave the item in Inbox and report the classification instead of forcing it into another destination.
5. **If it is actionable, define the outcome and next action.**
   - A **Project** is a committed desired outcome requiring more than one action. Express its title as the positive done-state/finish line when that meaning is supported by the capture. Convert with `gtd stuff process project <id> [--deadline YYYY-MM-DD]`.
   - A **Next Action** is the very next physical, visible behavior that advances the situation. Prefer verbs that describe observable execution such as call, email, write, buy, clean, read, inspect, ask, or research. Convert with `gtd stuff process next-action <id> --energy <0-10> --minutes <n> [--context <uuid> ...] [--deadline YYYY-MM-DD]`.
   - **Calendar** is reserved for the hard landscape: something that must occur on a specific date/time, or date-specific information the user must see that day. Convert with `gtd stuff process calendar <id> --date YYYY-MM-DD [--time HH:MM]`. Never invent a date merely because an action should happen soon.
6. **Resolve vague actions into physical actions.** Terms such as “plan”, “organize”, “resolve”, “decide”, or “handle” are not sufficient next actions by themselves. Determine the first visible behavior. If the blocker is missing information, the next action may be to obtain that information. If the blocker is internal thinking, the next action may be to brainstorm, outline, or draft ideas.
7. **Ask only when the decision truly depends on the user.** Ask the minimum question when the captured evidence cannot determine the meaning, commitment, desired outcome, required hard date, or a concrete next action without inventing material facts. Do not ask for metadata such as energy, duration, or context when the action itself is already clear.
8. **Normalize only after clarification.** Improve title/body when useful, preserving the captured meaning, evidence, uncertainty, links, quotes, and asset references. Apply body changes with `gtd stuff body <id> --file <path>` and title changes with `gtd stuff title <id> '<title>'`.
9. **Add execution metadata only after the GTD decision.** For a Next Action, run `gtd contexts list` and choose a context only when an existing context represents a real execution constraint: required location, tool, or person. Do not infer context from topic alone. Estimate energy and whole minutes conservatively; these fields must not change the GTD destination.
10. **Report only the mutation actually performed.** If clarification remains unresolved or the correct GTD class is unsupported by the controlled CLI, leave the Stuff in Inbox and explain the unresolved decision.

## Decision rules

- **Outcome before action:** for actionable material, first know what “done” means when the item is larger than one action, then identify the next physical step.
- **One action vs. project:** if completing the identified action would fully satisfy the commitment, it can be a Next Action. If more actions would remain, the commitment is a Project.
- **Information gap is actionable:** “decide what to do” is not a next action. Identify the physical act that supplies the missing information or thinking needed to decide.
- **Calendar is sacred:** use it only for date/time-specific commitments or information. “I would like to do this Tuesday” belongs in Next Actions unless Tuesday is a real constraint.
- **Context is a constraint:** classify by what must be available to execute the action, not by subject area.
- **No present commitment means incubation:** a possible future outcome belongs in Someday/Maybe, not Projects or Next Actions.
- **Do not force unsupported GTD classes:** Trash, Reference, and Waiting For/delegated work should not be mislabeled as Next Action, Project, Calendar, or Someday/Maybe. Leave the item in Inbox and report the classification when the controlled CLI cannot represent it.

## Tool discipline

Issue exactly one `gtd ...` command per shell tool call. Do not chain it with shell utilities, pipes, redirects, or unrelated commands. `gtd stuff export` creates its output directory.

Use the harness file tools only to inspect exported attachments. Do not inspect repository history, source code, web search, browser state, MCP tools, or unrelated memory to determine what the capture means unless the user explicitly requests external research.

The harness processes GTD state; it does not perform the user’s real-world work. The GTD two-minute rule therefore does not authorize external actions. If the capture itself is a clear physical action, represent it in the GTD system rather than pretending it was completed.

Use normal prose for clarification questions and final outcomes. The `gtd` CLI is the structured contract; no separate JSON response envelope is required.
