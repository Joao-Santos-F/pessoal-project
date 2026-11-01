# Capri — versão pessoal com automação e Obsidian

Assistente de desktop para Windows, construída com Electron, com personagem animada, chat com IA, comandos locais e integração com Obsidian. Versão atual: **0.4.10**, disponível como código-fonte e instalador para Windows.

## Novidades da versão 0.4.10

Este release reúne as melhorias desenvolvidas nas versões 0.4.8, 0.4.9 e 0.4.10 desde o último release público, 0.4.7.

| Área | O que mudou |
|---|---|
| Abertura de aplicativos | `/open` procura também no PATH, em atalhos e em pastas comuns de instalação. Nomes ambíguos oferecem escolha; programas não encontrados podem ser selecionados manualmente, com o caminho lembrado para pedidos futuros. |
| Comandos em outros idiomas | Aliases em nove idiomas, incluindo `/open`, `/run`, `/help`, `/obsidian open`, `/obsidian read` e `/obsidian daily`. Os argumentos não são traduzidos. |
| Guia no chat | Digitar `/` mostra sugestões com descrições e exemplos. Setas navegam, Tab ou Enter completam e Esc fecha. Selecionar não executa o comando. |
| Pesquisa no Obsidian | `/obsidian pesquisar` ou `/obsidian find` devolve caminhos e trechos no chat, ignorando diferenças de acento e maiúsculas. |
| Diário | `/obsidian diario` ou `/obsidian daily` cria ou abre a nota da data local, preservando conteúdo existente. |
| Biblioteca do cofre | O gerador passou de 104 para 112 notas, com oito guias de uso diário, caixa de entrada, organização, pesquisa e solução de problemas. |
| Conversa e personalidade | Respostas com ritmo mais flexível, continuidade do assunto e atenção a desabafos, conquistas e correções sobre o tom emocional, sem obrigar uma pergunta a cada resposta. |
| Confiabilidade | 60 testes automatizados aprovados (48 testes Node e 12 regressões), além da verificação do menu e do executável com perfil isolado. |

