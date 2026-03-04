import type { FigmaClient } from "../figma-client.js";
import { findChildrenByType, hasInteractions } from "../utils/node-traversal.js";

export interface SectionFrame {
  id: string;
  name: string;
  width: number;
  height: number;
  hasInteractions: boolean;
}

export interface GetSectionFramesResult {
  frames: SectionFrame[];
}

export async function getSectionFrames(
  client: FigmaClient,
  fileKey: string,
  sectionNodeId: string,
): Promise<GetSectionFramesResult> {
  const response = await client.getFileNodes(fileKey, [sectionNodeId], 2);
  const nodeEntry = response.nodes[sectionNodeId];

  if (!nodeEntry) {
    throw new Error(`Node ${sectionNodeId} not found`);
  }

  const sectionNode = nodeEntry.document;

  if (sectionNode.type !== "SECTION") {
    throw new Error(`Node ${sectionNodeId} is not a SECTION type. Got: ${sectionNode.type}`);
  }

  // Include both FRAME and INSTANCE nodes — sections can contain component instances
  // that act as screens in a prototype flow
  const frameChildren = [
    ...findChildrenByType(sectionNode, "FRAME"),
    ...findChildrenByType(sectionNode, "INSTANCE"),
  ];

  const frames: SectionFrame[] = frameChildren.map((frame) => {
    const bounds = frame.absoluteBoundingBox;
    return {
      id: frame.id,
      name: frame.name,
      width: bounds?.width ?? 0,
      height: bounds?.height ?? 0,
      hasInteractions: hasInteractions(frame),
    };
  });

  return { frames };
}
