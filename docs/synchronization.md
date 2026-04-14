# Estratégia de Sincronização e Resolução de Conflitos

## 1. Visão Geral
Este documento detalha o protocolo de sincronização para o projeto **GTD on rails**, focado em garantir a integridade dos dados em um cenário de **usuário único utilizando múltiplos dispositivos** (PC Desktop e Notebook) de forma **offline-first**, utilizando o Git como transporte para um banco de dados **SQLite**.

---

## 2. Requisitos do Banco de Dados
Para suportar mesclagem lógica (Merge) sem um servidor central, todas as tabelas de entidades (Tarefas, Projetos, Notas, Materiais) devem seguir estes padrões:

### 2.1 Identificadores Únicos (UUID)
- Em vez de IDs incrementais (1, 2, 3...), todas as chaves primárias devem ser **UUIDs (v4)** gerados na aplicação.
- **Justificativa:** Evita colisões de ID quando dispositivos offline criam registros diferentes simultaneamente.

### 2.2 Timestamps de Controle (`updated_at`)
- Cada registro deve possuir uma coluna `updated_at` (Timestamp UTC).
- Toda operação de `UPDATE` deve atualizar este campo com o horário atual do sistema.
- **Justificativa:** Permite a aplicação da lógica *Last Write Wins* (LWW).

### 2.3 Exclusão Lógica (Soft Delete / Tombstones)
- Nenhuma linha deve ser removida fisicamente do banco de dados durante o uso normal.
- Utiliza-se uma coluna `is_deleted` (booleano) ou `deleted_at` (timestamp).
- **Justificativa:** Permite que um dispositivo saiba que o outro deletou um registro, evitando que ele seja "ressuscitado" como um novo registro durante o merge.

---

## 3. Protocolo de Sincronização (Merge Lógico)

Quando o Git detecta uma divergência (estado *ahead* e *behind* simultâneos), o backend executa o seguinte fluxo:

### 3.1 Detecção e Travamento
1. O app detecta o conflito de arquivos binários no Git.
2. A interface do usuário é bloqueada, exibindo o **Painel de Resolução de Conflitos**.

### 3.2 Execução do Merge via SQL
O backend anexa o banco de dados remoto (vinda do GitHub) ao banco local e executa as seguintes operações:

- **Inserção:** Insere registros que existem no remoto mas não no local.
- **Atualização (LWW):** Para registros com o mesmo UUID, compara o `updated_at`. O registro com o timestamp mais recente sobrescreve o antigo.
- **Deleção:** Se um registro está marcado como `is_deleted=true` no banco com o `updated_at` mais recente, ele é marcado como deletado em ambos.

---

## 4. Painel de Resolução de Conflitos

A UI do Tauri deve apresentar as seguintes opções ao usuário:

- **Mesclagem Automática (Recomendado):** O backend tenta unir os dados usando a lógica de timestamps.
- **Usar Versão Local (Sobrescrever Remoto):** Descarta as mudanças do GitHub e força a versão do dispositivo atual (`git push --force`).
- **Usar Versão Remota (Descartar Local):** Descarta as mudanças locais e adota integralmente o banco do GitHub (`git reset --hard`).

---

## 5. Mecanismo de Lock (Pessimista)

Para minimizar conflitos, utiliza-se um arquivo de trava no repositório:

1. **`data.lock`**: Arquivo contendo o nome do dispositivo, timestamp e um *heartbeat* opcional.
2. **Heartbeat:** O app atualiza o timestamp do lock a cada 10 minutos enquanto estiver aberto com conexão à internet.
3. **Stale Lock:** Se o lock for mais antigo que 30 minutos, o sistema oferece a opção de "Quebrar Lock", assumindo que o outro dispositivo crashou ou ficou offline.

---

## 6. Sincronização de Arquivos e Anexos

Materiais de referência (PDFs, imagens) seguem a mesma lógica de sincronização por arquivo, preferencialmente utilizando:
- **Git LFS:** Para arquivos grandes, garantindo que o repositório principal não fique lento.
- **UUID no Nome:** Arquivos renomeados com seu UUID para evitar conflitos de nomes de arquivos idênticos.
