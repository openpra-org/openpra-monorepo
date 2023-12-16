/**
 *  LabelType.ts
 * @remarks This file contains the type definitions for NameType, DescriptionType and LabelType.
 *  The NameType and DescriptionType are string types. The LabelType is an object type with optional name and
 * description properties.
 */

/**
 * @remarks Type definition for NameType.
 *  It is a string type.
 */
export type NameType = string;

/**
 * @remarks Type definition for DescriptionType.
 *  It is a string type.
 */
export type DescriptionType = string;

/**
 * @remarks Type definition for LabelType.
 *  It is an object type with optional name and description properties. Both properties are string types.
 */
export type LabelType = {
  name?: NameType;
  description?: DescriptionType;
};
