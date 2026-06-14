import { createServer } from "node:http";
import {
  createMcpHttpRequestHandler,
  createMcpHttpServerConfig,
  logMcpHttpServerListening,
  prepareMcpHttpServer,
  registerMcpHttpServerLifecycle
} from "./http-transport";

const config = createMcpHttpServerConfig("http", "mcp-http", {
  defaultPort: "3000"
});

await prepareMcpHttpServer(config);

const httpServer = createServer(createMcpHttpRequestHandler(config));

httpServer.listen(config.port, config.host, () => {
  logMcpHttpServerListening(config);
});

registerMcpHttpServerLifecycle(httpServer, config);
