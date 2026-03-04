import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FigmaClient } from "./figma-client.js";
import { getSectionFrames } from "./tools/get-section-frames.js";
import { getPrototypeConnections } from "./tools/get-prototype-connections.js";
import { getFlowMap } from "./tools/get-flow-map.js";
import { getMetadata } from "./tools/get-metadata.js";
import { getScreenshot } from "./tools/get-screenshot.js";
import { getVariableDefs } from "./tools/get-variable-defs.js";
import { getDesignContext } from "./tools/get-design-context.js";

const figmaClient = new FigmaClient();

const server = new McpServer({
  name: "figma-mcp",
  version: "1.0.0",
});

const fileKeySchema = z
  .string()
  .regex(/^[a-zA-Z0-9_-]+$/, "Invalid Figma file key format")
  .describe("Figma file key");
const nodeIdSchema = z
  .string()
  .regex(/^\d+:\d+$/, "Invalid node ID format (expected 'number:number')")
  .describe("Node ID");

// get_section_frames
server.tool(
  "get_section_frames",
  "Get all frames within a section node",
  {
    fileKey: fileKeySchema,
    sectionNodeId: nodeIdSchema.describe("Section node ID"),
  },
  async ({ fileKey, sectionNodeId }) => {
    const result = await getSectionFrames(figmaClient, fileKey, sectionNodeId);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  },
);

// get_prototype_connections
server.tool(
  "get_prototype_connections",
  "Get prototype interaction connections for a node",
  {
    fileKey: fileKeySchema,
    nodeId: nodeIdSchema.describe("Node ID to fetch connections from"),
  },
  async ({ fileKey, nodeId }) => {
    const result = await getPrototypeConnections(figmaClient, fileKey, nodeId);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  },
);

// get_flow_map
server.tool(
  "get_flow_map",
  "Get a map of prototype flows within a file or section",
  {
    fileKey: fileKeySchema,
    nodeId: nodeIdSchema.describe("Root node ID for flow traversal"),
  },
  async ({ fileKey, nodeId }) => {
    const result = await getFlowMap(figmaClient, fileKey, nodeId);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  },
);

// get_design_context
server.tool(
  "get_design_context",
  "Get design context including styles, components, and layout for a node",
  {
    fileKey: fileKeySchema,
    nodeId: nodeIdSchema,
  },
  async ({ fileKey, nodeId }) => {
    const result = await getDesignContext(figmaClient, fileKey, nodeId);
    return {
      content: [
        { type: "image" as const, data: result.screenshot, mimeType: "image/png" as const },
        { type: "text" as const, text: JSON.stringify({ xml: result.xml, variables: result.variables, styles: result.styles, nodeId: result.nodeId, name: result.name }) },
      ],
    };
  },
);

// get_metadata
server.tool(
  "get_metadata",
  "Get metadata for a Figma node",
  {
    fileKey: fileKeySchema,
    nodeId: nodeIdSchema,
  },
  async ({ fileKey, nodeId }) => {
    const result = await getMetadata(figmaClient, fileKey, nodeId);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  },
);

// get_screenshot
server.tool(
  "get_screenshot",
  "Get a screenshot (image export) of a Figma node",
  {
    fileKey: fileKeySchema,
    nodeId: nodeIdSchema.describe("Node ID to screenshot"),
  },
  async ({ fileKey, nodeId }) => {
    const result = await getScreenshot(figmaClient, fileKey, nodeId);
    return {
      content: [{ type: "image" as const, data: result.data, mimeType: result.mimeType }],
    };
  },
);

// get_variable_defs
server.tool(
  "get_variable_defs",
  "Get variable definitions from a Figma file",
  {
    fileKey: fileKeySchema,
    nodeId: nodeIdSchema.optional().describe("Optional node ID to scope variable lookup"),
  },
  async ({ fileKey, nodeId }) => {
    const result = await getVariableDefs(figmaClient, fileKey, nodeId);
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result) }],
    };
  },
);

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Figma MCP server running on stdio");
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error("Fatal error:", message);
  process.exit(1);
});
