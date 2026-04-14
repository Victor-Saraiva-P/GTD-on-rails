# Documentação de Infraestrutura

## 1. Visão Geral

Este documento define a infraestrutura técnica do projeto, incluindo a stack principal, o modelo de execução, a estratégia de deploy, a abordagem de sincronização e o desenho de CI/CD.

O sistema é baseado em uma arquitetura desktop-first, priorizando simplicidade, portabilidade e baixo custo operacional através do uso de um banco de dados local sincronizado.

---

## 2. Stack Principal

### Frontend

- **Tauri 2**
- Aplicação desktop construída com tecnologias web
- Runtime leve com integração nativa com o sistema operacional

### Backend

- **Java + Spring Boot**
- API da aplicação executada localmente ou em servidor de apoio
- Responsável por acesso a dados, lógica de negócio e integrações

### Banco de Dados

- **SQLite**
- Banco relacional leve baseado em arquivo
- Armazena os dados estruturados de forma portátil e versionável

---

## 3. Arquitetura Em Alto Nível

O sistema é dividido em três camadas principais:

### 3.1 Cliente Desktop

Aplicação Tauri executada localmente na máquina do usuário.

Responsabilidades:

- renderizar a interface do usuário
- processar interações de teclado e comportamentos locais de UX
- se comunicar com o backend local/remoto por HTTP/HTTPS

### 3.2 Backend

Serviço Spring Boot responsável pela persistência e lógica.

Responsabilidades:

- expor as APIs da aplicação
- validar e processar operações recebidas
- gerenciar a conexão com o arquivo SQLite
- garantir a integridade dos dados e regras de negócio do usuário único

### 3.3 Camada De Banco De Dados

Arquivo SQLite local.

Responsabilidades:

- armazenar entidades da aplicação
- preservar a integridade relacional
- permitir o versionamento do estado da aplicação via Git

---

## 4. Topologia De Infraestrutura

### Topologia inicial

- **Execução Local:** Backend e SQLite rodando na mesma máquina que o cliente desktop.
- **Sincronização Distribuída:** O arquivo de banco de dados é sincronizado entre dispositivos via repositório Git privado.

### Estrutura sugerida

- `desktop app` → roda localmente
- `spring boot api` → roda localmente (ou em container leve)
- `sqlite file` → localizado em diretório controlado para sincronização
- `local storage` → diretório no sistema de arquivos para anexos e arquivos de referência

---

## 5. Estratégia De Sincronização De Dados

A sincronização é baseada no **versionamento do arquivo SQLite via Git**.

### Abordagem adotada

- O arquivo SQLite é tratado como um artefato de dados versionável.
- Sincronização entre diferentes máquinas (ex: desktop e notebook) via push/pull em repositório Git privado (ex: GitHub).
- Uso de branches específicas para dados para evitar poluição do histórico de código.

### Justificativa

Essa abordagem oferece:

- **Custo Zero:** Sem necessidade de hospedar e manter um servidor de banco de dados centralizado.
- **Simplicidade:** Aproveita a infraestrutura de controle de versão já existente.
- **Portabilidade:** Todo o estado da aplicação reside em um único arquivo fácil de mover.
- **Offline-First:** A aplicação funciona plenamente sem conexão constante, sincronizando apenas quando desejado.

---

## 6. Estratégia De Armazenamento De Arquivos

Anexos e materiais de referência são armazenados no sistema de arquivos.

### Abordagem

- arquivos são armazenados em **armazenamento local** (também passíveis de sincronização via ferramentas de arquivo ou Git LFS).
- o banco armazena apenas:
  - identificador do arquivo
  - caminho relativo
  - metadados
  - relacionamento com entidades de domínio

### Benefícios

- mantém o arquivo SQLite leve.
- estratégia de backup integrada com a de arquivos.
- menor acoplamento entre dados estruturados e binários.

---

## 7. Modelo De Execução

### Frontend (Tauri)

- distribuído como aplicação desktop binária.

### Backend (Spring Boot)

- executado como um processo local acompanhando o frontend.
- configurado para se conectar ao arquivo SQLite no caminho definido.

### Banco De Dados (SQLite)

- arquivo único de banco de dados (`.db` ou `.sqlite`).
- sem necessidade de serviço/daemon rodando em segundo plano.

---

## 8. Modelo De Ambientes

### Desenvolvimento e Produção

- A stack é idêntica em ambos os ambientes, simplificando o ciclo de desenvolvimento.
- Diferenciação apenas no caminho dos arquivos de dados e credenciais de sincronização.

---

## 9. Estratégia De Deploy

### Backend

- Empacotado como `.jar` ou container Docker leve.
- Execução simplificada sem dependências de serviços externos de banco de dados.

### Abordagem recomendada

- Execução via **Docker Compose** (opcional para o backend) ou diretamente via JRE.
- O arquivo SQLite é montado via volume se estiver em container.

---

## 10. Estratégia De CI/CD

O CI/CD valida o código e gera os binários de distribuição.

- **CI:** Testes unitários e de integração (usando SQLite em memória ou arquivo temporário).
- **CD:** Geração de releases do Tauri e artefatos do backend.

---

## 11. Rede E Acesso

- **Local:** Acesso direto via localhost entre frontend e backend.
- **Sincronização:** Requer acesso ao GitHub/Git remoto para troca de dados entre máquinas.

---

## 12. Linha De Base De Segurança

### Banco de dados

- Proteção por permissões de arquivo no sistema operacional.
- Criptografia em repouso opcional (via extensões SQLite se necessário).

### Pipeline e deploy

- Segredos do GitHub para sincronização armazenados de forma segura.

---

## 13. Backup E Recuperação

### Estratégia

- O próprio histórico do Git serve como sistema de backup versionado.
- Recomenda-se cópias periódicas do arquivo SQLite para armazenamento frio ou nuvem adicional.

---

## 14. Evolução Futura Da Infraestrutura

- Migração para PostgreSQL se a escala ou concorrência simultânea se tornar um requisito crítico no futuro.

---

## 15. Resumo Técnico

### Stack definida

- **Aplicação desktop:** Tauri 2
- **Backend:** Spring Boot com Java
- **Banco de dados:** SQLite

### Arquitetura definida

- Aplicação local autossuficiente.
- Sincronização de dados baseada em arquivo via Git.
- Foco em simplicidade, baixo custo e portabilidade.
