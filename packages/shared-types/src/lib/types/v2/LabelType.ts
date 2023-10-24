/**
 * @file LabelType.ts
 * @brief This file contains the type definitions for NameType, DescriptionType and LabelType.
 * @details The NameType and DescriptionType are string types. The LabelType is an object type with optional name and
 * description properties.
 */

/**
 * @brief Type definition for NameType.
 * @details It is a string type.
 */
export type NameType = string;

/**
 * @brief Type definition for DescriptionType.
 * @details It is a string type.
 */
export type DescriptionType = string;

/**
 * @brief Type definition for LabelType.
 * @details It is an object type with optional name and description properties. Both properties are string types.
 */
export type LabelType = {
  name?: NameType;
  description?: DescriptionType;
};
