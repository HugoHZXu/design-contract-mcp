import { randomUUID } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  getDefaultContractSelector,
  syncHugoUiContract
} from "./contract-store";
import { createMcpServer } from "./create-server";
import { createLogger } from "./logger";

export type HttpScheme = "http" | "https";
export type AuthMode = "none" | "placeholder" | "external";

export type McpHttpServerConfig = {
  scheme: HttpScheme;
  scope: string;
  host: string;
  port: number;
  allowedHosts: string[];
  allowedOrigins: string[];
  maxBodyBytes: number;
  authMode: AuthMode;
  authProvider?: string;
  authContextHeaders: string[];
  logger: ReturnType<typeof createLogger>;
};

type LifecycleServer = {
  close(callback?: (error?: Error) => void): unknown;
  on(eventName: "error", listener: (error: Error) => void): unknown;
};

export function createMcpHttpServerConfig(
  scheme: HttpScheme,
  scope: string,
  options: {
    hostEnv?: string;
    portEnv?: string;
    defaultHost?: string;
    defaultPort: string;
  }
): McpHttpServerConfig {
  return {
    scheme,
    scope,
    host:
      (options.hostEnv ? process.env[options.hostEnv] : undefined) ??
      process.env.MCP_HTTP_HOST ??
      options.defaultHost ??
      "127.0.0.1",
    port: parseInteger(
      process.env.PORT ??
        (options.portEnv ? process.env[options.portEnv] : undefined) ??
        process.env.MCP_HTTP_PORT ??
        options.defaultPort,
      "MCP HTTP port",
      1,
      65535
    ),
    allowedHosts: parseCsv(process.env.MCP_ALLOWED_HOSTS),
    allowedOrigins: parseCsv(process.env.MCP_ALLOWED_ORIGINS),
    maxBodyBytes: parseInteger(
      process.env.MCP_HTTP_MAX_BODY_BYTES ?? "5000000",
      "MCP_HTTP_MAX_BODY_BYTES",
      1
    ),
    authMode: parseAuthMode(process.env.MCP_AUTH_MODE),
    authProvider: process.env.MCP_AUTH_PROVIDER,
    authContextHeaders: parseCsv(process.env.MCP_AUTH_CONTEXT_HEADERS),
    logger: createLogger(scope)
  };
}

export async function prepareMcpHttpServer(config: McpHttpServerConfig) {
  if (process.env.HUGO_UI_CONTRACT_SYNC === "startup") {
    const selector = getDefaultContractSelector();

    if (selector === "vendor") {
      config.logger.info("Skipped startup contract sync.", {
        contractSelector: selector
      });
    } else {
      const result = await syncHugoUiContract({
        selector
      });
      config.logger.info("Synced hugo-ui AI contract on startup.", {
        contractVersion: result.version,
        root: result.root,
        source: result.source,
        repo: result.repo,
        tag: result.tag
      });
    }
  }

  if ((config.host === "0.0.0.0" || config.host === "::") && config.allowedHosts.length === 0) {
    config.logger.warn("Server is binding to all interfaces without MCP_ALLOWED_HOSTS.", {
      host: config.host
    });
  }

  if (!isLocalHostBinding(config.host) && config.allowedOrigins.length === 0) {
    config.logger.warn("Browser-origin requests require MCP_ALLOWED_ORIGINS when the server is not bound to localhost.", {
      host: config.host
    });
  }

  if (!isLocalHostBinding(config.host) && config.authMode === "none") {
    config.logger.warn("Remote HTTP(S) deployments should run behind upstream authentication or set MCP_AUTH_MODE=external.", {
      host: config.host,
      authMode: config.authMode
    });
  }

  if (config.authMode === "placeholder") {
    config.logger.warn("MCP auth placeholder mode is enabled; requests are allowed without authentication enforcement.");
  }

  if (config.authMode === "external") {
    config.logger.info("MCP auth is expected to be enforced by an upstream platform.", {
      authProvider: config.authProvider ?? null,
      authContextHeaders: config.authContextHeaders
    });
  }
}

