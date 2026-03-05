import type { FigmaClient } from "../figma-client.js";
import type { FigmaNode } from "../types.js";
import { hasInteractions } from "../utils/node-traversal.js";

export interface SectionNode {
  id: string;
  name: string;
  type: "SECTION" | "FRAME" | "INSTANCE";
  width: number;
  height: number;
  hasInteractions: boolean;
  children?: SectionNode[];
}

export interface GetSectionFramesResult {
  tree: SectionNode[];
}

const DEFAULT_DEPTH = 10;

export function flattenTree(nodes: SectionNode[]): SectionNode[] {
  const result: SectionNode[] = [];
  for (const node of nodes) {
    if (node.type === "FRAME" || node.type === "INSTANCE") {
      result.push(node);
    }
    if (node.children) {
      result.push(...flattenTree(node.children));
    }
  }
  return result;
}

function buildTree(node: FigmaNode, remainingDepth: number): SectionNode[] {
  if (!node.children || remainingDepth <= 0) {
    return [];
  }

  const results: SectionNode[] = [];

  for (const child of node.children) {
    if (child.type === "SECTION") {
      const bounds = child.absoluteBoundingBox;
      results.push({
        id: child.id,
        name: child.name,
        type: "SECTION",
        width: bounds?.width ?? 0,
        height: bounds?.height ?? 0,
        hasInteractions: hasInteractions(child),
        children: buildTree(child, remainingDepth - 1),
      });
    } else if (child.type === "FRAME" || child.type === "INSTANCE") {
      const bounds = child.absoluteBoundingBox;
      results.push({
        id: child.id,
        name: child.name,
        type: child.type,
        width: bounds?.width ?? 0,
        height: bounds?.height ?? 0,
        hasInteractions: hasInteractions(child),
      });
    }
  }

  return results;
}

export async function getSectionFrames(
  client: FigmaClient,
  fileKey: string,
  sectionNodeId: string,
  depth?: number,
): Promise<GetSectionFramesResult> {
  const maxDepth = depth ?? DEFAULT_DEPTH;
  const apiDepth = maxDepth + 1;

  const response = await client.getFileNodes(fileKey, [sectionNodeId], apiDepth);
  const nodeEntry = response.nodes[sectionNodeId];

  if (!nodeEntry) {
    throw new Error(`Node ${sectionNodeId} not found`);
  }

  const sectionNode = nodeEntry.document;

  if (sectionNode.type !== "SECTION") {
    throw new Error(`Node ${sectionNodeId} is not a SECTION type. Got: ${sectionNode.type}`);
  }

  const tree = buildTree(sectionNode, maxDepth);

  return { tree };
}
