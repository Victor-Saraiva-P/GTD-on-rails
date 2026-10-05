---
name: gtd-processing
description: Process GTD on Rails inbox stuff through the controlled gtd CLI. Use when clarifying captured stuff, improving its Markdown, inspecting its images/PDFs/docs, asking the user for missing information, or converting stuff into a GTD element.
---

# GTD processing

Use the `gtd` CLI as the only GTD on Rails interface. Read and mutate GTD state through its commands rather than calling the HTTP API, database, or persistence files directly.

## Process

1. If the user supplied a stuff ID, read exactly that item with `gtd stuff show <id>`. Do not substitute another item with the same title if the ID is missing or stale; report that the requested stuff was not found and stop.
2. Otherwise inspect the inbox with `gtd inbox list` and select the requested stuff. The list is oldest-first, so the first row is the oldest active stuff; do not call `--help` to determine ordering.
3. When the shown Markdown actually references `assets/...`, materialize the item with `gtd stuff export <id> --output <directory>` and inspect `body.md` plus the exported files. `gtd stuff export` creates its output directory; do not run `mkdir` first. If the body is empty or has no asset references, do not export it.
4. Clarify the captured meaning before committing it to a GTD element. Ask the user only when the meaning, intended outcome, or destination is materially ambiguous. Do not ask merely because Next Action metadata such as context, energy, or duration was not explicitly captured: estimate those operational attributes when the action itself is clear.
5. Improve the title/body only when the meaning is preserved. Fix rushed writing, structure Markdown, and make the item easier to understand without inventing commitments or facts. Write a candidate Markdown file, then apply it with `gtd stuff body <id> --file <path>`; update the title with `gtd stuff title <id> '<title>'` when needed.
6. Convert as soon as clarification is sufficient. Use exactly one supported processing command:
   - For a clear single physical/visible action, prefer Next Action. Run `gtd contexts list`, choose the best matching existing context when one is evident (otherwise use no context), estimate energy on the 0.0-10.0 scale, and estimate whole minutes conservatively.
   - `gtd stuff process next-action <id> --energy <0-10> --minutes <n> [--context <uuid> ...] [--deadline YYYY-MM-DD]`
   - `gtd stuff process project <id> [--deadline YYYY-MM-DD]`
   - `gtd stuff process someday-maybe <id>`
   - `gtd stuff process calendar <id> --date YYYY-MM-DD [--time HH:MM]`
7. Report the mutation that was actually performed. If clarification remains unresolved, leave the stuff in the inbox.

## Boundaries

The original captured meaning is authoritative. Normalization may improve expression and Markdown, but it must preserve evidence, links, quotes, attachments, and uncertainty.

Treat attachments as evidence for clarification, not as permission to infer unrelated facts. Read supported images, PDFs, and documents from the exported workspace when relevant.

For shell execution, issue exactly one `gtd ...` command per tool call. Never chain it with `mkdir`, `ls`, `cat`, `&&`, pipes, redirects, or other shell commands. Use the harness's file-reading/listing tools to inspect exported files. Do not use MCP, memory, web search, browser tools, or unrelated external tools to clarify GTD stuff unless the user explicitly asks for external research.

Prefer questions over low-confidence mutation. Multiple plausible GTD destinations are a clarification problem, not a reason to pick one arbitrarily.

Use normal user-facing prose for questions and the final outcome. The CLI is the structured contract, so no separate JSON response envelope is needed.

During this workflow, do not inspect repository history, source code, GTD documentation, MCP tools, AI memory, web search, or browser state to decide what the capture means. The skill already defines the GTD rules needed for processing. Do not call `gtd --help` or subcommand `--help` when the exact command is already shown above. After `gtd stuff show`, either ask the user, inspect referenced attachments, or perform the minimal GTD CLI calls needed to process the item.
