import type { FigmaClient } from "../figma-client.js";
import { buildXml } from "../utils/xml-builder.js";

export interface GetMetadataResult {
  xml: string;
  nodeId: string;
  name: string;
  type: string;
}

export async function getMetadata(
  client: FigmaClient,
  fileKey: string,
  nodeId: string,
): Promise<GetMetadataResult> {
  const response = await client.getFileNodes(fileKey, [nodeId], 3);
  const nodeEntry = response.nodes[nodeId];

  if (!nodeEntry) {
    throw new Error(`Node ${nodeId} not found in file ${fileKey}`);
  }

  const document = nodeEntry.document;
  const xml = buildXml(document);

  return {
    xml,
    nodeId: document.id,
    name: document.name,
    type: document.type,
  };
}
