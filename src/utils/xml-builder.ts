import type { FigmaNode, NodeType } from "../types.js";

const TYPE_TO_TAG: Partial<Record<NodeType, string>> = {
  DOCUMENT: "document",
  CANVAS: "canvas",
  FRAME: "frame",
  GROUP: "group",
  SECTION: "section",
  COMPONENT: "component",
  COMPONENT_SET: "component-set",
  INSTANCE: "instance",
  TEXT: "text",
  VECTOR: "vector",
  RECTANGLE: "rectangle",
  ELLIPSE: "ellipse",
  LINE: "line",
  STAR: "star",
  POLYGON: "polygon",
  BOOLEAN_OPERATION: "boolean-operation",
  SLICE: "slice",
  STICKY: "sticky",
  SHAPE_WITH_TEXT: "shape-with-text",
  CONNECTOR: "connector",
  WASHI_TAPE: "washi-tape",
};

function tagForType(type: NodeType): string {
  return TYPE_TO_TAG[type] ?? type.toLowerCase().replace(/_/g, "-");
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildXml(node: FigmaNode, indent = 0): string {
  const tag = tagForType(node.type);
  const pad = "  ".repeat(indent);

  const bounds = node.absoluteBoundingBox;
  const attrs: string[] = [`id="${escapeXml(node.id)}"`, `name="${escapeXml(node.name)}"`];

  if (bounds) {
    attrs.push(`x="${bounds.x}"`, `y="${bounds.y}"`, `width="${bounds.width}"`, `height="${bounds.height}"`);
  }

  if (node.characters !== undefined) {
    attrs.push(`characters="${escapeXml(node.characters)}"`);
  }

  const attrStr = attrs.join(" ");

  if (!node.children || node.children.length === 0) {
    return `${pad}<${tag} ${attrStr}/>`;
  }

  const childLines = node.children.map((child) => buildXml(child, indent + 1)).join("\n");
  return `${pad}<${tag} ${attrStr}>\n${childLines}\n${pad}</${tag}>`;
}
