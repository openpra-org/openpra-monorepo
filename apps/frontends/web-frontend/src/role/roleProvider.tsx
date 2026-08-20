import { createContext } from "react";
import { createContextualCan } from "@casl/react";
import { AppRole, DefaultRole } from "./role";

const RoleContext = createContext<AppRole>(DefaultRole());
const Can = createContextualCan(RoleContext.Consumer);

export { RoleContext, Can };
