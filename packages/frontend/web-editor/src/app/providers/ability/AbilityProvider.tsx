import { createContext, useContext } from "react";
import { createContextualCan } from "@casl/react";
import { AppAbility, DefaultAbility } from "./Ability";

/**
 * Context for providing `AppAbility` instance across the React component tree.
 *
 * @remarks
 * This context is used to provide a single instance of `AppAbility` throughout the application,
 * allowing components to consume the ability and enforce access control.
 *
 * @example
 * ```tsx
 * // In your component tree root
 * <AbilityContext.Provider value={userAbility}>
 *   <App />
 * </AbilityContext.Provider>
 * ```
 *
 * @typeParam AppAbility - The application's ability type.
 */
export const AbilityContext = createContext<AppAbility>(DefaultAbility());

/**
 * A higher-order component that creates a contextual `Can` component.
 *
 * @remarks
 * The `Can` component is used within the React component tree to conditionally render elements
 * based on the user's permissions. It leverages the `AbilityContext` to access the current user's
 * permissions and evaluate them against the required permissions to render a component.
 *
 * @example
 * ```tsx
 * // In a component
 * <Can I="edit" a="Post">
 *   <EditButton />
 * </Can>
 * ```
 */
export const Can = createContextualCan(AbilityContext.Consumer);

/**
 * Custom hook to use the `AppAbility` context.
 *
 * @remarks
 * This hook simplifies the consumption of `AppAbility` context within components,
 * providing a clean and easy way to access the user's permissions.
 *
 * @returns The `AppAbility` instance from the context.
 *
 * @example
 * ```tsx
 * // In a component
 * const ability = UseAbilityContext();
 * if (ability.can("read", "Article")) {
 *   // render something
 * }
 * ```
 */
export const UseAbilityContext = (): AppAbility => {
  return useContext(AbilityContext);
};
