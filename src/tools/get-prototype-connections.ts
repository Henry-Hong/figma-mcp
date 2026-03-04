import type { FigmaClient } from "../figma-client.js";
import type { Action, Interaction } from "../types.js";

export interface PrototypeConnection {
  trigger: string;
  action: string;
  destinationId: string;
  destinationName: string;
  transition?: object;
}

export interface GetPrototypeConnectionsResult {
  connections: PrototypeConnection[];
}

function extractNodeAction(action: Action): { destinationId: string; navigation: string; transition?: object } | null {
  if (action.type !== "NODE" || action.destinationId === null) {
    return null;
  }
  return {
    destinationId: action.destinationId,
    navigation: action.navigation,
    transition: action.transition,
  };
}

export async function getPrototypeConnections(
  client: FigmaClient,
  fileKey: string,
  nodeId: string,
): Promise<GetPrototypeConnectionsResult> {
  const response = await client.getFileNodes(fileKey, [nodeId], 1);
  const nodeEntry = response.nodes[nodeId];

  if (!nodeEntry) {
    throw new Error(`Node ${nodeId} not found`);
  }

  const node = nodeEntry.document;
  const interactions: Interaction[] = node.interactions ?? [];

  if (interactions.length === 0) {
    return { connections: [] };
  }

  // Collect all unique destination IDs
  const destinationIds = new Set<string>();
  for (const interaction of interactions) {
    for (const action of interaction.actions) {
      const nodeAction = extractNodeAction(action);
      if (nodeAction) {
        destinationIds.add(nodeAction.destinationId);
      }
    }
  }

  // Fetch destination node names in a single batch call
  const destinationNameMap = new Map<string, string>();
  if (destinationIds.size > 0) {
    const idsArray = Array.from(destinationIds);
    const destResponse = await client.getFileNodes(fileKey, idsArray, 1);
    for (const [id, entry] of Object.entries(destResponse.nodes)) {
      if (entry) {
        destinationNameMap.set(id, entry.document.name);
      }
    }
  }

  const connections: PrototypeConnection[] = [];
  for (const interaction of interactions) {
    for (const action of interaction.actions) {
      const nodeAction = extractNodeAction(action);
      if (!nodeAction) {
        continue;
      }
      const connection: PrototypeConnection = {
        trigger: interaction.trigger.type,
        action: nodeAction.navigation,
        destinationId: nodeAction.destinationId,
        destinationName: destinationNameMap.get(nodeAction.destinationId) ?? nodeAction.destinationId,
      };
      if (nodeAction.transition !== undefined) {
        connection.transition = nodeAction.transition;
      }
      connections.push(connection);
    }
  }

  return { connections };
}
