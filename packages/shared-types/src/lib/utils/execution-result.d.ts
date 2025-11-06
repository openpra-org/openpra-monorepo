export interface ExecutionResult {
  _id?: string;
  /**
   * exit code associated with the process performing this execution task.
   *
   * Always between 0 and 255.
   */
  exit_code: number;
  stderr: string;
  stdout: string;
}
