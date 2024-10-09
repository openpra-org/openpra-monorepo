import typia, { tags } from "typia";

export interface Unique {
  uuid: tags.Format<"uuid">;
}

export interface Named {
  name: string;
}

export const UniqueTagSchema = typia.json.application<[Unique], "3.0">();

export const NamedTagSchema = typia.json.application<[Named], "3.0">();
