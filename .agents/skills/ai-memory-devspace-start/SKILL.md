---
name: ai-memory-devspace-start
description: Recupera o contexto do ai-memory e do projeto aberto no DevSpace.
disable-model-invocation: true
---

# Recuperar contexto para um chat novo

Use esta skill quando invocada manualmente no começo de um chat novo pelo DevSpace ou para retomar trabalho interrompido. Ela acrescenta a consulta de início que os hooks de sessão do ai-memory fariam em um harness compatível.

## 1. Confirmar acesso

Reutilize o `workspace_id` ativo do DevSpace. Se o projeto já foi indicado e ainda não há workspace aberto, abra esse projeto primeiro.

Confirme que as ferramentas MCP do ai-memory estão disponíveis. Se estiverem ausentes, informe que a memória não pode ser consultada nesta sessão e trabalhe apenas com o pedido atual e o checkout visível. Conclua aqui a recuperação de memória; não a apresente como realizada.

**Concluído quando:** o workspace está ativo e o MCP do ai-memory está disponível, ou a limitação foi explicada.

## 2. Resolver o escopo

Leia o `.ai-memory.toml` mais próximo no checkout e use o par explícito `workspace` e `project` em cada chamada MCP de projeto. Se o marcador não declarar ambos, peça os nomes exatos ao usuário ou obtenha-os da configuração do servidor antes de consultar memória. Trate esta integração como cliente MCP estático: não deduza o escopo pelo caminho e não use o último projeto ativo do servidor.

**Concluído quando:** os dois nomes exatos estão confirmados; sem eles, aguarde a resposta antes de fazer chamadas de projeto.

## 3. Recuperar a continuidade

Se já houver um handoff de `SessionStart` no contexto, use-o e avance para a validação. Caso contrário, chame `memory_handoff_list` com o escopo confirmado. Listar não consome handoffs.

- Para um único handoff aberto compatível com o pedido atual, chame `memory_handoff_accept` com o `handoff_id` listado.
- Para vários handoffs compatíveis, apresente resumos curtos e espere o usuário escolher antes de aceitar um. Após a escolha, aceite o `handoff_id` escolhido e continue.
- Sem handoff compatível, chame `memory_explore` para o panorama do projeto e `memory_query` para decisões, regras e gotchas relevantes ao pedido. Se ainda não há tarefa específica, busque o contexto mais útil para iniciar o trabalho.

**Concluído quando:** há um handoff escolhido e aceito, ou um panorama do projeto recuperado. Se houver várias opções, conclua após apresentar a lista e aguarde a escolha; nenhuma opção foi consumida.

## 4. Validar e devolver o contexto

Confira decisões, caminhos e próximos passos contra as instruções carregadas pelo DevSpace e o checkout atual. Quando um resultado trouxer apenas um trecho de uma página relevante, abra a página completa com `memory_read_page`. Trate a memória como evidência histórica. Use `global_scope_hits`, se retornado por uma consulta do projeto, como preferências padrão quando não houver instruções atuais mais específicas.

Apresente objetivo e estado atual, decisões e tentativas relevantes, questões em aberto e o próximo passo. Separe o que foi confirmado no checkout do que ainda pode estar desatualizado. Continue o trabalho apenas quando o pedido atual indicar que o usuário quer retomá-lo.

**Concluído quando:** o usuário recebeu um resumo verificável com estado, incertezas e próximo passo.

## Relação com outras skills

Esta skill complementa a skill gerenciada `ai-memory-handoff`: ela executa a recuperação proativa de início de chat e aplica uma escolha segura quando há vários handoffs. O MCP sozinho não comprova que mensagens e chamadas de ferramenta do DevSpace foram capturadas por hooks; baseie o resumo no conteúdo que as ferramentas realmente retornaram.
