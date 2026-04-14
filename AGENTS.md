# Repository Guidelines

## Estrutura Do Projeto

Este repositório é um monorepo minimalista.

- `apps/desktop`: shell desktop com Vite e Tauri 2. O frontend fica em `src/`; a parte Rust/Tauri fica em `src-tauri/`.
- `apps/api`: backend Spring Boot. Código em `src/main/java`; recursos em `src/main/resources`; testes em `src/test/java`.
- `packages/`: espaço reservado para bibliotecas compartilhadas.
- `infra/compose.yaml`: infraestrutura local para PostgreSQL e API.
- `docs/`: documentação de arquitetura e infraestrutura.

## Comandos De Build, Teste E Desenvolvimento

Execute a partir da raiz, salvo quando indicado.

- `pnpm install`: instala as dependências do workspace.
- `pnpm dev`: sobe o app desktop em modo de desenvolvimento com Tauri.
- `pnpm build`: gera o bundle web do desktop via Turbo.
- `pnpm lint`: roda checagens de TypeScript do desktop.
- `pnpm check`: executa validações do workspace.
- `./gradlew test` em `apps/api`: roda os testes do backend.
- `./gradlew bootRun` em `apps/api`: sobe a API localmente.
- `docker compose -f infra/compose.yaml up`: sobe PostgreSQL e a API em container.

## Estilo De Código E Convenções De Nomes

Siga o `.editorconfig`: UTF-8, LF, newline final, 2 espaços por padrão e 4 espaços para arquivos Java, Groovy e Kotlin.

- TypeScript: use `camelCase` para variáveis e funções, `PascalCase` para classes.
- Java: mantenha o pacote em `com.gtdonrails.api`; use `PascalCase` para classes e `camelCase` para membros.
- Prefira nomes descritivos como `ApiApplication.java` e `vite.config.ts`.

## Diretrizes De Testes

- O backend usa JUnit através do starter de testes do Spring Boot.
- Classes de teste Java devem usar o sufixo `*Tests`.
- No desktop, a validação atual passa por `pnpm lint` e `pnpm check`.
- Ao adicionar comportamento no backend, adicione testes junto.

## Commits E Pull Requests

Use mensagens curtas no estilo Conventional Commits, como no histórico:

- `feat: adiciona os esqueletos de desktop e api`
- `chore: inicializa a estrutura do monorepo`

Pull requests devem incluir:

- resumo claro da mudança
- áreas impactadas, como `apps/desktop`, `apps/api` ou `infra`
- validações executadas
- screenshots apenas quando houver mudança visual no desktop

## Notas De Ambiente

Builds do Tauri no Linux exigem bibliotecas nativas do WebKitGTK. Se `cargo check` falhar em `apps/desktop/src-tauri`, verifique a instalação de `webkit2gtk-4.1` e `javascriptcoregtk-4.1`.
