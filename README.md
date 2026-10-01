# WordPress MCP Publisher

**Português | [English](README.en.md)**

Servidor MCP genérico que conecta clientes compatíveis com o **Model Context Protocol (MCP)** ao WordPress por meio da REST API nativa.

O projeto foi construído em torno de um fluxo real de publicação de artigos: posts, categorias, tags, upload para a Media Library e definição de imagem destacada. O núcleo da integração não depende de Yoast, Rank Math, Elementor ou outro plugin específico do WordPress.

## Versão atual — 0.4.0

A implementação de referência foi validada de ponta a ponta com uma instalação real do WordPress. Esta edição pública foi preparada sem credenciais de produção, URLs específicas da instalação privada ou IDs usados nos testes.

O servidor utiliza **MCP Streamable HTTP** no endpoint `/mcp` e expõe atualmente **10 ferramentas**.

## Ferramentas

| Ferramenta | Tipo | Função |
| --- | --- | --- |
| `verificarUsuario` | leitura | Verifica o usuário autenticado no WordPress |
| `listarPosts` | leitura | Lista e pesquisa posts |
| `obterPost` | leitura | Obtém um post pelo ID, incluindo conteúdo editável e `featured_media` |
| `listarCategorias` | leitura | Lista e pesquisa categorias existentes |
| `listarTags` | leitura | Lista e pesquisa tags existentes |
| `criarTag` | escrita | Cria uma tag após verificar nome ou slug equivalente |
| `criarPost` | escrita | Cria um post; o padrão é `draft` |
| `atualizarPost` | escrita | Atualiza um post pelo ID usando somente os campos fornecidos |
| `enviarMidia` | escrita | Envia uma imagem autorizada pelo usuário para a Media Library |
| `definirImagemDestacada` | escrita | Associa uma imagem existente ao `featured_media` de um post |

Os nomes das ferramentas permanecem em português porque fazem parte da API testada da versão 0.4.0.

## Proteções de escrita

O projeto foi pensado para reduzir alterações acidentais no WordPress:

- novos posts usam `draft` por padrão;
- publicação exige que o cliente envie explicitamente `status: "publish"`;
- a criação de posts verifica duplicidade por título e slug;
- atualizações exigem o ID do post e preservam o status quando `status` não é informado;
- a criação de tags pesquisa primeiro nomes e slugs equivalentes;
- categorias são somente leitura nesta versão — não existe `criarCategoria`;
- o upload aceita JPEG, PNG, WebP e GIF, com limite interno de 8 MB;
- uma imagem destacada existente não é substituída silenciosamente — a troca exige `substituir: true`;
- o servidor não expõe ferramentas de exclusão.

## Arquitetura

```text
Cliente compatível com MCP
          |
          v
WordPress MCP Publisher
          |
          v
WordPress REST API
          |
          v
Seu site WordPress
```

As credenciais permanecem no ambiente do servidor MCP e não são enviadas como argumentos das ferramentas.

## Requisitos

- Node.js 20+
- WordPress acessível por HTTPS
- usuário WordPress com as permissões necessárias para as operações desejadas
- uma Application Password do WordPress

## Instalação

Clone o repositório e instale as dependências:

```bash
npm install
```

Crie seu arquivo local de configuração a partir do exemplo:

```bash
cp .env.example .env
```

Configure o `.env`:

```env
WORDPRESS_URL=https://example.com
WORDPRESS_USERNAME=your-wordpress-user
WORDPRESS_APPLICATION_PASSWORD=your-application-password
PORT=3000
```

Nunca versione o arquivo `.env`. Consulte [SECURITY.md](SECURITY.md).

## Execução

```bash
npm start
```

Endpoints disponíveis:

- `/` — identificação do serviço e versão;
- `/health` — verificação da configuração necessária;
- `/mcp` — endpoint MCP Streamable HTTP.

Para uso remoto, publique o serviço Node.js atrás de HTTPS e configure o cliente MCP para acessar:

```text
https://your-mcp-host.example/mcp
```

## Sessões MCP

O servidor mantém os transports associados ao `mcp-session-id` entre as requisições.

```text
initialize
    |
    v
mcp-session-id
    |
    v
tools/list
    |
    v
tools/call
```

Um ID de sessão desconhecido é rejeitado em vez de provocar silenciosamente a criação de uma nova sessão.

## Fluxo de mídia

A versão 0.4.0 permite receber uma imagem autorizada pelo cliente e enviá-la à Media Library nativa:

```text
arquivo de imagem
       |
       v
   enviarMidia
       |
       v
Media Library
       |
       v
    media_id
       |
       v
definirImagemDestacada
       |
       v
post.featured_media
```

O contrato de file input de `enviarMidia` foi desenvolvido para clientes com suporte a parâmetros de arquivo MCP no formato utilizado pela OpenAI. Outros clientes MCP podem exigir um adaptador ou outra forma de transporte de arquivos.

## Checklist de implantação

1. Configure as credenciais como variáveis de ambiente da hospedagem.
2. Publique o serviço Node.js atrás de HTTPS.
3. Verifique os endpoints `/` e `/health`.
4. Inicialize uma nova sessão MCP.
5. Valide `tools/list`.
6. Teste primeiro as ferramentas somente de leitura.
7. Faça os primeiros testes de escrita em um post de teste ou rascunho.
8. Depois de alterar schemas de ferramentas, atualize o catálogo no cliente MCP.

## Escopo da versão 0.4.0

Incluído:

- verificação do usuário WordPress autenticado;
- listagem, leitura, criação e atualização controlada de posts;
- listagem de categorias;
- listagem e criação de tags com proteção contra duplicidade;
- upload de imagens para a Media Library nativa;
- associação controlada de imagem destacada.

Fora do escopo:

- edição, transformação ou exclusão de imagens;
- criação de categorias;
- exclusão de posts, categorias ou tags;
- integrações específicas com plugins de SEO;
- download arbitrário de arquivos remotos.

## Histórico resumido

**0.1.x** — autenticação, listagem e criação de posts.

**0.2.0** — leitura e atualização controlada de posts, além de sessões MCP persistentes.

**0.3.0** — ferramentas de categorias e tags e proteções contra duplicidade.

**0.4.0** — file input do cliente, upload para a Media Library, suporte a `featured_media` e associação controlada de imagem destacada.

## Segurança

Este repositório público não contém as credenciais ou configurações da instalação usada no desenvolvimento. Para uma implantação própria, mantenha segredos exclusivamente em variáveis de ambiente e siga as orientações de [SECURITY.md](SECURITY.md).

## Licença

Distribuído sob a licença MIT. Consulte [LICENSE](LICENSE).
