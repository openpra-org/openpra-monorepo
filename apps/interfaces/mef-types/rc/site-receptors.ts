import type { RcSourceTerm } from "./source-term";

export interface RcSiteCoordinates { latitude: number; longitude: number; origin: string }
export interface RcReceptorPoint {
  id: string; x: number; y: number;
  elevationMetres?: number; hillHeightMetres?: number; heightMetres?: number;
  radiusMetres?: number; bearingDegrees?: number;
}
export interface RcCoordinateAnchor {
  localX: number; localY: number; utmEasting: number; utmNorthing: number; zone: number; datum: number;
}
export type RcReceptorGeometry = {
  kind: "cells"; radiiKm: number[]; sectors: number; center?: RcSiteCoordinates; abridged: boolean;
  /** Sector-major population counts; present only when every cell was supplied. */
  populationByCell?: number[];
} | {
  kind: "points"; points: RcReceptorPoint[]; anchor: RcCoordinateAnchor;
} | {
  kind: "grid"; points: RcReceptorPoint[]; anchor: RcCoordinateAnchor;
  radiiMetres: number[]; bearingsDegrees: number[]; originX: number; originY: number;
};
export interface RcSiteSettings {
  latitude?: number; longitude?: number; releaseX?: number; releaseY?: number;
  receptorHeightMetres?: number; cellPoint?: "mid" | "outer";
}
export interface RcSiteReceptors {
  revision: number;
  settings: RcSiteSettings;
  geometry?: RcReceptorGeometry;
  locationOrigin?: string;
  locationFile?: NonNullable<RcSourceTerm["originalFile"]>;
  geometryFile?: NonNullable<RcSourceTerm["originalFile"]>;
}
export interface RcEvaluatedReceptor {
  id: string; distanceMetres: number; bearingDegrees: number; heightMetres: number;
  bearingReference: "compass_north" | "grid_north";
  x?: number; y?: number; elevationMetres?: number; hillHeightMetres?: number;
  sector?: number; band?: number;
}
