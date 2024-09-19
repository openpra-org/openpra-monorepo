import { QuantifyRequest } from "./quantify-request";

export interface ScramAddonType {
  /**
   * Synchronously runs the SCRAM CLI with the provided model configurations.
   * @param modelsWithConfigs - The configuration and model data for the SCRAM CLI.
   */
  RunScramCli: (modelsWithConfigs: QuantifyRequest) => void;
}

export interface AsyncScramAddonType {
  /**
   * Asynchronously runs the SCRAM CLI with the provided model configurations.
   * @param modelsWithConfigs - The configuration and model data for the SCRAM CLI.
   * @param callback - A callback function that is called upon completion of the operation.
   *                 The callback follows the Node.js standard of error-first callbacks.
   */
  RunScramCli: (modelsWithConfigs: QuantifyRequest, callback: (error: Error | null) => void) => void;
}
