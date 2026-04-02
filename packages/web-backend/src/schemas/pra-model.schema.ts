export enum PraModelType {
  INTERNAL_EVENTS = "internal-events",
  INTERNAL_HAZARDS = "internal-hazards",
  EXTERNAL_HAZARDS = "external-hazards",
  FULL_SCOPE = "full-scope",
}

export interface PraModelMeta {
  uuid: string;
  name: string;
  type: PraModelType;
  ownerId: string;
  createdAt: string;
}
