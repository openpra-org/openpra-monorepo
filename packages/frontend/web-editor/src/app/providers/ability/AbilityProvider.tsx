import { createContext } from "react";
import { createContextualCan } from "@casl/react";
import { AppAbility, DefaultAbility } from "./Ability";

/**
 * Creates a React context for the `AppAbility` instance.
 * This context will provide the ability throughout the React component tree.
 */
const AbilityContext = createContext<AppAbility>(DefaultAbility());

/**
 * Creates a contextual `Can` component that uses the `AbilityContext` to check permissions.
 * This component can be used in the React component tree to conditionally render elements
 * based on the user's permissions.
 */
const Can = createContextualCan(AbilityContext.Consumer);

export { AbilityContext, Can };
