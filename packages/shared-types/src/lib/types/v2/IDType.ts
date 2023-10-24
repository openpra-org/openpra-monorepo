/**
 * @file IDType.ts
 * @brief This file contains the type definition for IDType and a function to validate it.
 * @details The IDType is a string type. The function isValidIDType checks if the given ID is valid or not.
 * A valid ID should only contain alphanumeric characters (a-z, A-Z, 0-9).
 */

/**
 * @brief Type definition for IDType.
 * @details It is a string type.
 */
export type IDType = string;

/**
 * @brief Function to validate if the given ID is valid or not.
 * @details A valid ID should only contain alphanumeric characters (a-z, A-Z, 0-9).
 * @param {IDType} id - The ID to be validated.
 * @returns {boolean} - Returns true if the ID is valid, false otherwise.
 */
export const isValidIDType = (id: IDType): boolean => {
  const regex = /^[a-zA-Z0-9]+$/; // Regex to check if the ID contains only alphanumeric characters
  return regex.test(id);
};
