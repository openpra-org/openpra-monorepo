import typia from 'typia';

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
export const ExecutionResultSchema = typia.json.application<
  [ExecutionResult],
  '3.0'
>();
