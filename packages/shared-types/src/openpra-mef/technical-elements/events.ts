import typia, { tags } from "typia";
import { Named, Unique } from "./meta";

/**
 * @interface
 * @extends {Unique}
 * @extends {Named}
 */
export interface BaseEvent extends Unique, Named {
    description?: string;
}

/**
 * @interface
 * @extends {BaseEvent}
 */
export interface BasicEvent extends BaseEvent {
    eventType: "BASIC";
}

/**
 * @interface
 * @extends {BasicEvent}
 */
export interface LicensingBasisEvent extends BasicEvent {
    eventSubType: "LICENSING_BASIS";
}

/**
 * @interface
 * @extends {BaseEvent}
 */
export interface FunctionalEvent extends BaseEvent {
    eventType: "FUNCTIONAL";
}

/**
 * @interface
 * @extends {FunctionalEvent}
 */
export interface TopEvent extends FunctionalEvent {
    eventSubType: "TOP";
}

/**
 * @interface
 * @extends {BaseEvent}
 */
export interface InitiatingEvent extends BaseEvent {
    eventType: "INITIATING";
}

// Schema validation
export const EventSchemas = {
    base: typia.json.application<[BaseEvent], "3.0">(),
    basic: typia.json.application<[BasicEvent], "3.0">(),
    licensing: typia.json.application<[LicensingBasisEvent], "3.0">(),
    functional: typia.json.application<[FunctionalEvent], "3.0">(),
    top: typia.json.application<[TopEvent], "3.0">(),
    initiating: typia.json.application<[InitiatingEvent], "3.0">()
} as const;