export function createMcpHttpRequestHandler(config: McpHttpServerConfig) {
  return async (req: IncomingMessage, res: ServerResponse) => {
    const requestId = readRequestId(req);
    const startedAt = Date.now();
    res.setHeader("X-Request-Id", requestId);
    registerRequestLog(req, res, requestId, startedAt, config);

    try {
      if (!isAllowedHost(req, config)) {
        config.logger.warn("Rejected request with forbidden host header.", {
          requestId,
          host: req.headers.host,
          method: req.method,
          url: req.url
        });
        writeJson(res, 403, {
          error: "Forbidden host header."
        });
        return;
      }

      if (!isAllowedOrigin(req, config)) {
        config.logger.warn("Rejected request with forbidden origin header.", {
          requestId,
          origin: req.headers.origin,
          method: req.method,
          url: req.url
        });
        writeJson(res, 403, {
          error: "Forbidden origin header."
        });
        return;
      }

      if (!isAuthorized(req, config)) {
        writeJson(res, 401, {
          error: "Unauthorized."
        }, {
          "WWW-Authenticate": "Bearer"
        });
        return;
      }

      const url = new URL(
        req.url ?? "/",
        `${config.scheme}://${req.headers.host ?? "localhost"}`
      );

      if (req.method === "GET" && url.pathname === "/healthz") {
        writeJson(res, 200, {
          status: "ok",
          transport: "streamable-http",
          scheme: config.scheme,
          contractSelector: getDefaultContractSelector(),
          authMode: config.authMode,
          authProvider: config.authProvider ?? null,
          authContextHeaders: config.authContextHeaders,
          allowedOrigins: config.allowedOrigins
        });
        return;
      }

      if (url.pathname !== "/mcp") {
        writeJson(res, 404, {
          error: "Not found."
        });
        return;
      }

      if (req.method === "POST") {
        await handleMcpPost(req, res, config);
        return;
      }

      writeJson(res, 405, {
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Method not allowed."
        },
        id: null
      }, {
        Allow: "POST"
      });
    } catch (error) {
      config.logger.error("Error handling HTTP request.", {
        requestId,
        method: req.method,
        url: req.url,
        error
      });

      if (!res.headersSent) {
        writeJson(res, 500, {
          jsonrpc: "2.0",
          error: {
            code: -32603,
            message: "Internal server error"
          },
          id: null
        });
      }
    }
  };
}

export function logMcpHttpServerListening(config: McpHttpServerConfig) {
  config.logger.info("MCP Streamable HTTP server listening.", {
    scheme: config.scheme,
    url: `${config.scheme}://${config.host}:${config.port}/mcp`,
    healthUrl: `${config.scheme}://${config.host}:${config.port}/healthz`,
    contractSelector: getDefaultContractSelector(),
    syncMode: process.env.HUGO_UI_CONTRACT_SYNC ?? "manual",
    authMode: config.authMode,
    authProvider: config.authProvider ?? null,
    authContextHeaders: config.authContextHeaders,
    allowedHosts: config.allowedHosts,
    allowedOrigins: config.allowedOrigins,
    maxBodyBytes: config.maxBodyBytes
  });
}

export function registerMcpHttpServerLifecycle(
  server: LifecycleServer,
  config: McpHttpServerConfig
) {
  server.on("error", (error) => {
    config.logger.error("MCP Streamable HTTP server error.", {
      error
    });
  });

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      config.logger.info("Received shutdown signal.", {
        signal
      });
      server.close(() => {
        config.logger.info("MCP Streamable HTTP server stopped.");
        process.exit(0);
      });
    });
  }
}

export function parseCsv(value: string | undefined): string[] {
  return value
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

async function handleMcpPost(
  req: IncomingMessage,
  res: ServerResponse,
  config: McpHttpServerConfig
) {
  const parsedBody = await readJsonBody(req, config);
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });
  let closed = false;
  const close = () => {
    if (closed) {
      return;
    }

    closed = true;
    void transport.close();
    void server.close();
  };

  res.once("finish", close);
  res.once("close", close);

  await server.connect(transport);
  await transport.handleRequest(req, res, parsedBody);
}

