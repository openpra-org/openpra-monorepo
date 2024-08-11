import typia from "typia";

export interface Pagination {
  count: number;
  next: string | null;
  previous: string | null;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  results: any[];
}

export const PaginationSchema = typia.json.application<[Pagination], "3.0">();
