export type AddColumnBody = {
  name: string;
  type: "string" | "dropdown";
  dropdownOptions?: {
    number: number;
    description: string;
  }[];
};
