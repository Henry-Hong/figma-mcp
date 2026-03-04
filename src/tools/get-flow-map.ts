import type { FigmaClient } from "../figma-client.js";
import type { Action, Interaction } from "../types.js";
import { chunkArray } from "../utils/node-traversal.js";
import { getSectionFrames } from "./get-section-frames.js";

const BATCH_THRESHOLD = 50;
const BATCH_SIZE = 25;

export interface FlowNode {
  id: string;
  name: string;
}

export interface FlowEdge {
  from: string;
  to: string;
  trigger: string;
  action: string;
}

export interface GetFlowMapResult {
  nodes: FlowNode[];
  edges: FlowEdge[];
  entryPoints: string[];
}

function extractEdgesFromInteractions(
  _fromId: string,
  interactions: Interaction[],
): Array<{ to: string; trigger: string; action: string }> {
  const edges: Array<{ to: string; trigger: string; action: string }> = [];
  for (const interaction of interactions) {
    for (const act of interaction.actions) {
      if (act.type === "NODE" && act.destinationId !== null) {
        edges.push({
          to: act.destinationId,
          trigger: interaction.trigger.type,
          action: (act as Extract<Action, { type: "NODE" }>).navigation,
        });
      }
    }
  }
  return edges;
}

export async function getFlowMap(
  client: FigmaClient,
  fileKey: string,
  sectionNodeId: string,
): Promise<GetFlowMapResult> {
  // Step 1: collect frame IDs from the section
  const { frames } = await getSectionFrames(client, fileKey, sectionNodeId);

  if (frames.length === 0) {
    return { nodes: [], edges: [], entryPoints: [] };
  }

  const frameIds = frames.map((f) => f.id);
  const frameNameMap = new Map<string, string>(frames.map((f) => [f.id, f.name]));

  // Step 2: batch-fetch all frames with depth=1 to get interactions
  const batches =
    frameIds.length <= BATCH_THRESHOLD ? [frameIds] : chunkArray(frameIds, BATCH_SIZE);

  const allEdges: FlowEdge[] = [];
  const frameIdSet = new Set(frameIds);

  for (const batch of batches) {
    const response = await client.getFileNodes(fileKey, batch, 1);
    for (const [id, entry] of Object.entries(response.nodes)) {
      if (!entry) {
        continue;
      }
      const node = entry.document;
      const interactions: Interaction[] = node.interactions ?? [];
      const rawEdges = extractEdgesFromInteractions(id, interactions);
      for (const raw of rawEdges) {
        // Only include edges whose destination is within our frame set
        if (frameIdSet.has(raw.to)) {
          allEdges.push({ from: id, to: raw.to, trigger: raw.trigger, action: raw.action });
        }
      }
    }
  }

  // Step 3: build nodes list (only frames that appear in edges or are known frames)
  const nodes: FlowNode[] = frames.map((f) => ({ id: f.id, name: f.name }));

  // Step 4: compute entry points — frames with no incoming edges
  const hasIncomingEdge = new Set(allEdges.map((e) => e.to));
  const entryPoints = frameIds.filter((id) => !hasIncomingEdge.has(id));

  // Enrich node names for any destination IDs not in frameNameMap (cross-section links filtered out above)
  // frameNameMap already covers all nodes in our list
  void frameNameMap;

  return { nodes, edges: allEdges, entryPoints };
}
