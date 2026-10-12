---
name: ai-memory-devspace-handoff
description: Registra no ai-memory um handoff com o estado observado no workspace do DevSpace.
disable-model-invocation: true
---

# Registrar a continuidade da sessão

Use esta skill quando invocada manualmente antes de encerrar um chat do DevSpace, trocar de agente ou salvar o estado para uma próxima sessão. Ela grava um handoff de uso único, não uma página durável.

## 1. Confirmar acesso e escopo

Confirme o workspace atual e reutilize seu `workspace_id`. Se o projeto foi indicado e ainda não há workspace aberto, abra esse projeto. Confirme que o MCP do ai-memory está disponível. Se estiver ausente, prepare um resumo copiável, informe que ele não foi salvo no servidor e encerre a skill.

Leia o `.ai-memory.toml` mais próximo e use o par explícito `workspace` e `project`. Se ambos não estiverem declarados, obtenha os nomes exatos do usuário ou da configuração do servidor antes de gravar. Trate esta integração como cliente MCP estático; o caminho do checkout e o último projeto ativo não determinam o escopo.

**Concluído quando:** o escopo está confirmado e o MCP está disponível, ou há um resumo alternativo claramente marcado como não salvo.

## 2. Reconstituir o estado

Use a conversa atual e o estado visível do workspace. Para cada item, retenha somente o que estiver confirmado:

- objetivo e resultado alcançado;
- decisões e tentativas que falharam;
- arquivos alterados e estado das mudanças;
- verificações já executadas e seus resultados;
- questões pendentes e próximo passo concreto.

Consulte o resumo de mudanças do DevSpace ou uma fonte de estado somente de leitura quando faltar algum detalhe. Registre verificações já realizadas; a criação do handoff não exige rodar testes.

**Concluído quando:** cada fato do resumo tem evidência na conversa ou no workspace, e dúvidas estão marcadas como pendentes.

## 3. Gravar o handoff

Chame `memory_handoff_begin` com o escopo confirmado e os campos aceitos pelo esquema MCP ativo. Escreva um resumo curto e autossuficiente, com o estado necessário para outro agente continuar e os próximos passos em ordem.

Mantenha o handoff privado por padrão. Marque-o como compartilhado somente quando o usuário pedir isso explicitamente. Omita credenciais, segredos e dados pessoais. Para conhecimento que deve durar além da próxima sessão, use a skill gerenciada de páginas duráveis do ai-memory em vez do handoff.

**Concluído quando:** o servidor confirma a criação e fornece um `handoff_id`; reporte esse identificador ao usuário. Se a gravação falhar, entregue o resumo copiável e diga que não há handoff salvo.

## Relação com outras skills

Esta skill complementa a skill gerenciada `ai-memory-handoff`. O comportamento de handoff permanece o mesmo; este fluxo coleta explicitamente o estado da conversa e do workspace, que hooks do ai-memory não registram automaticamente em uma sessão DevSpace sem integração de ciclo de vida.
