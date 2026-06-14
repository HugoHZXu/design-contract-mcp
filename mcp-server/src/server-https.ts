import fs from "node:fs/promises";
import { createServer } from "node:https";
import {
  createMcpHttpRequestHandler,
  createMcpHttpServerConfig,
  logMcpHttpServerListening,
  prepareMcpHttpServer,
  registerMcpHttpServerLifecycle
} from "./http-transport";

const config = createMcpHttpServerConfig("https", "mcp-https", {
  hostEnv: "MCP_HTTPS_HOST",
  portEnv: "MCP_HTTPS_PORT",
  defaultPort: "3443"
});

await prepareMcpHttpServer(config);

const httpsServer = createServer(
  {
    key: await readRequiredSecret("MCP_HTTPS_KEY"),
    cert: await readRequiredSecret("MCP_HTTPS_CERT"),
    ca: await readOptionalSecret("MCP_HTTPS_CA"),
    passphrase: process.env.MCP_HTTPS_PASSPHRASE
  },
  createMcpHttpRequestHandler(config)
);

httpsServer.listen(config.port, config.host, () => {
  logMcpHttpServerListening(config);
});

registerMcpHttpServerLifecycle(httpsServer, config);

async function readRequiredSecret(envName: string): Promise<Buffer> {
  const value = await readOptionalSecret(envName);

  if (!value) {
    throw new Error(
      `Missing ${envName}, ${envName}_BASE64, or ${envName}_FILE. HTTPS mode requires certificate material.`
    );
  }

  return value;
}

async function readOptionalSecret(envName: string): Promise<Buffer | undefined> {
  const rawValue = process.env[envName];
  if (rawValue) {
    return Buffer.from(rawValue, "utf8");
  }

  const base64Value = process.env[`${envName}_BASE64`];
  if (base64Value) {
    return Buffer.from(base64Value, "base64");
  }

  const filePath = process.env[`${envName}_FILE`];
  return filePath ? fs.readFile(filePath) : undefined;
}
