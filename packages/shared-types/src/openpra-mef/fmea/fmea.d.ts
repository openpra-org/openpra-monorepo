export interface DropdownOption {
  number?: number;
  description?: string;
}

export interface Column {
  id?: string;
  name?: string;
  type?: string;
  dropdownOptions?: DropdownOption[];
}

export interface Row {
  id?: number;
  row_data?: Map<string, string>;
}

export interface FmeaType {
  id?: number;
  title?: string;
  description?: string;
  columns?: Column[];
  rows?: Row[];
}
