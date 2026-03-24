# GTD on Rails

Monorepo base do projeto, mantido minimalista nesta fase.

## Estrutura

- `apps/desktop`: shell desktop com Tauri 2
- `apps/api`: backend Spring Boot com Gradle
- `packages/`: espaço reservado para código compartilhado
- `infra/`: infraestrutura local mínima
- `docs/`: documentação de arquitetura e decisões

## Comandos

- `pnpm install`
- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm check`

Na raiz:

- `pnpm dev`: sobe `desktop` e `api`
- `pnpm build`: compila o frontend do desktop e o backend
- `pnpm check`: valida TypeScript no desktop e roda testes da API
