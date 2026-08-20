export interface PhaReconItem {
  topic: string;
  fmea: string;
  hazop: string;
  resolution: string;
  ie: string;
}

export interface PhaModel {
  scope: string;
  reconciledFmea: string[];
  reconciledHazop: string[];
  directInitiators: string[];
  items: PhaReconItem[];
}
