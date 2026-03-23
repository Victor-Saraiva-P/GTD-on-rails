# Documentação de Infraestrutura

## 1. Visão Geral

Este documento define a infraestrutura técnica do projeto, incluindo a stack principal, o modelo de execução, a estratégia de deploy, a abordagem de sincronização e o desenho de CI/CD.

O sistema é baseado em uma arquitetura desktop-first, com backend e banco de dados centralizados, priorizando simplicidade, baixo custo operacional e manutenibilidade.

---

## 2. Stack Principal

### Frontend

- **Tauri 2**
- Aplicação desktop construída com tecnologias web
- Runtime leve com integração nativa com o sistema operacional

### Backend

- **Java + Spring Boot**
- API central da aplicação
- Responsável por acesso a dados, sincronização, autenticação e integrações futuras

### Banco de Dados

- **PostgreSQL**
- Banco relacional principal
- Armazena os dados estruturados da aplicação

---

## 3. Arquitetura Em Alto Nível

O sistema é dividido em três camadas principais:

### 3.1 Cliente Desktop

Aplicação Tauri executada localmente na máquina do usuário.

Responsabilidades:

- renderizar a interface do usuário
- processar interações de teclado e comportamentos locais de UX
- se comunicar com o backend por HTTP/HTTPS
- suportar cache local leve em iterações futuras, se necessário

### 3.2 Backend Central

Serviço Spring Boot executado na máquina principal do servidor.

Responsabilidades:

- expor as APIs da aplicação
- validar e processar operações recebidas
- centralizar a sincronização entre dispositivos
- aplicar autenticação e autorização
- suportar integrações futuras e operações em segundo plano

### 3.3 Camada De Banco De Dados

Instância PostgreSQL conectada ao backend.

Responsabilidades:

- armazenar entidades da aplicação
- preservar a integridade relacional
- suportar filtros, consultas e histórico
- atuar como fonte única da verdade para dados estruturados

---

## 4. Topologia De Infraestrutura

### Topologia inicial

- **1 máquina principal** hospedando backend e PostgreSQL
- **clientes desktop** conectando ao backend
- acesso local em rede por padrão
- acesso remoto por túnel seguro ou exposição controlada no futuro

### Estrutura sugerida

- `desktop app` → roda localmente em cada máquina cliente
- `spring boot api` → roda no servidor principal
- `postgres` → roda no mesmo servidor principal
- `local storage` → diretório no sistema de arquivos para anexos e arquivos de referência

---

## 5. Estratégia De Sincronização De Dados

A sincronização é baseada em um **modelo de servidor centralizado**, evitando replicação direta entre bancos locais.

### Abordagem adotada

- todos os clientes se comunicam com o mesmo backend
- o backend lê e grava em um banco PostgreSQL centralizado
- o PostgreSQL atua como **fonte única da verdade**
- conflitos de concorrência são tratados na camada da aplicação

### Justificativa

Essa abordagem reduz:

- complexidade de merge entre dispositivos
- riscos de corrupção de dados
- custo operacional de sincronização distribuída
- necessidade de estratégias de sincronização baseadas em arquivos

---

## 6. Estratégia De Armazenamento De Arquivos

Anexos e materiais de referência não são armazenados diretamente dentro do banco.

### Abordagem

- arquivos são armazenados em **armazenamento local no servidor**
- o banco armazena apenas:
  - identificador do arquivo
  - caminho físico/lógico
  - metadados
  - relacionamento com entidades de domínio

### Benefícios

- melhor desempenho do banco de dados
- estratégia de backup mais simples
- menor acoplamento entre dados estruturados e arquivos binários

---

## 7. Modelo De Execução

### Frontend (Tauri)

- distribuído como aplicação desktop
- binário leve
- otimizado para uso inicial em Linux
- builds futuras para outros sistemas operacionais continuam possíveis

### Backend (Spring Boot)

- roda como serviço independente
- empacotado como `.jar`
- pode ser executado diretamente ou por containers

### Banco De Dados (PostgreSQL)

- roda como serviço dedicado
- dados persistentes armazenados em volumes isolados
- com backups periódicos

---

## 8. Modelo De Ambientes

### Desenvolvimento

- frontend e backend executados separadamente
- instância local de PostgreSQL para desenvolvimento
- comunicação local entre app Tauri e API backend

### Produção inicial

- uma máquina principal hospedando:
  - aplicação backend
  - PostgreSQL
  - diretório local para armazenamento de anexos

---

## 9. Estratégia De Deploy

### Opções de execução do backend

#### Opção A — Execução direta

- Java instalado no servidor
- Spring Boot executando como serviço do sistema

#### Opção B — Execução em containers

- backend em container
- PostgreSQL em container ou serviço separado
- orquestração via Docker Compose

### Abordagem recomendada

- **Docker Compose para backend e banco**
- aplicação desktop Tauri executando localmente nas máquinas clientes

Isso oferece:

- isolamento mais claro entre serviços
- portabilidade
- migração mais simples para outra máquina
- manutenção operacional mais simples

---

## 10. Estratégia De CI/CD

