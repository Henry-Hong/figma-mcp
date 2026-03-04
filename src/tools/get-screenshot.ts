import type { FigmaClient } from "../figma-client.js";

const ALLOWED_IMAGE_ORIGINS = [
  "https://figma-alpha-api.s3.us-west-2.amazonaws.com",
  "https://s3-alpha-sig.figma.com",
  "https://s3.amazonaws.com",
];

function validateImageUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid image URL received from Figma API");
  }
  const origin = parsed.origin;
  if (!ALLOWED_IMAGE_ORIGINS.includes(origin)) {
    throw new Error(`Image URL origin not allowed: ${origin}`);
  }
}

export interface GetScreenshotResult {
  type: "image";
  data: string;
  mimeType: "image/png";
}

export async function getScreenshot(
  client: FigmaClient,
  fileKey: string,
  nodeId: string,
): Promise<GetScreenshotResult> {
  const response = await client.getImages(fileKey, [nodeId], "png", 1);

  const imageUrl = response.images[nodeId];
  if (!imageUrl) {
    throw new Error(`Failed to generate screenshot for node ${nodeId}`);
  }

  validateImageUrl(imageUrl);
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch screenshot image: ${imageResponse.status}`);
  }

  const buffer = await imageResponse.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");

  return {
    type: "image",
    data: base64,
    mimeType: "image/png",
  };
}
