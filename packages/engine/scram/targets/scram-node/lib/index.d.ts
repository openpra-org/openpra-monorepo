declare module "scram-node" {
  import { Callback } from "napi";
  import { Model } from "../../../types/model";
  import { QuantifyRequest, ScramNodeOptions } from "../../../types/quantify-request";
  import { QuantifyModelResult } from "../../../types/quantify-result";
  /**
   * @remarks Defines a class for asynchronous execution of SCRAM engine.
   *
   * This class inherits from Napi::AsyncWorker to perform tasks in a separate thread
   * and notify upon completion. It's designed to execute SCRAM-related operations
   * asynchronously in a Node.js environment.
   */
  export class AsyncScramWorker {
    /**
     * @remarks Constructor for ScramWorker.
     * @param callback - A Napi::Function reference for asynchronous callback.
     * @param args - 0 A vector of command-line arguments for the SCRAM engine.
     */
    constructor(callback: Callback, args: string[]);

    /**
     * @remarks Executes the main logic of the worker.
     *
     * This method contains the task to be performed in the background thread.
     * It's called automatically by the Node.js event loop.
     */
    execute(): void;

    /**
     * @remarks - Callback method called upon successful execution.
     *
     * This method is invoked when the Execute method completes successfully.
     * It's responsible for handling the results and invoking the JavaScript callback.
     */
    onOK(): void;
  }

  /**
   * @remarks Defines a class for synchronous execution.
   *
   * This class provides functionality for executing tasks synchronously
   * based on command-line arguments.
   */
  export class ScramWorker {
    /**
     * @remarks Constructor for ScramWorker.
     * @param args - A vector of command-line arguments.
     */
    constructor(args: string[]);

    /**
     * @remarks Executes the main logic of the worker.
     *
     * This method contains the synchronous execution logic based on
     * the provided command-line arguments.
     */
    execute(): void;
  }

  /**
   * @remarks Main Node.js wrapper function to run the SCRAM CLI asynchronously.
   *
   * @param info - The callback info from Node.js, containing the input arguments and callback function.
   * @param callback -
   * @returns Returns undefined on successful queuing of the task, or throws a JavaScript exception on error.
   */
  export function AsyncRunScramCli(info: QuantifyRequest, callback: Callback): void;

  /**
   * @remarks Main Node.js wrapper function to run the SCRAM CLI synchronously.
   *
   * @param info - The callback info from Node.js, containing the input arguments.
   * @returns Returns undefined on success, or throws a JavaScript exception on error.
   */
  export function RunScramCli(info: QuantifyRequest): void;

  export function QuantifyModel(options?: ScramNodeOptions, model?: Model): QuantifyModelResult;
}
