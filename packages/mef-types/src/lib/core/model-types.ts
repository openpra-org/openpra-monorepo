export interface ModelType {
  num: number;
  name: string;
  suffix?: string;
  color?: number;
  description: string;
}
export const defaultModelTypes: ModelType[] = [
  {
    num: 1,
    name: "Random Failures",
    suffix: "RF",
    description: "Model considering only random hardware failures and human errors during normal operation.",
  },
  {
    num: 2,
    name: "Seismic Events",
    suffix: "SE",
    description: "Model focused on initiating events and failures caused by seismic activity.",
  },
  {
    num: 3,
    name: "Internal Fire",
    suffix: "IF",
    description: "Model addressing initiating events and failures resulting from internal fire events.",
  },
  {
    num: 4,
    name: "Internal Flood",
    suffix: "FL",
    description: "Model addressing initiating events and failures resulting from internal flooding events.",
  },
  {
    num: 5,
    name: "High Winds",
    suffix: "HW",
    description: "Model addressing initiating events and failures caused by high wind events.",
  },
  {
    num: 6,
    name: "External Flooding",
    suffix: "XF",
    description: "Model addressing initiating events and failures caused by external flooding events.",
  },
  {
    num: 7,
    name: "Other Hazards",
    suffix: "OH",
    description: "Model addressing initiating events and failures caused by other hazards not explicitly listed.",
  },
];
export function getModelTypeById(id: number): ModelType | undefined {
  return defaultModelTypes.find((model) => model.num === id);
}
export function getModelTypeBySuffix(suffix: string): ModelType | undefined {
  return defaultModelTypes.find((model) => model.suffix === suffix);
}