function registerRequestLog(
  req: IncomingMessage,
  res: ServerResponse,
  requestId: string,
  startedAt: number,
  config: McpHttpServerConfig
) {
  let logged = false;
  const logOnce = (event: "finish" | "close") => {
    if (logged) {
      return;
    }

    logged = true;
    config.logger.info("HTTP request completed.", {
      requestId,
      event,
      scheme: config.scheme,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      host: req.headers.host,
      remoteAddress: req.socket.remoteAddress,
      contentLength: req.headers["content-length"] ?? null
    });
  };

  res.once("finish", () => logOnce("finish"));
  res.once("close", () => logOnce("close"));
}

function readRequestId(req: IncomingMessage): string {
  const header = req.headers["x-request-id"];

  if (Array.isArray(header)) {
    return header[0] ?? randomUUID();
  }

  return header || randomUUID();
}

async function readJsonBody(
  req: IncomingMessage,
  config: McpHttpServerConfig
): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.byteLength;

    if (totalBytes > config.maxBodyBytes) {
      throw new Error(`Request body exceeds ${config.maxBodyBytes} bytes.`);
    }

    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    return undefined;
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : undefined;
}

function writeJson(
  res: ServerResponse,
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {}
) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    ...headers
  });
  res.end(JSON.stringify(body));
}

function isAllowedHost(req: IncomingMessage, config: McpHttpServerConfig): boolean {
  if (config.allowedHosts.length === 0 && !isLocalHostBinding(config.host)) {
    return true;
  }

  const requestHost = normalizeHost(req.headers.host);
  if (!requestHost) {
    return false;
  }

  const allowed = config.allowedHosts.length
    ? config.allowedHosts
    : ["127.0.0.1", "localhost", "::1", "[::1]"];

  return allowed.some((candidate) => {
    const normalizedCandidate = normalizeHost(candidate);
    return (
      requestHost === normalizedCandidate ||
      req.headers.host === candidate
    );
  });
}

function isAllowedOrigin(req: IncomingMessage, config: McpHttpServerConfig): boolean {
  const origin = req.headers.origin;

  if (!origin) {
    return true;
  }

  if (config.allowedOrigins.length > 0) {
    return config.allowedOrigins.includes(origin);
  }

  return isLocalHostBinding(config.host) && isLocalOrigin(origin);
}

function isAuthorized(_req: IncomingMessage, config: McpHttpServerConfig): boolean {
  switch (config.authMode) {
    case "none":
      return true;
    case "placeholder":
      // Intentionally allows requests. Replace this branch with gateway, SSO,
      // or bearer-token enforcement when deploying outside a trusted boundary.
      return true;
    case "external":
      // Authentication is expected to be enforced before the request reaches
      // this process, for example by an internal gateway, SSO proxy, or cloud IAM.
      return true;
  }
}

function parseAuthMode(value: string | undefined): AuthMode {
  if (!value || value === "none") {
    return "none";
  }

  if (value === "placeholder" || value === "external" || value === "platform") {
    if (value === "platform") {
      return "external";
    }

    return value;
  }

  throw new Error(`Invalid MCP_AUTH_MODE "${value}". Use none, placeholder, or external.`);
}

function normalizeHost(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const hostValue = value.split(",")[0].trim();

  if (hostValue.startsWith("[")) {
    return hostValue.slice(1, hostValue.indexOf("]"));
  }

  return hostValue.split(":")[0];
}

function isLocalHostBinding(value: string) {
  return (
    value === "127.0.0.1" ||
    value === "localhost" ||
    value === "::1" ||
    value === "[::1]"
  );
}

function isLocalOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return isLocalHostBinding(url.hostname);
  } catch {
    return false;
  }
}

function parseInteger(
  value: string,
  label: string,
  min: number,
  max = Number.MAX_SAFE_INTEGER
): number {
  const normalizedValue = value.trim();

  if (!/^\d+$/.test(normalizedValue)) {
    throw new Error(`${label} must be an integer between ${min} and ${max}.`);
  }

  const parsed = Number.parseInt(normalizedValue, 10);

  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${label} must be an integer between ${min} and ${max}.`);
  }

  return parsed;
}