O projeto utiliza CI/CD para validar mudanças no código, gerar artefatos de build e automatizar o deploy do backend.

### 10.1 Integração Contínua (CI)

O CI é responsável por:

- validar mudanças no frontend
- executar testes do backend
- verificar a integridade dos builds
- impedir que mudanças quebradas avancem para o deploy

### 10.2 Entrega Contínua / Deploy Contínuo (CD)

O CD é aplicado principalmente ao backend.

Fluxo esperado:

1. um novo commit ou merge na branch principal dispara o workflow
2. o GitHub Actions executa o pipeline de CI
3. se o CI for aprovado, o job de deploy se torna elegível
4. o job de deploy é executado automaticamente no servidor principal

---

## 11. Self-Hosted Runner

Para suportar deploy automatizado em uma máquina local, a infraestrutura utiliza um **self-hosted runner**.

### Definição

Um self-hosted runner é um agente do GitHub Actions executando em uma máquina controlada pelo dono do projeto.

Ele:

- permanece online e disponível para receber jobs
- **não** monitora commits por conta própria
- recebe jobs apenas quando o GitHub dispara um workflow e encaminha um job compatível

### Papel na arquitetura

- executar jobs de deploy dentro do servidor principal
- permitir entrega automática do backend sem depender de infraestrutura cloud paga
- acessar diretamente containers, arquivos, serviços e volumes locais

### Comportamento esperado

- o runner permanece ocioso e disponível
- o GitHub detecta eventos no repositório, como `push` ou `merge`
- o GitHub executa o CI
- somente se o CI passar, o GitHub envia o job de deploy para o self-hosted runner
- se o CI falhar, o deploy não é executado

### Uso recomendado

- **GitHub-hosted runners** para validação, testes e etapas de build
- **self-hosted runner** no servidor principal para deploy do backend

---

## 12. Separação De Workflows

O pipeline deve ser separado em workflows distintos.

### Workflow de CI

Responsabilidades:

- lint/build/test do frontend
- execução de testes do backend
- validações gerais

### Workflow de deploy do backend

Responsabilidades:

- buscar código ou artefatos atualizados
- reconstruir containers
- reiniciar serviços do backend
- manter dados do banco e volumes persistentes intactos

### Workflow de release do desktop

Responsabilidades:

- build da aplicação Tauri
- geração de artefatos
- suporte a futura automação de release do cliente desktop

---

## 13. Rede E Acesso

### Acesso local

- comunicação pela rede local entre clientes e servidor

### Acesso remoto

- preferência por túnel seguro nas fases iniciais
- exposição pública direta apenas se necessária no futuro

### Objetivo

Evitar:

- portas abertas desnecessariamente
- complexidade prematura de rede e segurança
- dependência de infraestrutura pública paga

---

## 14. Linha De Base De Segurança

### Banco de dados

- acessível apenas pelo backend
- nunca exposto diretamente ao cliente desktop
- credenciais armazenadas por variáveis de ambiente ou gerenciamento de segredos

### Backend

- autenticação centralizada
- validação de entrada
- controle de sessão/token
- separação clara entre configuração de desenvolvimento e produção

### Armazenamento de arquivos

- nomes internos de arquivo não previsíveis
- organização controlada de diretórios
- acesso aos arquivos mediado pelo backend quando necessário

### Pipeline e deploy

- deploy em produção condicionado ao sucesso do CI
- runner de deploy restrito ao servidor principal
- segredos e credenciais fora do código-fonte
- automação de produção isolada das rotinas locais de desenvolvimento

---

## 15. Backup E Recuperação

### Banco de dados

- backups periódicos do PostgreSQL
- retenção de múltiplas versões de backup

### Arquivos

- cópia periódica do diretório de armazenamento local

### Objetivo

Garantir capacidade de recuperação em caso de:

- falha de disco
- erro humano
- corrupção de dados
- atualização mal sucedida ou deploy quebrado

---

## 16. Evolução Futura Da Infraestrutura

A arquitetura escolhida permite expansão futura para:

- cache local no cliente
- suporte offline parcial
- sincronização em tempo real via WebSocket
- separação entre servidor de aplicação e servidor de banco
- armazenamento externo compatível com S3
- mecanismos de autenticação mais robustos
- logs centralizados e observabilidade
- releases automatizadas do desktop
- suporte futuro a auto-update do Tauri

---

## 17. Resumo Técnico

### Stack definida

- **Aplicação desktop:** Tauri 2
- **Backend:** Spring Boot com Java
- **Banco de dados:** PostgreSQL

### Arquitetura definida

- clientes desktop se conectam a um backend centralizado
- o backend se conecta a um banco PostgreSQL centralizado
- arquivos são armazenados fora do banco em armazenamento local
- a sincronização é realizada por um modelo centralizado de servidor
- o CI valida mudanças antes do deploy
- o deploy do backend é executado automaticamente por um self-hosted runner no servidor principal

### Princípios principais da infraestrutura

- simplicidade operacional
- baixo custo
- confiabilidade
- sincronização centralizada
- manutenibilidade
- automação segura de build e deploy
