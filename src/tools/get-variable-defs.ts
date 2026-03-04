import type { FigmaClient } from "../figma-client.js";
import type { FigmaApiError } from "../types.js";

interface VariableEntry {
  id: string;
  name: string;
  type: string;
  value: unknown;
}

interface BoundVariableEntry {
  variableId: string;
  boundTo: string;
  note: string;
}

export type GetVariableDefsResult =
  | { variables: VariableEntry[]; source: "api" }
  | { variables: BoundVariableEntry[]; source: "boundVariables"; message: string };

function isFigmaApiError(err: unknown): err is FigmaApiError {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    "message" in err &&
    typeof (err as FigmaApiError).status === "number"
  );
}

export async function getVariableDefs(
  client: FigmaClient,
  fileKey: string,
  nodeId?: string,
): Promise<GetVariableDefsResult> {
  try {
    const response = await client.getFileVariables(fileKey);
    const variables = response.meta.variables;

    const entries: VariableEntry[] = Object.values(variables).map((v) => {
      const firstModeId = Object.keys(v.valuesByMode)[0];
      const value = firstModeId !== undefined ? v.valuesByMode[firstModeId] : undefined;
      return {
        id: v.id,
        name: v.name,
        type: v.resolvedType,
        value,
      };
    });

    return { variables: entries, source: "api" };
  } catch (err: unknown) {
    if (isFigmaApiError(err) && err.status === 403) {
      console.error("Variables API requires Enterprise plan. Showing bound variable references only.");

      if (!nodeId) {
        return {
          variables: [],
          source: "boundVariables",
          message: "Variables API requires Enterprise plan. Showing bound variable references only.",
        };
      }

      const response = await client.getFileNodes(fileKey, [nodeId]);
      const nodeEntry = response.nodes[nodeId];

      if (!nodeEntry) {
        return {
          variables: [],
          source: "boundVariables",
          message: "Variables API requires Enterprise plan. Showing bound variable references only.",
        };
      }

      const document = nodeEntry.document;
      const boundVariables = document.boundVariables ?? {};
      const note = "Full variable details require Enterprise plan";

      const entries: BoundVariableEntry[] = [];
      for (const [boundTo, binding] of Object.entries(boundVariables)) {
        if (Array.isArray(binding)) {
          for (const b of binding) {
            entries.push({ variableId: b.id, boundTo, note });
          }
        } else {
          entries.push({ variableId: binding.id, boundTo, note });
        }
      }

      return {
        variables: entries,
        source: "boundVariables",
        message: "Variables API requires Enterprise plan. Showing bound variable references only.",
      };
    }

    throw err;
  }
}
