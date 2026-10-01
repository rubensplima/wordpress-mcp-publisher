import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

import { assertWordPressConfig, wpRequest, wpUploadMedia } from "./wordpress.js";

const app = express();

app.use(express.json({ limit: "10mb" }));

function textResult(data) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function registerTools(server) {
  // ============================================================
  // verificarUsuario
  // ============================================================

  server.tool(
    "verificarUsuario",
    "Verifica o usuário autenticado no WordPress. Somente leitura.",
    {},
    async () => {
      const user = await wpRequest(
        "/users/me?context=edit&_fields=id,name,slug,roles,link"
      );

      return textResult(user);
    }
  );

  // ============================================================
  // listarPosts
  // ============================================================

  server.tool(
    "listarPosts",
    "Lista posts do WordPress. Somente leitura.",
    {
      search: z.string().optional(),
      slug: z.string().optional(),

      status: z
        .enum([
          "publish",
          "future",
          "draft",
          "pending",
          "private",
          "any",
        ])
        .default("any"),

      per_page: z.number().int().min(1).max(100).default(10),

      page: z.number().int().min(1).default(1),

      order: z.enum(["asc", "desc"]).default("desc"),

      orderby: z
        .enum([
          "date",
          "id",
          "include",
          "modified",
          "parent",
          "relevance",
          "slug",
          "title",
        ])
        .default("date"),
    },
    async ({
      search,
      slug,
      status,
      per_page,
      page,
      order,
      orderby,
    }) => {
      const params = new URLSearchParams();

      params.set("context", "edit");
      params.set("status", status);
      params.set("per_page", String(per_page));
      params.set("page", String(page));
      params.set("order", order);
      params.set("orderby", orderby);

      params.set(
        "_fields",
        "id,date,modified,slug,status,link,title,categories,tags"
      );

      if (search) {
        params.set("search", search);
      }

      if (slug) {
        params.set("slug", slug);
      }

      const posts = await wpRequest(`/posts?${params.toString()}`);

      return textResult(posts);
    }
  );

  // ============================================================
  // obterPost
  // ============================================================

  server.tool(
    "obterPost",
    "Obtém um post específico do WordPress pelo ID, incluindo conteúdo editável. Somente leitura.",
    {
      id: z.number().int().positive(),
    },
    async ({ id }) => {
      const fields = [
        "id",
        "date",
        "modified",
        "slug",
        "status",
        "link",
        "title",
        "content",
        "excerpt",
        "categories",
        "tags",
        "featured_media",
      ].join(",");

      const post = await wpRequest(
        `/posts/${id}?context=edit&_fields=${encodeURIComponent(fields)}`
      );

      return textResult(post);
    }
  );

  // ============================================================
  // listarCategorias
  // ============================================================

  server.tool(
    "listarCategorias",
    "Lista e pesquisa categorias existentes no WordPress. Somente leitura; esta integração não cria categorias.",
    {
      search: z.string().optional(),
      slug: z.string().optional(),
      per_page: z.number().int().min(1).max(100).default(100),
      page: z.number().int().min(1).default(1),
      order: z.enum(["asc", "desc"]).default("asc"),
      orderby: z.enum(["id", "include", "name", "slug", "count"]).default("name"),
      hide_empty: z.boolean().default(false),
    },
    async ({ search, slug, per_page, page, order, orderby, hide_empty }) => {
      const params = new URLSearchParams();
      params.set("context", "edit");
      params.set("per_page", String(per_page));
      params.set("page", String(page));
      params.set("order", order);
      params.set("orderby", orderby);
      params.set("hide_empty", String(hide_empty));
      params.set("_fields", "id,count,description,link,name,slug,parent");
      if (search) params.set("search", search);
      if (slug) params.set("slug", slug);
      return textResult(await wpRequest(`/categories?${params.toString()}`));
    }
  );

  // ============================================================
  // listarTags
  // ============================================================

  server.tool(
    "listarTags",
    "Lista e pesquisa tags existentes no WordPress. Somente leitura.",
    {
      search: z.string().optional(),
      slug: z.string().optional(),
      per_page: z.number().int().min(1).max(100).default(100),
      page: z.number().int().min(1).default(1),
      order: z.enum(["asc", "desc"]).default("asc"),
      orderby: z.enum(["id", "include", "name", "slug", "count"]).default("name"),
      hide_empty: z.boolean().default(false),
    },
    async ({ search, slug, per_page, page, order, orderby, hide_empty }) => {
      const params = new URLSearchParams();
      params.set("context", "edit");
      params.set("per_page", String(per_page));
      params.set("page", String(page));
      params.set("order", order);
      params.set("orderby", orderby);
      params.set("hide_empty", String(hide_empty));
      params.set("_fields", "id,count,description,link,name,slug");
      if (search) params.set("search", search);
      if (slug) params.set("slug", slug);
      return textResult(await wpRequest(`/tags?${params.toString()}`));
    }
  );

  // ============================================================
  // criarTag
  // ============================================================

  server.tool(
    "criarTag",
    "Cria uma tag no WordPress somente quando não existe tag equivalente. Pesquisa por nome e slug antes de criar.",
    {
      name: z.string().min(1),
      slug: z.string().min(1).optional(),
      description: z.string().optional(),
    },
    async ({ name, slug, description }) => {
      const params = new URLSearchParams();
      params.set("context", "edit");
      params.set("search", name);
      params.set("per_page", "100");
      params.set("_fields", "id,name,slug,description,link");
      const candidates = await wpRequest(`/tags?${params.toString()}`);
      const normalizedName = name.trim().toLocaleLowerCase("pt-BR");
      const normalizedSlug = slug?.trim().toLocaleLowerCase("pt-BR");
      const existing = Array.isArray(candidates)
        ? candidates.find((tag) => {
            const sameName = String(tag.name || "").trim().toLocaleLowerCase("pt-BR") === normalizedName;
            const sameSlug = normalizedSlug && String(tag.slug || "").trim().toLocaleLowerCase("pt-BR") === normalizedSlug;
            return sameName || sameSlug;
          })
        : undefined;
      if (existing) {
        return textResult({ created: false, reason: "duplicate_tag", message: "Já existe uma tag equivalente. A criação foi cancelada.", existing });
      }
      if (slug) {
        const slugMatches = await wpRequest(`/tags?slug=${encodeURIComponent(slug)}&context=edit&_fields=id,name,slug,description,link`);
        if (Array.isArray(slugMatches) && slugMatches.length > 0) {
          return textResult({ created: false, reason: "duplicate_tag", message: "Já existe uma tag com este slug. A criação foi cancelada.", existing: slugMatches[0] });
        }
      }
      const body = { name };
      if (slug !== undefined) body.slug = slug;
      if (description !== undefined) body.description = description;
      const created = await wpRequest("/tags", { method: "POST", body: JSON.stringify(body) });
      return textResult({ created: true, id: created.id, name: created.name, slug: created.slug, description: created.description, link: created.link });
    }
  );

  // ============================================================
  // enviarMidia
  // ============================================================

  const openAIFileSchema = z.object({
    download_url: z.string().url(),
    file_id: z.string().min(1),
    mime_type: z.string().optional(),
    file_name: z.string().optional(),
  });

  server.registerTool(
    "enviarMidia",
    {
      description:
        "Envia uma imagem fornecida pelo usuário para a Media Library nativa do WordPress. Recebe o arquivo diretamente do ChatGPT e não o associa a nenhum post automaticamente.",
      inputSchema: z.object({
        file: openAIFileSchema,
        title: z.string().optional(),
        alt_text: z.string().optional(),
        caption: z.string().optional(),
        description: z.string().optional(),
      }),
      _meta: {
        "openai/fileParams": ["file"],
      },
    },
    async ({ file, title, alt_text, caption, description }) => {
      const allowedMimeTypes = new Set([
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
      ]);

      const fileResponse = await fetch(file.download_url);
      if (!fileResponse.ok) {
        return textResult({
          uploaded: false,
          reason: "file_download_failed",
          message: "O arquivo autorizado pelo ChatGPT não pôde ser baixado.",
          http_status: fileResponse.status,
        });
      }

      const responseMimeType = String(
        fileResponse.headers.get("content-type") || ""
      )
        .split(";")[0]
        .trim()
        .toLowerCase();

      const declaredMimeType = String(file.mime_type || "")
        .trim()
        .toLowerCase();

      const mimeType = allowedMimeTypes.has(responseMimeType)
        ? responseMimeType
        : declaredMimeType;

      if (!allowedMimeTypes.has(mimeType)) {
        return textResult({
          uploaded: false,
          reason: "unsupported_media_type",
          message: "O arquivo informado não é uma imagem JPEG, PNG, WebP ou GIF suportada.",
          mime_type: mimeType || null,
        });
      }

      const arrayBuffer = await fileResponse.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (!buffer.length) {
        return textResult({
          uploaded: false,
          reason: "empty_file",
          message: "O arquivo de imagem está vazio.",
        });
      }

      const maxBytes = 8 * 1024 * 1024;
      if (buffer.length > maxBytes) {
        return textResult({
          uploaded: false,
          reason: "file_too_large",
          message: "A imagem excede o limite de 8 MB definido para esta integração.",
          bytes: buffer.length,
        });
      }

      const fallbackExtension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/webp": "webp",
        "image/gif": "gif",
      }[mimeType];

      const filename =
        file.file_name?.trim() || `imagem-${file.file_id}.${fallbackExtension}`;

      const uploaded = await wpUploadMedia({
        buffer,
        filename,
        mimeType,
      });

      const metadata = {};
      if (title !== undefined) metadata.title = title;
      if (alt_text !== undefined) metadata.alt_text = alt_text;
      if (caption !== undefined) metadata.caption = caption;
      if (description !== undefined) metadata.description = description;

      let media = uploaded;
      if (Object.keys(metadata).length > 0) {
        media = await wpRequest(`/media/${uploaded.id}`, {
          method: "POST",
          body: JSON.stringify(metadata),
        });
      }

      return textResult({
        uploaded: true,
        id: media.id,
        date: media.date,
        slug: media.slug,
        status: media.status,
        link: media.link,
        source_url: media.source_url,
        mime_type: media.mime_type,
        alt_text: media.alt_text,
        title: media.title,
        caption: media.caption,
      });
    }
  );

  // ============================================================
  // definirImagemDestacada
  // ============================================================

  server.tool(
    "definirImagemDestacada",
    "Define uma mídia existente como imagem destacada de um post. Por padrão não substitui silenciosamente uma imagem destacada já existente.",
    {
      post_id: z.number().int().positive(),
      media_id: z.number().int().positive(),
      substituir: z.boolean().default(false),
    },
    async ({ post_id, media_id, substituir }) => {
      const post = await wpRequest(
        `/posts/${post_id}?context=edit&_fields=id,title,slug,status,link,featured_media`
      );

      if (post.featured_media && post.featured_media !== media_id && !substituir) {
        return textResult({
          updated: false,
          reason: "featured_media_exists",
          message: "O post já possui uma imagem destacada. Nenhuma substituição foi feita.",
          post_id: post.id,
          current_media_id: post.featured_media,
          requested_media_id: media_id,
        });
      }

      const media = await wpRequest(
        `/media/${media_id}?context=edit&_fields=id,status,media_type,mime_type,source_url,link`
      );

      if (media.media_type !== "image") {
        return textResult({
          updated: false,
          reason: "media_is_not_image",
          message: "A mídia informada não é uma imagem.",
          media,
        });
      }

      const updated = await wpRequest(`/posts/${post_id}`, {
        method: "POST",
        body: JSON.stringify({ featured_media: media_id }),
      });

      return textResult({
        updated: true,
        post_id: updated.id,
        status: updated.status,
        link: updated.link,
        featured_media: updated.featured_media,
        media: {
          id: media.id,
          mime_type: media.mime_type,
          source_url: media.source_url,
        },
      });
    }
  );

  // ============================================================
  // criarPost
  // ============================================================

  server.tool(
    "criarPost",
    "Cria um post no WordPress. O status padrão é draft. Use publish somente mediante solicitação explícita do usuário.",
    {
      title: z.string().min(1),

      content: z.string().min(1),

      slug: z.string().min(1).optional(),

      excerpt: z.string().optional(),

      status: z
        .enum(["draft", "pending", "private", "publish"])
        .default("draft"),

      categories: z.array(z.number().int().positive()).optional(),

      tags: z.array(z.number().int().positive()).optional(),
    },
    async ({
      title,
      content,
      slug,
      excerpt,
      status,
      categories,
      tags,
    }) => {
      // Verificação de duplicidade por título.
      const titleParams = new URLSearchParams();
      titleParams.set("search", title);
      titleParams.set("status", "any");
      titleParams.set("context", "edit");
      titleParams.set("per_page", "100");
      titleParams.set("_fields", "id,slug,status,link,title");
      const titleCandidates = await wpRequest(`/posts?${titleParams.toString()}`);
      const normalizedTitle = title.trim().toLocaleLowerCase("pt-BR");
      const sameTitle = Array.isArray(titleCandidates)
        ? titleCandidates.find((post) =>
            String(post.title?.raw ?? post.title?.rendered ?? "").trim().toLocaleLowerCase("pt-BR") === normalizedTitle
          )
        : undefined;
      if (sameTitle) {
        return textResult({ created: false, reason: "duplicate_title", message: "Já existe um post com este título. A criação foi cancelada.", existing: sameTitle });
      }

      // Verificação de duplicidade por slug, quando informado.
      if (slug) {
        const existing = await wpRequest(
          `/posts?slug=${encodeURIComponent(
            slug
          )}&status=any&context=edit&_fields=id,slug,status,link,title`
        );

        if (Array.isArray(existing) && existing.length > 0) {
          return textResult({
            created: false,
            reason: "duplicate_slug",
            message:
              "Já existe um post com este slug. A criação foi cancelada.",
            existing: existing[0],
          });
        }
      }

      const body = {
        title,
        content,
        status,
      };

      if (slug !== undefined) {
        body.slug = slug;
      }

      if (excerpt !== undefined) {
        body.excerpt = excerpt;
      }

      if (categories !== undefined) {
        body.categories = categories;
      }

      if (tags !== undefined) {
        body.tags = tags;
      }

      const created = await wpRequest("/posts", {
        method: "POST",
        body: JSON.stringify(body),
      });

      return textResult({
        created: true,
        id: created.id,
        title: created.title,
        slug: created.slug,
        status: created.status,
        link: created.link,
        categories: created.categories,
        tags: created.tags,
      });
    }
  );

  // ============================================================
  // atualizarPost
  // ============================================================

  server.tool(
    "atualizarPost",
    "Atualiza um post existente do WordPress exclusivamente pelo ID. Somente os campos fornecidos são alterados. O status atual é preservado quando status não é informado. Use status publish somente mediante solicitação explícita do usuário.",
    {
      id: z.number().int().positive(),

      title: z.string().min(1).optional(),

      content: z.string().min(1).optional(),

      slug: z.string().min(1).optional(),

      excerpt: z.string().optional(),

      status: z
        .enum(["draft", "pending", "private", "publish"])
        .optional(),

      categories: z.array(z.number().int().positive()).optional(),

      tags: z.array(z.number().int().positive()).optional(),
    },
    async ({
      id,
      title,
      content,
      slug,
      excerpt,
      status,
      categories,
      tags,
    }) => {
      // Primeiro confirma que o post existe e identifica seu estado atual.
      const current = await wpRequest(
        `/posts/${id}?context=edit&_fields=id,title,slug,status,link,categories,tags`
      );

      const body = {};

      if (title !== undefined) {
        body.title = title;
      }

      if (content !== undefined) {
        body.content = content;
      }

      if (slug !== undefined) {
        body.slug = slug;
      }

      if (excerpt !== undefined) {
        body.excerpt = excerpt;
      }

      if (status !== undefined) {
        body.status = status;
      }

      if (categories !== undefined) {
        body.categories = categories;
      }

      if (tags !== undefined) {
        body.tags = tags;
      }

      if (Object.keys(body).length === 0) {
        return textResult({
          updated: false,
          reason: "no_changes",
          message:
            "Nenhum campo para atualização foi informado. O post não foi alterado.",
          post: current,
        });
      }

      const updated = await wpRequest(`/posts/${id}`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      return textResult({
        updated: true,
        id: updated.id,
        title: updated.title,
        slug: updated.slug,
        status: updated.status,
        link: updated.link,
        categories: updated.categories,
        tags: updated.tags,
      });
    }
  );
}

