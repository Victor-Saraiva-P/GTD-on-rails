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
- `pnpm build:prod`
- `pnpm build:staging`
- `pnpm staging`
- `pnpm e2e`
- `pnpm lint`
- `pnpm check`

Na raiz:

- `pnpm dev`: sobe `desktop` e `api`
- `pnpm build`: compila o frontend do desktop e o backend
- `pnpm build:prod`: cria a build Tauri release com backend sidecar usando `prod,sidecar`
- `pnpm build:staging`: cria a build Tauri release com backend sidecar usando `staging,sidecar`
- `pnpm staging`: cria a build staging e executa o binário release
- `pnpm check`: valida TypeScript no desktop e roda testes da API

As builds Tauri geram o binário em `apps/desktop/src-tauri/target/release/desktop`.

Use `pnpm build:prod` para o runtime real (`gtd-on-rails`, branch `main`, remoto `gdrive:gtd-on-rails`) e `pnpm build:staging` para testar o mesmo fluxo de sidecar com dados de desenvolvimento (`dev-gtd-on-rails`, branch `dev`, remoto `gdrive:dev-gtd-on-rails`).

## Sincronização

O projeto utiliza o Git para sincronizar um banco de dados **SQLite** entre dispositivos (PC e Notebook). 

- **Estratégia:** O arquivo do banco é versionado em um repositório Git privado.
- **Premissa:** Uso sequencial dos dispositivos pelo usuário único, eliminando a necessidade de travas de concorrência (`data.lock`) nesta fase.
- **Detalhes:** Veja a documentação completa em [docs/synchronization.md](./docs/synchronization.md).
