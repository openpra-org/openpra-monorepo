/** Source-term quantities used by a single RC release category. */
export interface RcSourceTermValues {
  groups: { id: number; name: string }[];
  inventory: { name: string; activityBq: number; group: number }[];
  releases: {
    id: number;
    startSeconds?: number;
    durationSeconds?: number;
    heightMetres?: number;
    /** Fraction of the initial group inventory in this segment; ordered as groups. */
    fractions: number[];
  }[];
}

export interface RcSourceTerm {
  revision: number;
  values: RcSourceTermValues;
  originalFile?: {
    documentId: string;
    filename: string;
    sha256: string;
    size: number;
    uploadedAt: string;
  };
}
