import { QuantifyRequest } from "./quantify-request";

export interface ScramAddonType {
  RunScramCli: (modelsWithConfigs: QuantifyRequest) => void;
}
