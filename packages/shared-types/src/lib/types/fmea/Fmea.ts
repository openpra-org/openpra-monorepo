import { Row } from "./Row";
import { Column } from "./Column";
export interface Fmea {
  id: number;
  title: string;
  description: string;
  columns: Column[];
  rows: Row[];
}
