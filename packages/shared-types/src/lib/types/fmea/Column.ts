export interface Column {
  id: string;
  name: string;
  type: string;
  dropdownOptions: {
    number: number;
    description: string;
  }[];
}
