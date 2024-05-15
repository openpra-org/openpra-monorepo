import { GetCurrentModelType } from "shared-types/src/lib/api/TypedModelApiManager";

export const GetTypedModelName = (): string => {
  const typedModel = GetCurrentModelType();

  switch (typedModel) {
    case "internal-events":
      return "internalEvents";
    case "internal-hazards":
      return "internalHazards";
    case "external-hazards":
      return "externalHazards";
    case "full-scope":
      return "fullScope";
  }

  return "";
};
