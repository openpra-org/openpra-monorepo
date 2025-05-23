import { createContextualCan } from "@casl/react";
import { createContext } from "react";

import { AppAbility, DefaultAbility } from "../casl/ability";

const AbilityContext = createContext<AppAbility>(DefaultAbility());
const Can = createContextualCan(AbilityContext.Consumer);

export { AbilityContext, Can };
