import { Row } from './Row';
import { Column } from './Column';

/** FMEA table model containing columns and rows. */
export interface Fmea {
  id: number;
  title: string;
  description: string;
  columns: Column[];
  rows: Row[];
}
