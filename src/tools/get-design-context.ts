import type { FigmaClient } from "../figma-client.js";
import { buildXml } from "../utils/xml-builder.js";
import { getScreenshot } from "./get-screenshot.js";
import { getVariableDefs, type GetVariableDefsResult } from "./get-variable-defs.js";

export interface NodeStyles {
  fills: unknown[];
  strokes: unknown[];
  effects: unknown[];
}

export interface GetDesignContextResult {
  xml: string;
  screenshot: string;
  variables: GetVariableDefsResult;
  styles: NodeStyles;
  nodeId: string;
  name: string;
}

export async function getDesignContext(
  client: FigmaClient,
  fileKey: string,
  nodeId: string,
): Promise<GetDesignContextResult> {
  // Fetch node data once (depth=3 covers both XML and style extraction)
  const [nodeResponse, screenshotResult, variablesResult] = await Promise.all([
    client.getFileNodes(fileKey, [nodeId], 3),
    getScreenshot(client, fileKey, nodeId),
    getVariableDefs(client, fileKey, nodeId),
  ]);

  const nodeEntry = nodeResponse.nodes[nodeId];
  if (!nodeEntry) {
    throw new Error(`Node ${nodeId} not found in file ${fileKey}`);
  }

  const document = nodeEntry.document;
  const xml = buildXml(document);

  const styles: NodeStyles = {
    fills: Array.isArray(document.fills) ? (document.fills as unknown[]) : [],
    strokes: Array.isArray(document.strokes) ? (document.strokes as unknown[]) : [],
    effects: Array.isArray(document.effects) ? (document.effects as unknown[]) : [],
  };

  return {
    xml,
    screenshot: screenshotResult.data,
    variables: variablesResult,
    styles,
    nodeId: document.id,
    name: document.name,
  };
}
