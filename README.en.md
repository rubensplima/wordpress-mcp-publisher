# WordPress MCP Publisher

**English | [Português](README.md)**

A generic MCP server that connects MCP-compatible clients to WordPress through the native WordPress REST API.

It focuses on the article publishing workflow: posts, categories, tags, Media Library uploads and featured images. The core integration does not depend on Yoast, Rank Math, Elementor or another WordPress plugin.

## Current version — 0.4.1

The reference implementation has been validated end to end against a real WordPress installation. This public edition contains no production credentials, site-specific URLs or test IDs.

The server uses **MCP Streamable HTTP** at `/mcp` and exposes **10 tools**.

## Tools

| Tool | Type | Purpose |
| --- | --- | --- |
| `verificarUsuario` | read | Verify the authenticated WordPress user |
| `listarPosts` | read | List and search posts |
| `obterPost` | read | Retrieve a post by ID, including editable content and `featured_media` |
| `listarCategorias` | read | List and search existing categories |
| `listarTags` | read | List and search existing tags |
| `criarTag` | write | Create a tag after checking for an equivalent name or slug |
| `criarPost` | write | Create a post; defaults to `draft` |
| `atualizarPost` | write | Update a post by ID using only supplied fields |
| `enviarMidia` | write | Upload a user-authorized image to the WordPress Media Library |
| `definirImagemDestacada` | write | Associate an existing image with a post's `featured_media` |

Tool names are kept in Portuguese because they are part of the tested 0.4.0 API surface.

## Safety defaults

- New posts default to `draft`.
- Publishing requires the caller to explicitly send `status: "publish"`.
- Post creation checks for duplicate titles and slugs.
- Post updates require an ID and preserve status when `status` is omitted.
- Tag creation checks existing names and slugs first.
- Categories are read-only in this release; there is no `criarCategoria`.
- Media upload accepts JPEG, PNG, WebP and GIF, with an 8 MB application limit.
- Existing featured images are not silently replaced; replacement requires `substituir: true`.
- The server does not expose delete tools.

## Architecture

```text
MCP-compatible client
        |
        v
WordPress MCP Publisher
        |
        v
WordPress REST API
        |
        v
Your WordPress site
```

## Requirements

- Node.js 20.6+
- WordPress with HTTPS
- A WordPress user with appropriate permissions
- A WordPress Application Password

## Configuration

```bash
npm install
cp .env.example .env
```

Configure `.env`:

```env
WORDPRESS_URL=https://example.com
WORDPRESS_USERNAME=your-wordpress-user
WORDPRESS_APPLICATION_PASSWORD=your-application-password
PORT=3000
PRIVATE_MODE=true
```

Never commit `.env`. See [SECURITY.md](SECURITY.md).

## Run

```bash
node --env-file=.env src/server.js
```

Endpoints: `/`, `/health`, and `/mcp`.

Remote use requires HTTPS **and independent authentication/access control**. See [SECURITY.md](SECURITY.md).

## Maintenance mode

MCP is blocked by default (HTTP 503). Set PRIVATE_MODE=false only in an isolated local environment or behind verified authentication and authorization. Never expose an enabled endpoint publicly. This is not authentication. The server still binds to all interfaces; isolate it with a firewall or equivalent controls.

Version 0.4.1 pins Zod 4.6.7, Express 5.3.0 and MCP SDK 1.32.2, limits category/tag arrays to 100 entries and adds the maintenance gate. The public branch requires its own runtime validation. Node.js 20 is no longer supported upstream; prefer a supported LTS.

## Media workflow

```text
image file -> enviarMidia -> Media Library -> media_id
                                      |
                                      v
                         definirImagemDestacada
                                      |
                                      v
                           post.featured_media
```

The file-input contract used by `enviarMidia` is designed for clients that support OpenAI-style MCP file parameters. Other MCP clients may require an adapter or a different file transport.

## Scope

Included: posts, category listing, tags, native Media Library image uploads, and controlled featured-image assignment.

Out of scope: deletion, category creation, media transformation, plugin-specific SEO integrations, and arbitrary remote-file fetching.

## Version history

**0.1.x** — authentication, post listing and creation.

**0.2.0** — post retrieval/updates and persistent MCP sessions.

**0.3.0** — category/tag tools and duplicate protections.

**0.4.0** — client file input, Media Library uploads and controlled `featured_media`.

**0.4.1** — dependency security maintenance, array limits and default maintenance gate.

## License

MIT. See [LICENSE](LICENSE).
