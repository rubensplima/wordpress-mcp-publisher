const required = [
  "WORDPRESS_URL",
  "WORDPRESS_USERNAME",
  "WORDPRESS_APPLICATION_PASSWORD",
];

export function assertWordPressConfig() {
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(", ")}`);
  }
}

function baseUrl() {
  return process.env.WORDPRESS_URL.replace(/\/+$/, "");
}

function authHeader() {
  const raw = `${process.env.WORDPRESS_USERNAME}:${process.env.WORDPRESS_APPLICATION_PASSWORD}`;
  return `Basic ${Buffer.from(raw).toString("base64")}`;
}

async function parseResponse(response) {
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const message =
      data?.message ||
      (typeof data === "string" ? data.slice(0, 500) : null) ||
      `WordPress returned HTTP ${response.status}`;
    throw new Error(`WordPress HTTP ${response.status}: ${message}`);
  }

  return data;
}

export async function wpRequest(path, options = {}) {
  assertWordPressConfig();

  const response = await fetch(`${baseUrl()}/wp-json/wp/v2${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      Authorization: authHeader(),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });

  return parseResponse(response);
}

export async function wpUploadMedia({ buffer, filename, mimeType }) {
  assertWordPressConfig();

  const safeFilename = filename.replace(/[\r\n"]/g, "_");

  const response = await fetch(`${baseUrl()}/wp-json/wp/v2/media`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: authHeader(),
      "Content-Type": mimeType,
      "Content-Disposition": `attachment; filename="${safeFilename}"`,
    },
    body: buffer,
  });

  return parseResponse(response);
}
