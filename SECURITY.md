# Security Policy

Never commit WordPress usernames, Application Passwords, access tokens, cookies, hosting credentials, or private site data.

Copy `.env.example` to `.env` for local development. The `.env` file is ignored by Git.

Use a dedicated WordPress account with only the permissions required for the intended workflow. Revoke an Application Password immediately if it is exposed.

Report vulnerabilities privately to the repository owner rather than opening a public issue containing secrets or exploit details.

## Remote deployment

The MCP endpoint has no built-in client authentication. HTTPS and MCP session IDs do not provide access control. By default, all MCP requests return HTTP 503. Set PRIVATE_MODE=false only in an isolated local environment or behind independently verified authentication and authorization. Do not expose the enabled endpoint to the public internet. Media downloads also require additional SSRF protections before accepting untrusted callers. The maintenance gate is not authentication.