function createMcpServer() {
  const server = new McpServer({
    name: "wordpress-mcp-publisher",
    version: "0.4.0",
  });

  registerTools(server);

  return server;
}

// ------------------------------------------------------------
// HTTP
// ------------------------------------------------------------

app.get("/", (_req, res) => {
  res.json({
    service: "wordpress-mcp-publisher",
    status: "ok",
    mcp: "/mcp",
    version: "0.4.0",
  });
});

app.get("/health", (_req, res) => {
  try {
    assertWordPressConfig();

    res.json({
      status: "ok",
      configuration: "present",
    });
  } catch (error) {
    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

const sessions = new Map();

app.post("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  let session = sessionId ? sessions.get(sessionId) : undefined;

  try {
    if (session) {
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    // Uma requisição com session ID desconhecido não deve criar uma nova
    // sessão silenciosamente. O cliente precisa reinicializar.
    if (sessionId) {
      res.status(404).json({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Session not found",
        },
        id: req.body?.id ?? null,
      });
      return;
    }

    const server = createMcpServer();
    let transport;

    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (newSessionId) => {
        sessions.set(newSessionId, { server, transport });
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        sessions.delete(transport.sessionId);
      }
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);

    // Se a requisição não inicializou uma sessão, não deixe recursos abertos.
    if (!transport.sessionId) {
      await transport.close();
      await server.close();
    }
  } catch (error) {
    console.error("MCP error:", error);

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: req.body?.id ?? null,
      });
    }
  }
});

app.get("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const session = sessionId ? sessions.get(sessionId) : undefined;

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  try {
    await session.transport.handleRequest(req, res);
  } catch (error) {
    console.error("MCP GET error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

app.delete("/mcp", async (req, res) => {
  const sessionId = req.headers["mcp-session-id"];
  const session = sessionId ? sessions.get(sessionId) : undefined;

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  try {
    await session.transport.handleRequest(req, res);
    sessions.delete(sessionId);
    await session.server.close();
  } catch (error) {
    console.error("MCP DELETE error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

const port = process.env.PORT || 3000;

app.listen(port, "0.0.0.0", () => {
  console.log(`WordPress MCP Publisher 0.4.0 listening on port ${port}`);
});
