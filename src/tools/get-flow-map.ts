import type { FigmaClient } from "../figma-client.js";
import type { Action, Interaction } from "../types.js";
import { chunkArray } from "../utils/node-traversal.js";
import { getSectionFrames, flattenTree } from "./get-section-frames.js";

const BATCH_THRESHOLD = 50;
const BATCH_SIZE = 25;

export interface FlowNode {
  id: string;
  name: string;
}

export interface FlowEdge {
  from: string;
  fromName: string;
  sourceFrameId: string;
  sourceFrameName: string;
  to: string;
  trigger: string;
  action: string;
}

export interface GetFlowMapResult {
  nodes: FlowNode[];
  edges: FlowEdge[];
  entryPoints: string[];
}

interface RawInteractionSource {
  nodeId: string;
  nodeName: string;
  interactions: Interaction[];
}

function collectInteractionSources(
  node: { id: string; name: string; interactions?: Interaction[]; children?: unknown[] },
): RawInteractionSource[] {
  const result: RawInteractionSource[] = [];
  if (node.interactions && node.interactions.length > 0) {
    result.push({ nodeId: node.id, nodeName: node.name, interactions: node.interactions });
  }
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      result.push(
        ...collectInteractionSources(
          child as { id: string; name: string; interactions?: Interaction[]; children?: unknown[] },
        ),
      );
    }
  }
  return result;
}

export async function getFlowMap(
  client: FigmaClient,
  fileKey: string,
  sectionNodeId: string,
): Promise<GetFlowMapResult> {
  // Step 1: collect frame IDs from the section (flatten the tree)
  const { tree } = await getSectionFrames(client, fileKey, sectionNodeId);
  const frames = flattenTree(tree);

  if (frames.length === 0) {
    return { nodes: [], edges: [], entryPoints: [] };
  }

  const frameIds = frames.map((f: { id: string }) => f.id);
  const frameNameMap = new Map<string, string>(frames.map((f: { id: string; name: string }) => [f.id, f.name]));
  const frameIdSet = new Set(frameIds);

  // Step 2: fetch the section node directly (without depth limit) so Figma returns
  // correct destinationIds — querying frames individually causes destinations to be null.
  const allEdges: FlowEdge[] = [];

  const sectionBatches = [[sectionNodeId].length <= BATCH_THRESHOLD
    ? [sectionNodeId]
    : chunkArray([sectionNodeId], BATCH_SIZE)[0]];

  for (const batch of sectionBatches) {
    const response = await client.getFileNodes(fileKey, batch);
    for (const [, entry] of Object.entries(response.nodes)) {
      if (!entry) continue;
      const sectionDoc = entry.document;

      for (const frameNode of (sectionDoc.children ?? [])) {
        const typedFrameNode = frameNode as { id: string; name: string; interactions?: Interaction[]; children?: unknown[] };
        if (!frameIdSet.has(typedFrameNode.id)) continue;

        const frameId = typedFrameNode.id;
        const frameName = frameNameMap.get(frameId) ?? typedFrameNode.name;

        // Collect interactions with their actual source node info
        const sources = collectInteractionSources(typedFrameNode);
        for (const source of sources) {
          for (const interaction of source.interactions) {
            for (const act of interaction.actions) {
              if (act.type !== "NODE" || act.destinationId === null) continue;
              const navigation = (act as Extract<Action, { type: "NODE" }>).navigation;
              if (!frameIdSet.has(act.destinationId)) continue;
              allEdges.push({
                from: source.nodeId,
                fromName: source.nodeName,
                sourceFrameId: frameId,
                sourceFrameName: frameName,
                to: act.destinationId,
                trigger: interaction.trigger.type,
                action: navigation,
              });
            }
          }
        }
      }
    }
  }

  // Step 3: build nodes list
  const nodes: FlowNode[] = frames.map((f: { id: string; name: string }) => ({ id: f.id, name: f.name }));

  // Step 4: compute entry points — frames with no incoming edges
  const hasIncomingEdge = new Set(allEdges.map((e) => e.to));
  const entryPoints = frameIds.filter((id: string) => !hasIncomingEdge.has(id));

  return { nodes, edges: allEdges, entryPoints };
}
