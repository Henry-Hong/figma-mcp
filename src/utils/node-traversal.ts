import type { FigmaNode, NodeType } from "../types.js";

export function findChildrenByType(node: FigmaNode, type: NodeType): FigmaNode[] {
  if (!node.children) {
    return [];
  }
  return node.children.filter((child) => child.type === type);
}

export function hasInteractions(node: FigmaNode): boolean {
  return Array.isArray(node.interactions) && node.interactions.length > 0;
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
