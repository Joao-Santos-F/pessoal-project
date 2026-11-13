# Integração do upstream 0.5.2

Origem: https://github.com/mochiiwuff/capri-desktop/releases/tag/v0.5.2

- Base já incorporada: `5573f27` (v0.5.1).
- Nova referência incorporada: `c011764` (v0.5.2).
- Versão desta adaptação: `0.5.2`.

## Escopo

Todos os 18 arquivos alterados entre as tags foram comparados. Os quatro módulos de backend (`system`, `upkeep`, `devices`, `setups`) e os dois módulos de interface (`care`, `breaks`) foram adicionados. Foram integrados IPC/preload, menu, configuração, inicialização, traduções, temporizadores e comandos no chat. O README original atualizado fica em `README.upstream.md`; o README pessoal e a identidade do repositório foram preservados.

As alterações locais existentes antes da integração foram mantidas, incluindo personalidade acolhedora, vínculo, contexto de conversa, biblioteca Obsidian e testes. Cópias dos arquivos sobrepostos anteriores à integração estão em `out/integration-0.5.2/*.before` e subdiretórios (pasta ignorada pelo Git).

## Ajustes de compatibilidade

- Comandos explícitos `/pc` e demais comandos com barra mantêm o fluxo pessoal.
- Comandos locais reconhecidos da 0.5.2 têm prioridade sobre inferências genéricas de tarefas e não dependem da resposta de um modelo.
- Perguntas de diagnóstico e estado passam pelas proteções do chat; comandos negados, exemplos entre aspas e perguntas de instrução continuam sem executar alterações.
- Confirmação de energia e cancelamento de temporizadores funcionam offline sem duplicar o resultado no histórico.
- Instruções da IA reconhecem tanto os recursos do original quanto as ferramentas pessoais.

## Validação

- `npm test`: 73 testes Node e 13 verificações de regressão aprovados.
- Sintaxe dos módulos do processo principal verificada com `node --check`.
- `git diff --check`: sem erros; nenhum marcador de conflito nos arquivos de código.
- `npm run dist`: instalador NSIS para Windows.
- Executável empacotado iniciado com perfil temporário: módulos Care/Breaks carregados, menu de pausas presente, IPC de inatividade e consulta real de RAM pelo chat funcionando sem IA.

Os testes de limpeza, reinicialização e alterações do sistema usam substitutos controlados; não executam essas ações no computador do usuário. Dispositivos, winget e Xbox Game Bar dependem da disponibilidade do Windows e do hardware. O instalador não tem certificado de assinatura configurado, como nas compilações anteriores.

## Correções após a revisão ampliada

- Duplicados: elimina contagem dupla de pastas sobrepostas, compara novamente o hash completo antes de reciclar e mantém todo o grupo quando um arquivo mudou. O resultado revisado é válido por dez minutos e só pode ser usado uma vez; não inicia outra busca silenciosamente para remover novos arquivos.
- Downloads: rejeita diretórios, caminhos fora da pasta e travessia por links/junções antes de enviar um arquivo para a lixeira.
- Winget: distingue falha, ausência do executável, timeout e ausência de atualizações; uma falha de instalação ou da consulta posterior nunca é apresentada como sucesso. Os códigos seguem a [referência oficial do winget](https://github.com/microsoft/winget-cli/blob/master/doc/windows/package-manager/winget/returnCodes.md).
- Chat: ações oferecidas só aceitam um clique válido; encerrar ou iniciar outra conversa invalida os botões anteriores. Resultados atrasados não substituem uma conversa nova, e falhas síncronas ou de tarefas em segundo plano recebem uma resposta visível.
- As mensagens de busca expirada estão disponíveis nos cinco idiomas originais.

O código é preparado para envio à branch `main` do repositório pessoal. O instalador é gerado localmente; publicação de um release e instalação sobre o perfil pessoal são etapas separadas.
