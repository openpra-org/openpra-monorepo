import type { BuilderBase } from "../core/builder-base";
import { valueError } from "../core/errors";
import { getValueOr, strip, text } from "../core/spec-values";
import type { SpecMapping } from "../core/spec-values";
import { ConstantNodeBuilder } from "./constant-node";
import { FireBuilder } from "./fire";
import { FlexBuilder } from "./flex";
import { FloodBuilder } from "./flood";
import { FloodBuildingsBuilder } from "./flood-buildings";
import { HraBuilder } from "./hra";
import { InternalFloodBuilder } from "./internal-flood";
import { RecoveryBuilder } from "./recovery";
import { SeismicBuilder } from "./seismic";

const createBuilder = (config: SpecMapping): BuilderBase => {
  const builderType = strip(text(getValueOr(config, "type", ""))).toLowerCase();
  if (builderType === "constant_node") return new ConstantNodeBuilder(config);
  if (builderType === "seismic") return new SeismicBuilder(config);
  if (builderType === "flood") return new FloodBuilder(config);
  if (builderType === "flood_buildings") return new FloodBuildingsBuilder(config);
  if (builderType === "internal_flood") return new InternalFloodBuilder(config);
  if (builderType === "fire") return new FireBuilder(config);
  if (builderType === "flex") return new FlexBuilder(config);
  if (builderType === "hra") return new HraBuilder(config);
  if (builderType === "recovery") return new RecoveryBuilder(config);
  throw valueError(`Unsupported builder type: '${text(getValueOr(config, "type", null))}'.`);
};

export { createBuilder };
