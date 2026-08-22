type WorkbookId = string;
type WorkbookRevision = number;
type WorkbookModelId = string;
type WorkbookEntityId = string;

interface WorkbookAddress {
  workbookId: WorkbookId;
}

interface WorkbookModelAddress extends WorkbookAddress {
  modelId: WorkbookModelId;
}

interface WorkbookEntityAddress extends WorkbookAddress {
  entityId: WorkbookEntityId;
}

interface WorkbookModelEntityAddress extends WorkbookModelAddress {
  entityId: WorkbookEntityId;
}

interface WorkbookSnapshotIdentity extends WorkbookAddress {
  workbookRevision: WorkbookRevision;
}

interface WorkbookModelSnapshotIdentity extends WorkbookModelAddress, WorkbookSnapshotIdentity {}

interface WorkbookModelEntitySnapshotIdentity extends WorkbookModelEntityAddress, WorkbookSnapshotIdentity {}

/** @deprecated Use WorkbookModelSnapshotIdentity; a revision is not part of a durable model address. */
type WorkbookModelIdentity = WorkbookModelSnapshotIdentity;
/** @deprecated Use WorkbookModelEntitySnapshotIdentity; a revision is not part of a durable entity address. */
interface WorkbookEntityIdentity extends WorkbookModelIdentity {
  entityId: WorkbookEntityId;
}

/** @deprecated Use WorkbookModelId for workbook-owned model definitions. */
type MethodModelId = WorkbookModelId;
/** @deprecated Use WorkbookEntityId for workbook-owned model definitions. */
type MethodEntityId = WorkbookEntityId;

interface CanvasPosition {
  x: number;
  y: number;
}

interface CanvasViewport extends CanvasPosition {
  zoom: number;
}

type CanvasLayoutMode = "MANUAL" | "AUTOMATIC";
type CanvasLayoutDirection = "TOP_TO_BOTTOM" | "LEFT_TO_RIGHT";

interface CanvasLayoutMetadata {
  viewport: CanvasViewport;
  mode: CanvasLayoutMode;
  direction: CanvasLayoutDirection;
}

/** @deprecated Use a typed workbook reference with workbook scope. */
interface MethodModelReference {
  modelId: MethodModelId;
}

/** @deprecated Use a typed workbook reference with workbook and entity scope. */
interface MethodEntityReference extends MethodModelReference {
  entityId: MethodEntityId;
}

export type {
  WorkbookId,
  WorkbookRevision,
  WorkbookModelId,
  WorkbookEntityId,
  WorkbookAddress,
  WorkbookModelAddress,
  WorkbookEntityAddress,
  WorkbookModelEntityAddress,
  WorkbookSnapshotIdentity,
  WorkbookModelSnapshotIdentity,
  WorkbookModelEntitySnapshotIdentity,
  WorkbookModelIdentity,
  WorkbookEntityIdentity,
  MethodModelId,
  MethodEntityId,
  CanvasPosition,
  CanvasViewport,
  CanvasLayoutMode,
  CanvasLayoutDirection,
  CanvasLayoutMetadata,
  MethodModelReference,
  MethodEntityReference,
};
