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

## Sincronização

O projeto utiliza o Git para sincronizar um banco de dados **SQLite** entre dispositivos (PC e Notebook). 

- **Estratégia:** O arquivo do banco é versionado em um repositório Git privado.
- **Premissa:** Uso sequencial dos dispositivos pelo usuário único, eliminando a necessidade de travas de concorrência (`data.lock`) nesta fase.
- **Detalhes:** Veja a documentação completa em [docs/synchronization.md](./docs/synchronization.md).
