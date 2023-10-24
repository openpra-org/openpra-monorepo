/**
 * @file EventType.ts
 * @brief This file contains the type definition for EventType.
 * @details The EventType is an object type with optional id and label properties. The id is of IDType and the label is
 * of LabelType.
 */

import { LabelType } from "./LabelType";
import { IDType } from "./IDType";

/**
 * @brief Type definition for EventType.
 * @details It is an object type with optional id and label properties. The id is of IDType and the label is of LabelType.
 */
export type EventType = {
  id?: IDType;
  label?: LabelType;
}
