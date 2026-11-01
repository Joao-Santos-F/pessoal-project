# Capri 0.4.10: aplicativos, comandos e Obsidian

## Instalar a Capri

Gere o instalador com `npm run dist -- --publish never`, conforme o [README](../README.md). Feche a Capri anterior e execute `dist/Capri-Setup-0.4.10.exe`.

## Abrir aplicativos e executar comandos

- `/abrir Obsidian` procura pelo nome no menu Iniciar, jogos conhecidos e executáveis registrados no Windows.
- `/abrir escolher` abre um seletor de arquivos para escolher um programa portátil ou outro executável.
- `/abrir C:\Program Files\Obsidian\Obsidian.exe` abre diretamente o caminho informado.
- `/executar Get-Date` executa esse comando PowerShell e mostra o resultado.
- `/executar & 'C:\caminho\programa.exe' '--opcao' 'argumento'` permite chamar a interface de linha de comando de um aplicativo.
- `/pc pedido em linguagem natural` usa o modelo configurado para planejar uma sequência de ações, incluindo controles acessíveis de aplicativos e ferramentas do Obsidian.

Os comandos diretos não precisam de IA. Scripts e executáveis que exigem confirmação mostram o conteúdo ou caminho antes de executar. Scripts usam sua conta, sem elevação automática, e têm limite de 30 segundos. O terminal não é interativo. Para tarefas longas, abra o aplicativo apropriado. Fechar o chat cancela a tarefa em andamento, mas não desfaz ações concluídas.

Não existe garantia de executar todo comando em qualquer programa: cada aplicativo precisa oferecer CLI, API ou controles acessíveis. Programas elevados, jogos e interfaces gráficas sem acessibilidade podem não aceitar essas interações. Os helpers atuais interagem com controles por processo e identificador; não oferecem controle visual universal. O modelo local llama3.2 excedeu o limite no teste anterior de planejamento; os comandos diretos evitam essa dependência.

## Integração de notas já disponível

A Capri descobre os cofres cadastrados no Obsidian. Com um único cofre, ele é usado automaticamente; com vários, selecione explicitamente. Não é necessário instalar plugins ou configurar chaves.

Exemplo de caminho de cofre; substitua pelo seu:

`C:\Users\SEU_USUARIO\Documents\Obsidian Vault`

Comandos no chat da Capri:

```text
/obsidian status
/obsidian cofres
/obsidian usar Obsidian Vault
/obsidian listar
/obsidian listar Projetos
/obsidian criar Capri/Minha primeira nota.md | # Minha primeira nota
/obsidian acrescentar Capri/Minha primeira nota.md | Uma nova informação.
/obsidian ler Capri/Minha primeira nota.md
/obsidian abrir Capri/Minha primeira nota.md
/obsidian buscar projetos
/obsidian pesquisar projetos
/obsidian diario
```

`listar` filtra pelo caminho/nome, limitado a 100 resultados. `buscar` abre a pesquisa do próprio Obsidian. Criação nunca sobrescreve uma nota existente. Acréscimo mantém o conteúdo anterior. Arquivos ocultos, configuração do cofre, caminhos externos e links/junções não são acessados pela integração de notas. Leituras têm limites de tamanho. Não há exclusão de notas por esses comandos.

As notas lidas por comandos diretos são mostradas localmente e não são adicionadas ao histórico comum enviado à IA. Se você pedir uma tarefa de IA que leia uma nota, a Capri solicita confirmação e o resultado entra no contexto do modelo daquela tarefa; um provedor externo também exige consentimento de envio.

## Ativar comandos internos do Obsidian

Use uma instalação do Obsidian compatível com a CLI oficial (1.12.7 ou superior). A Capri procura `Obsidian.com` nos locais habituais de instalação e no PATH. A integração de notas Markdown funciona mesmo com a CLI desativada.

1. Abra o Obsidian e seu cofre.
2. Abra **Configurações** pelo ícone de engrenagem ou `Ctrl+,`.
3. Entre em **Geral** e vá à seção **Avançado**.
4. Ative **Interface de linha de comando / Command line interface**. Siga a orientação de registro apresentada pelo próprio Obsidian.
5. Mantenha o Obsidian aberto. Na Capri, envie `/obsidian comandos`.
6. Copie um ID exibido e envie `/obsidian comando ID`. Confirme a ação apresentada pela Capri. A lista contém os comandos disponíveis na sua instalação, inclusive os registrados por plugins habilitados; a Capri verifica se o ID existe antes de executar.

Se o Obsidian estiver em `C:\Program Files\Obsidian`, a Capri encontra `Obsidian.com` diretamente. Para instalações em outro local, use um dos caminhos reconhecidos ou disponibilize a CLI no PATH.

Se quiser conferir pelo PowerShell, com o Obsidian aberto:

```powershell
& 'C:\Program Files\Obsidian\Obsidian.com' help
& 'C:\Program Files\Obsidian\Obsidian.com' 'vault=Obsidian Vault' commands
```

Não substitua o ID por um comando inventado. A disponibilidade e os efeitos dependem do Obsidian e dos plugins instalados.

## Pesquisa no chat e diário (0.4.8)

`/obsidian pesquisar termo` retorna caminhos, linhas e trechos das notas no chat. Não precisa da CLI nem do Obsidian aberto. A busca é literal, ignorando acentos e maiúsculas; `/obsidian buscar termo` continua abrindo a busca na janela do Obsidian. A pesquisa local limita a leitura a 8 MiB, 20 mil entradas e 30 resultados, ignorando notas acima de 512 KiB e informando limites e arquivos não lidos.

`/obsidian diario` cria, após confirmação, uma nota em `Capri/Diário/AAAA-MM/AAAA-MM-DD.md`, usando a data local. Também aceita uma data explícita: `/obsidian diario 2026-11-01`. Se a nota já existe, apenas solicita sua abertura; não substitui o conteúdo. O diário é separado do histórico automático das conversas.

Execute novamente `node scripts/prepare-capri-vault.cjs` para adicionar oito guias de uso diário à biblioteca. O gerador preserva notas existentes, inclusive o painel; em cofres já preparados, abra `Capri/Uso diário/Central do dia.md` para acessar os novos guias.

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

## Referências oficiais

- [CLI do Obsidian: instalação e comandos](https://obsidian.md/help/cli)
- [URI oficial do Obsidian](https://obsidian.md/help/Extending%2BObsidian/Obsidian%2BURI)