**Para atualizar:** feche a Capri e execute o [instalador 0.4.10](https://github.com/Joao-Santos-F/pessoal-project/releases/download/v0.4.10/Capri-Setup-0.4.10.exe). Para adicionar os oito guias a um cofre já preparado, execute `node scripts/prepare-capri-vault.cjs` pelo código-fonte, conforme a seção de biblioteca; notas existentes são preservadas. A atualização do instalador, por si só, não recria sua biblioteca.

A conversa continua dependendo do modelo configurado: a Capri interpreta o texto, não conhece sentimentos ocultos. A descoberta de programas tem limites; o seletor de executável e o caminho completo atendem aos casos fora do catálogo. Veja os detalhes nas seções abaixo.

**Esta versão foi programada inteiramente a partir do repositório [mochiiwuff/capri-desktop](https://github.com/mochiiwuff/capri-desktop), utilizando o Codex na implementação das adaptações, revisões, documentação e testes, sob orientação de João Santos.**

**Todos os créditos pela criação do projeto original, sua base de código, conceito e implementação original pertencem a [mochiiwuff](https://github.com/mochiiwuff) e aos respectivos colaboradores.** Esta é uma adaptação pessoal desse trabalho, não uma criação independente do zero.

### Contribuidores e ferramentas de IA

**As adaptações desta versão foram implementadas com IA, por meio do Codex, sob orientação de João Santos.** A autoria e os créditos da base original permanecem preservados.

| Crédito | Participação |
|---|---|
| [mochiiwuff / capri-desktop](https://github.com/mochiiwuff/capri-desktop) | Criação do projeto original, conceito e base de código. |
| [João Santos](https://github.com/Joao-Santos-F) | Orientação das adaptações, definição dos pedidos e manutenção desta versão. |
| [OpenAI / Codex](https://github.com/openai/codex) | Ferramenta de IA utilizada para implementar as adaptações, revisar código, executar testes, documentar e preparar a publicação. |
| [Anthropic / Claude Code](https://github.com/anthropics/claude-code) | Ferramenta de IA reconhecida nos créditos e integrada ao projeto original por meio de hooks e chat. |

Veja [CONTRIBUTORS.md](CONTRIBUTORS.md) para os detalhes das atribuições. Os créditos às ferramentas reconhecem suas funções; não indicam participação institucional ou endosso da OpenAI ou da Anthropic.

- Original: <https://github.com/mochiiwuff/capri-desktop>
- Esta adaptação: <https://github.com/Joao-Santos-F/pessoal-project>
- [README original em inglês](README.upstream.md) · [documentação em francês](README.fr.md) · [guia do Obsidian](docs/OBSIDIAN-PT.md).

## O que o projeto faz

Não é apenas um script: é um aplicativo Electron. A janela desenha a Capri sobre o desktop; o processo principal integra IA, recursos do Windows e arquivos locais.

| Recurso | Funcionamento |
|---|---|
| Personagem de desktop | Animações, falas, sons e reações conforme as configurações. |
| Chat com IA | Usa Ollama, provedores compatíveis ou o fluxo separado do Claude Code. Modelos não vêm incluídos. |
| Assistentes de programação | Hooks opcionais para acompanhar Claude Code, Codex e Antigravity. |
| Abertura de aplicativos | Procura no menu Iniciar, em executáveis registrados e launchers compatíveis; também aceita caminho completo ou seleção de arquivo. |
| PowerShell | Executa o comando exato informado após confirmação, mostrando saída e erros. |
| Tarefas `/pc` | A IA planeja até oito etapas e recebe os resultados das ferramentas antes de continuar. |
| Informações do PC | Consulta CPU, RAM, GPU, discos, pastas e programas; consultas básicas são locais. |
| Cálculos | Avalia expressões aritméticas localmente, sem executar código arbitrário como expressão. |
| Obsidian | Lista, lê, cria, acrescenta e abre notas; utiliza a CLI oficial para comandos internos quando habilitada. |
| Biblioteca | Um script adiciona 112 notas com guias, modelos, rotinas, central do dia, 56 objetos/conceitos, 477 textos do aplicativo e 40 sugestões de falas. |
| Pesquisa local e diário | A partir da 0.4.8, pesquisa títulos e conteúdo no chat e cria ou abre notas diárias sem sobrescrever o texto existente. |
| Histórico automático | Salva o texto do chat da Capri, inclusive resultados locais e erros, em notas Markdown no cofre. |

A execução de ações internas depende de CLI, API ou controles acessíveis do aplicativo. Não há garantia de controle universal de qualquer interface, e tarefas em linguagem natural dependem da qualidade do modelo.

## Requisitos

- **Windows 10/11 de 64 bits**: plataforma utilizada nesta adaptação e seus testes.
- **Node.js 22.12.0 ou superior**, com npm, para executar pelo código-fonte ou gerar o instalador.
- **Git** para clonar, ou um ZIP do repositório extraído em uma pasta.
- **Obsidian**, para integração de notas e arquivamento em cofre.
- **Ollama com um modelo instalado**, ou outro provedor configurado, para conversas com IA e planejamento `/pc`.

Os comandos locais `/abrir`, `/executar` e `/obsidian` podem funcionar sem modelo. Downloads iniciais de dependências, Electron e modelos exigem internet. Provedores remotos podem exigir conta, chave e pagamento próprios.

## Instalação rápida no Windows

**[Baixar Capri-Setup-0.4.10.exe](https://github.com/Joao-Santos-F/pessoal-project/releases/download/v0.4.10/Capri-Setup-0.4.10.exe)** · [Último release](https://github.com/Joao-Santos-F/pessoal-project/releases/latest)

1. Baixe o instalador acima, para Windows 10/11 de 64 bits.
2. Feche a Capri caso esteja aberta e execute o `.exe`.
3. Abra a Capri pelo atalho e configure o provedor de IA e o cofre do Obsidian conforme as seções abaixo.

Não é necessário instalar Git ou Node.js para usar o instalador. Modelos de IA e o Obsidian são configurados separadamente. O instalador não tem assinatura digital; o Windows pode exibir um aviso do SmartScreen. Confira a origem do download e, se decidir prosseguir, use **Mais informações → Executar assim mesmo**. O release inclui um arquivo `SHA256SUMS.txt` para conferir a integridade do download.

Este download é da adaptação pessoal de João Santos, desenvolvida com Codex a partir do projeto de mochiiwuff. Os releases originais estão [no repositório do autor](https://github.com/mochiiwuff/capri-desktop/releases).

## Instalar e executar pelo código-fonte

Abra o PowerShell na pasta onde deseja guardar o projeto:

```powershell
git clone https://github.com/Joao-Santos-F/pessoal-project.git
cd pessoal-project
npm ci
npm start
```

`npm ci` instala as versões registradas em `package-lock.json`. `npm start` abre a Capri. Siga a configuração inicial e use o menu na bandeja do Windows para escolher idioma, provedor, modelo e comportamento. `Ctrl+Alt+C` alterna a visibilidade da personagem; **Sair** encerra o aplicativo.

Para desenvolvimento:

```powershell
npm run dev
```

Esse modo habilita rotas locais de depuração. Use `npm start` para uso normal.

## Gerar e instalar o executável

Depois de instalar as dependências:

```powershell
npm run dist -- --publish never
```

O resultado fica em `dist/Capri-Setup-0.4.10.exe`, com a versão descompactada em `dist/win-unpacked/Capri.exe`.

1. Feche a Capri que estiver em execução.
2. Execute `Capri-Setup-0.4.10.exe`.
3. Abra a Capri pelo atalho criado.

A instalação é por usuário. O projeto não configura certificado de assinatura. Para usar um instalador já gerado, não é necessário instalar Node.js. Os executáveis ficam nos [assets dos releases](https://github.com/Joao-Santos-F/pessoal-project/releases), fora do histórico Git; você também pode gerá-los pelo comando acima. `--publish never` impede publicação automática pelo electron-builder.

## Guia de comandos e idiomas

Digite `/` no início da mensagem para abrir a lista. Continue digitando para filtrar; `/obsidian ` mostra os subcomandos e `/obsidian history ` mostra as opções de histórico. Use **↑/↓** para navegar, **Tab ou Enter** para completar, **Esc** para fechar ou clique numa opção. Selecionar apenas preenche o campo; envie a mensagem para executar.

Os comandos têm aliases em português, inglês, espanhol, francês, russo, alemão, italiano, chinês e japonês, independentes do idioma da interface. São palavras cadastradas, não tradução automática de qualquer idioma. Argumentos como nomes de arquivos, textos e scripts não são traduzidos.

| Português | Inglês | Função |
|---|---|---|
| `/ajuda` | `/help` | Guia de comandos |
| `/abrir Spotify` | `/open Spotify` | Abrir aplicativo |
| `/executar Get-Date` | `/run Get-Date` | PowerShell com confirmação |
| `/obsidian abrir Pasta/Nota.md` | `/obsidian open Pasta/Nota.md` | Abrir nota |
| `/obsidian ler Pasta/Nota.md` | `/obsidian read Pasta/Nota.md` | Ler nota |
| `/obsidian pesquisar termo` | `/obsidian find termo` | Pesquisa no chat |
| `/obsidian buscar termo` | `/obsidian search termo` | Pesquisa na janela do Obsidian |
| `/obsidian diario` | `/obsidian daily` | Diário |
| `/obsidian historico ativar` | `/obsidian history enable` | Ativar arquivamento |

Exemplos adicionais: `/obsidian lire Pasta/Nota.md`, `/obsidian leer Pasta/Nota.md`, `/obsidian читать Pasta/Nota.md`. A lista mostra descrições em português e inglês; `/help` apresenta o guia. Novos aliases podem ser adicionados em `src/shared/commands.js`.

## Abrir aplicativos e conversar (0.4.10)

`/open NOME` e `/abrir NOME` procuram no menu Iniciar, nos aplicativos registrados, nos jogos Steam/Epic, em atalhos, no PATH e em pastas comuns de instalação. A busca adicional é limitada a 16 mil entradas, com profundidade limitada e sem seguir junções. Não varre todos os discos.

Se houver mais de uma opção, a Capri mostra nomes e destinos para você escolher. Se não encontrar, abre um seletor: indique o executável. Depois de uma abertura bem-sucedida, o nome escolhido fica associado ao caminho no perfil local, para os próximos pedidos. Você também pode usar `/open "C:\Pasta\Programa.exe"` ou `/open choose`. Um executável movido ou removido precisará ser selecionado novamente. São lembrados até 100 nomes; atalhos e executáveis ainda respeitam as confirmações de execução.

Isso não garante que todo programa possa iniciar: permissões do Windows, arquivos ausentes e problemas do próprio aplicativo continuam valendo. A resposta “abertura solicitada” não afirma que a janela carregou corretamente.

A conversa usa o diálogo recente para manter o assunto, variar o ritmo e interpretar o tom. A personalidade continua brincalhona, curiosa e calorosa, com gírias ocasionais. A Capri pode acolher um desabafo, celebrar uma conquista e ajustar o tom quando você corrige sua interpretação, sem exigir uma pergunta em toda resposta.

É uma interpretação de fã com IA, não uma reprodução garantida da personagem original nem leitura de sentimentos. As emoções são hipóteses baseadas no texto; não são gravadas como um perfil emocional. Não há reconhecimento emocional por câmera ou microfone. A qualidade da conversa depende do modelo configurado, e modelos pequenos podem repetir frases ou fazer perguntas em excesso. O histórico de chat continua seguindo suas configurações de arquivamento.

Exemplos: “Só quero desabafar, sem conselhos agora”, “Não estou triste, estou com raiva”, “Vamos continuar de onde paramos”. Esses pedidos orientam o diálogo; não acionam tarefas do computador por conta própria.

## Configurar a IA

### Ollama local

1. Instale e abra o [Ollama](https://ollama.com/).
2. Baixe um modelo adequado ao seu computador. Exemplo:

   ```powershell
   ollama pull llama3.2
   ```

3. No menu da Capri, selecione Ollama e o modelo instalado.
4. Teste primeiro uma conversa curta.

O exemplo não garante bom desempenho para automação. No ambiente de desenvolvimento, `llama3.2:latest` respondeu ao chat, mas excedeu o limite em um teste de planejamento complexo. Cálculos e comandos locais não dependem desse planejamento.

### Outros provedores

Use a configuração do aplicativo para escolher o provedor e informar os dados necessários. A implementação inclui servidores compatíveis com OpenAI, como LM Studio, e serviços remotos. Nunca coloque chaves em arquivos versionados. O modo Claude Code mantém seu próprio fluxo de ferramentas; para o planejador `/pc`, escolha Ollama ou um provedor de chat compatível.

## Usar aplicativos e comandos

Digite no chat da Capri:

```text
/abrir Obsidian
/abrir escolher
/abrir C:\Program Files\Obsidian\Obsidian.exe
/executar Get-Date
calcule (12 + 3) * 4
qual a memória do meu computador?
/pc crie uma pasta chamada Estudos em Documentos
```

- `/abrir escolher` permite selecionar um executável portátil ou outro arquivo.
- `/executar` executa o comando exato após confirmação; não depende de a IA gerar código.
- `/pc` interpreta o pedido com o modelo e pode propor etapas adicionais.
- Scripts têm limite de **30 segundos**, não oferecem terminal interativo e usam as permissões da conta atual.
- Não há elevação administrativa automática. Cancelar uma tarefa não desfaz ações já concluídas.

## Integrar com o Obsidian

### Preparar o cofre

1. Instale e abra o [Obsidian](https://obsidian.md/).
2. Crie um cofre ou use **Abrir pasta como cofre** para uma pasta existente.
3. Na Capri, envie `/obsidian cofres` e `/obsidian status`.
4. Se houver vários cofres, use `/obsidian usar Meu Cofre`, substituindo pelo nome ou ID desejado.

As operações Markdown não exigem plugins, servidor adicional ou chave de API.

```text
/obsidian criar Capri/Ideias.md | Minha primeira ideia
/obsidian acrescentar Capri/Ideias.md | Um próximo passo
/obsidian ler Capri/Ideias.md
/obsidian abrir Capri/Ideias.md
/obsidian listar Ideias
/obsidian buscar planejamento
/obsidian pesquisar memoria
/obsidian diario
/obsidian diario 2026-11-01
```

A criação não sobrescreve uma nota existente. Acréscimos preservam o conteúdo anterior. A integração rejeita caminhos fora do cofre, pastas ocultas e links/junções. Leituras e listagens têm limites de tamanho.

### Adicionar a biblioteca da Capri

Na pasta do projeto, substitua o caminho pelo seu cofre real:

```powershell
node scripts/prepare-capri-vault.cjs "C:\caminho\Meu Cofre"
```

Abra `Capri/Painel da Capri.md` no Obsidian. O script preserva notas existentes. A biblioteca organiza referências e exemplos; não é carregada inteira na IA automaticamente nem substitui as falas do aplicativo por si só.

### Ativar comandos internos do Obsidian

1. Use uma instalação compatível com a CLI oficial, versão **1.12.7 ou superior**.
2. Abra **Configurações → Geral → Avançado** no Obsidian.
3. Ative **Interface de linha de comando** e siga a orientação de registro.
4. Mantenha o Obsidian aberto.
5. Na Capri, envie `/obsidian comandos` e use `/obsidian comando ID` com um ID retornado na lista.

A Capri pede confirmação antes de executar. Veja o [guia detalhado](docs/OBSIDIAN-PT.md) e a [documentação oficial da CLI](https://obsidian.md/help/cli).

## Histórico automático das conversas

**O arquivamento está habilitado por padrão nesta versão.** Registra o texto do chat da Capri no cofre selecionado:

```text
Capri/Conversas/AAAA-MM/AAAA-MM-DD - identificador-da-sessao.md
```

Inclui mensagens, saudações, respostas, resultados de comandos e erros exibidos. Ao fechar o chat durante uma resposta, o trecho disponível pode ser salvo como incompleto. As datas são UTC; a sessão acompanha a execução da Capri.

```text
/obsidian historico status
/obsidian historico pausar
/obsidian historico ativar
/obsidian historico sincronizar
```

Se o cofre estiver indisponível, as mensagens ficam em `obsidian-chat-outbox`, no perfil local do aplicativo, para nova tentativa. Falta de espaço pode impedir até essa gravação: confira os avisos e o status.

- Pausar não apaga notas anteriores; esquecer o chat na Capri também não exclui as notas do cofre.
- Conversas anteriores à versão com arquivamento não são reconstruídas.
- Não são capturadas conversas de outros aplicativos nem imagens/áudio como anexos.
- O texto arquivado pode conter dados pessoais presentes na conversa. Sincronização e backup seguem a configuração do seu cofre.
- O histórico do Obsidian é separado do contexto da IA. A leitura de notas em tarefas de IA exige confirmação; provedores externos também exigem consentimento para envio do contexto do computador.

## Hooks opcionais de assistentes de programação

Execute apenas o comando correspondente ao assistente utilizado:

```powershell
npm run hooks:install
npm run hooks:codex:install
npm run hooks:agy:install
```

Para remover a integração correspondente:

```powershell
npm run hooks:uninstall
npm run hooks:codex:uninstall
npm run hooks:agy:uninstall
```

Esses scripts configuram hooks nos arquivos do assistente escolhido. A ponte local recebe eventos para a Capri acompanhar atividades. Os hooks são opcionais para quem deseja apenas comandos locais e notas.

## Testes e estrutura

```powershell
npm test
```

A versão 0.4.10 inclui 48 testes Node e 12 verificações de regressão. No Windows, alguns testes iniciam subprocessos reais e usam diretórios temporários. Durante o desenvolvimento também foram verificados o pacote Electron, o executável e o arquivamento em cofre isolado. Isso não garante compatibilidade com toda máquina ou aplicativo.

```text
src/main/       IA, Windows, arquivos, Obsidian e histórico
src/preload.js  Interface controlada entre janela e processo principal
src/renderer/   Interface, personagem, falas, animações e chat
scripts/        Hooks, ferramentas auxiliares e gerador da biblioteca
hooks/          Integrações com assistentes
tests/          Testes automatizados
assets/         Recursos visuais e sonoros
docs/           Guias e imagens de documentação
```

Para testes isolados, use `CAPRI_USER_DATA` com outro perfil e `CAPRI_OBSIDIAN_APPDATA` apontando para uma pasta de teste com `obsidian/obsidian.json`. Ao testar hooks, isole também `CLAUDE_CONFIG_DIR`, `CODEX_HOME` e `AGY_CONFIG_DIR`. Sem isolar o Obsidian, o arquivamento pode usar seu cofre real.

Dependências, instaladores, capturas, relatórios locais de revisão e arquivos de configuração pessoal não são publicados no Git.

## Problemas comuns

| Problema | O que verificar |
|---|---|
| IA indisponível | Provedor, modelo, serviço em execução e credenciais; comandos locais continuam disponíveis. |
| Planejamento demora | Tente um pedido menor, outro modelo ou um comando direto. |
| Aplicativo não encontrado | Use `/abrir escolher` ou informe o caminho completo. |
| Cofre não encontrado | Abra-o no Obsidian e consulte `/obsidian cofres`. |
| CLI desabilitada | Ative a opção no Obsidian e mantenha o aplicativo aberto. |
| Conversas não aparecem | Confira `/obsidian historico status`, cofre selecionado e espaço em disco. |
| Falha nas dependências | Confira a versão do Node, acesso à internet e a mensagem completa do npm. |

## Créditos e licença

O crédito integral pela origem e base deste projeto é de **mochiiwuff**, autor de **[capri-desktop](https://github.com/mochiiwuff/capri-desktop)**, e de seus colaboradores. O histórico original e os avisos de autoria foram preservados. As adaptações desta versão pessoal foram desenvolvidas com **Codex**, sob orientação de **João Santos**.

O código mantém a **[PolyForm Noncommercial License 1.0.0](LICENSE)** do projeto original. Esta adaptação não concede licença comercial. O arquivo `LICENSE` também preserva os avisos relativos às partes anteriormente publicadas sob MIT; os termos completos nele são a referência.

Capri / Project Capricorn e os elementos de Cyberpunk pertencem aos respectivos titulares. Conforme os créditos originais, as artes relacionadas a Cyberpunk e Cyberpunk: Edgerunners são atribuídas a CD PROJEKT RED, Studio Trigger, Netflix e demais titulares aplicáveis. As imagens de personagem em `assets/capri/` e `docs/` não estão cobertas pela licença do código. Este é um projeto de fã, sem afiliação oficial.

Fontes: **Chakra Petch** e **JetBrains Mono**, distribuídas via Fontsource sob a SIL Open Font License.
