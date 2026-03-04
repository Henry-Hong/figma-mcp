import type {
  FigmaApiError,
  FigmaImagesResponse,
  FigmaNodesResponse,
  FigmaVariablesResponse,
} from "./types.js";
import { RateLimiter } from "./utils/rate-limiter.js";

const FIGMA_API_BASE = "https://api.figma.com/v1";

function getApiKey(): string {
  const key = process.env["FIGMA_API_KEY"];
  if (!key) {
    throw new Error("FIGMA_API_KEY environment variable is required");
  }
  return key;
}

interface FetchErrorPayload {
  status: number;
  headers: Record<string, string>;
}

class FigmaHttpError extends Error {
  status: number;
  headers: Record<string, string>;

  constructor(message: string, status: number, headers: Record<string, string>) {
    super(message);
    this.name = "FigmaHttpError";
    this.status = status;
    this.headers = headers;
  }
}

export class FigmaClient {
  private readonly apiKey: string;
  private readonly rateLimiter: RateLimiter;

  constructor() {
    this.apiKey = getApiKey();
    this.rateLimiter = new RateLimiter();
  }

  private async request<T>(path: string, apiType: string): Promise<T> {
    return this.rateLimiter.throttle(apiType, () =>
      this.rateLimiter.withRetry(async () => {
        const response = await fetch(`${FIGMA_API_BASE}${path}`, {
          headers: {
            "X-Figma-Token": this.apiKey,
          },
        });

        if (!response.ok) {
          const headersMap: Record<string, string> = {};
          response.headers.forEach((value, key) => {
            headersMap[key] = value;
          });

          const error: FetchErrorPayload = {
            status: response.status,
            headers: headersMap,
          };

          const statusMessages: Record<number, string> = {
            401: "Figma API authentication failed. Check your FIGMA_API_KEY.",
            403: "Figma API access denied. Insufficient permissions for this resource.",
            404: "Figma node not found. Check the fileKey and nodeIds.",
            429: `429 Rate limit exceeded`,
          };

          const message = statusMessages[response.status] ?? `Figma API error: ${response.status}`;
          const httpError = new FigmaHttpError(message, error.status, error.headers);
          throw httpError;
        }

        return response.json() as Promise<T>;
      }),
    );
  }

  async getFileNodes(
    fileKey: string,
    nodeIds: string[],
    depth?: number,
  ): Promise<FigmaNodesResponse> {
    const params = new URLSearchParams({ ids: nodeIds.join(",") });
    if (depth !== undefined) {
      params.set("depth", String(depth));
    }
    return this.request<FigmaNodesResponse>(
      `/files/${fileKey}/nodes?${params.toString()}`,
      "nodes",
    );
  }

  async getImages(
    fileKey: string,
    nodeIds: string[],
    format = "png",
    scale = 1,
  ): Promise<FigmaImagesResponse> {
    const params = new URLSearchParams({
      ids: nodeIds.join(","),
      format,
      scale: String(scale),
    });
    return this.request<FigmaImagesResponse>(
      `/images/${fileKey}?${params.toString()}`,
      "images",
    );
  }

  async getFileVariables(fileKey: string): Promise<FigmaVariablesResponse> {
    try {
      return await this.request<FigmaVariablesResponse>(
        `/files/${fileKey}/variables/local`,
        "nodes",
      );
    } catch (err) {
      if (err instanceof FigmaHttpError && err.status === 403) {
        const apiError: FigmaApiError = {
          status: 403,
          message: err.message,
        };
        throw apiError;
      }
      throw err;
    }
  }
}
