import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  buildGenerationContext,
  getCodeConnectMap,
  getComponentContract,
  getDesignContext,
  validateGeneratedCodeTool
} from "./tools";

const server = new McpServer({
  name: "figma-contract-mcp-demo",
  version: "0.1.0"
}, {
  instructions:
    "Use build_generation_context before generating React. Generate code from returned design, mapping, contracts, pattern, and expectedComponentUsage; do not copy local generated examples. After generation, call validate_generated_code with the code and expectedComponentUsage. Treat validation failures as actionable and revise until valid. This server only reads local fixtures/contracts and validates code; it does not call an LLM or fetch live Figma data."
});

server.tool(
  "get_design_context",
  "Read captured Figma-like frame data from local fixtures.",
  {
    frameId: z.string()
  },
  async ({ frameId }) => jsonResponse(await getDesignContext(frameId))
);

server.tool(
  "get_code_connect_map",
  "Resolve a design node to its local Code Connect-style component mapping.",
  {
    nodeId: z.string()
  },
  async ({ nodeId }) => jsonResponse(await getCodeConnectMap(nodeId))
);

server.tool(
  "get_component_contract",
  "Read the local component contract for a mapped component.",
  {
    componentName: z.string()
  },
  async ({ componentName }) =>
    jsonResponse(await getComponentContract(componentName))
);

server.tool(
  "build_generation_context",
  "Combine fixture data, component mapping, contracts, tokens, and pattern rules.",
  {
    frameId: z.string()
  },
  async ({ frameId }) => jsonResponse(await buildGenerationContext(frameId))
);

server.tool(
  "validate_generated_code",
  "Validate generated React usage against local component contracts.",
  {
    code: z.string(),
    expectedComponentUsage: z
      .array(
        z.object({
          nodeId: z.string(),
          nodeName: z.string(),
          componentName: z.string(),
          importName: z.string(),
          packageName: z.string(),
          contractPath: z.string()
        })
      )
  },
  async ({ code, expectedComponentUsage }) =>
    jsonResponse(await validateGeneratedCodeTool(code, expectedComponentUsage))
);

function jsonResponse(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

const transport = new StdioServerTransport();
await server.connect(transport);
