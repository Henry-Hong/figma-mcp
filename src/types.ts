export type NodeType =
  | "DOCUMENT"
  | "CANVAS"
  | "FRAME"
  | "GROUP"
  | "SECTION"
  | "COMPONENT"
  | "COMPONENT_SET"
  | "INSTANCE"
  | "TEXT"
  | "VECTOR"
  | "RECTANGLE"
  | "ELLIPSE"
  | "LINE"
  | "STAR"
  | "POLYGON"
  | "BOOLEAN_OPERATION"
  | "SLICE"
  | "STICKY"
  | "SHAPE_WITH_TEXT"
  | "CONNECTOR"
  | "WASHI_TAPE";

export interface Trigger {
  type:
    | "ON_CLICK"
    | "ON_HOVER"
    | "ON_PRESS"
    | "ON_DRAG"
    | "AFTER_TIMEOUT"
    | "MOUSE_ENTER"
    | "MOUSE_LEAVE"
    | "MOUSE_UP"
    | "MOUSE_DOWN"
    | "ON_KEY_DOWN"
    | "ON_KEY_UP"
    | "ON_MEDIA_HIT"
    | "ON_MEDIA_END";
  timeout?: number;
  keyCodes?: number[];
  delay?: number;
}

export interface Transition {
  type: "DISSOLVE" | "SMART_ANIMATE" | "SLIDE_IN" | "SLIDE_OUT" | "PUSH" | "MOVE_IN" | "MOVE_OUT";
  duration: number;
  easing: {
    type: "EASE_IN" | "EASE_OUT" | "EASE_IN_AND_OUT" | "LINEAR" | "CUSTOM_BEZIER";
  };
  direction?: "LEFT" | "RIGHT" | "TOP" | "BOTTOM";
}

export type Action =
  | {
      type: "NODE";
      destinationId: string | null;
      navigation: "NAVIGATE" | "OVERLAY" | "SWAP" | "SCROLL_TO";
      transition?: Transition;
      preserveScrollPosition?: boolean;
    }
  | { type: "BACK" }
  | { type: "CLOSE" }
  | { type: "OPEN_URL"; url: string }
  | { type: "SET_VARIABLE"; variableId: string; variableValue: unknown }
  | { type: "CONDITIONAL"; conditionalBlocks: unknown[] };

export interface Interaction {
  trigger: Trigger;
  actions: Action[];
}

export interface BoundVariable {
  type: string;
  id: string;
}

export interface FigmaNode {
  id: string;
  name: string;
  type: NodeType;
  children?: FigmaNode[];
  interactions?: Interaction[];
  boundVariables?: Record<string, BoundVariable | BoundVariable[]>;
  absoluteBoundingBox?: { x: number; y: number; width: number; height: number };
  absoluteRenderBounds?: { x: number; y: number; width: number; height: number };
  fills?: unknown[];
  strokes?: unknown[];
  effects?: unknown[];
  style?: unknown;
  styles?: Record<string, string>;
  characters?: string;
}

export interface FigmaNodesResponse {
  nodes: Record<string, { document: FigmaNode } | null>;
}

export interface FigmaImagesResponse {
  err: string | null;
  images: Record<string, string | null>;
}

export interface FigmaVariable {
  id: string;
  name: string;
  key: string;
  variableCollectionId: string;
  resolvedType: "BOOLEAN" | "FLOAT" | "STRING" | "COLOR";
  valuesByMode: Record<string, unknown>;
  remote: boolean;
  description: string;
  hiddenFromPublishing: boolean;
  scopes: string[];
  codeSyntax: Record<string, unknown>;
}

export interface FigmaVariableCollection {
  id: string;
  name: string;
  key: string;
  modes: Array<{ modeId: string; name: string }>;
  defaultModeId: string;
  remote: boolean;
  hiddenFromPublishing: boolean;
  variableIds: string[];
}

export interface FigmaVariablesResponse {
  status: number;
  error: boolean;
  meta: {
    variables: Record<string, FigmaVariable>;
    variableCollections: Record<string, FigmaVariableCollection>;
  };
}

export interface FigmaApiError {
  status: number;
  message: string;
}
