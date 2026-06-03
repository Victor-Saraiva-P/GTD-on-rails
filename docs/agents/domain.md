# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

## Before exploring, read these

- **`CONTEXT-MAP.md`** at the repo root. It points at one `CONTEXT.md` per context. Read each one relevant to the topic.
- **`docs/10 - Architecture/`** for infrastructure, synchronization, runtime, persistence, asset, CI, and release decisions.
- **`docs/20 - GTD/`** for domain language, GTD workflow, body content, list/page behavior, and keybinding rules.
- **`docs/30 - Guides and Manuals/`** for API and desktop execution guidance.
- **`docs/adr/`** for system-wide decisions that touch the area you're about to work in.
- **`apps/<context>/docs/adr/`** for context-scoped decisions when they exist.

If any `CONTEXT.md` or ADR files don't exist, proceed silently. Don't flag their absence; don't suggest creating them upfront. The producer skill (`/grill-with-docs`) creates them lazily when terms or decisions actually get resolved.

Use `docs` as the canonical knowledge base when a context file does not exist yet.

## File structure

This repo uses a multi-context layout:

```text
/
├── CONTEXT-MAP.md
├── docs/adr/
├── docs/10 - Architecture/
├── docs/20 - GTD/
├── docs/30 - Guides and Manuals/
├── apps/api/
│   ├── CONTEXT.md
│   └── docs/adr/
└── apps/desktop/
    ├── CONTEXT.md
    └── docs/adr/
```

## Use the glossary's vocabulary

When your output names a domain concept in an issue title, refactor proposal, hypothesis, or test name, use the term as defined in the relevant `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids.

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use, or there's a real gap to note for `/grill-with-docs`.

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because..._
