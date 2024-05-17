/**
 *  EventType.ts
 * @remarks This file contains the type definition for EventType.
 *  The EventType is an object type with optional id and label properties. The id is of IDType and the label is
 * of LabelType.
 */

import { LabelType } from "./LabelType";
import { IDType } from "./IDType";

/**
 * @remarks Type definition for EventType.
 *  It is an object type with optional id and label properties. The id is of IDType and the label is of LabelType.
 */
export interface EventType {
  id?: IDType;
  label?: LabelType;
}
