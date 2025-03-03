import typia, { tags } from "typia";
import { Named, Unique } from "./meta";

/**
 * @namespace BaseEvents
 * @description Base event types and interfaces
 */

/**
 * Represents a frequency value that must be non-negative
 * @description Used for event frequencies across different event types
 */
export type Frequency = number & tags.Minimum<0>;

/**
 * Units used for frequency measurements in probabilistic risk assessment
 * @description Standardized units for expressing event frequencies across the PRA
 * @example
 * const unit: FrequencyUnit = FrequencyUnit.PER_REACTOR_YEAR;
 */
export enum FrequencyUnit {
    /** Frequency per reactor year - used for reactor-specific events */
    PER_REACTOR_YEAR = "per-reactor-year",
    
    /** Frequency per calendar year - used for site-wide events */
    PER_CALENDAR_YEAR = "per-calendar-year",
    
    /** Frequency per critical year - used for events that can only occur during critical operation */
    PER_CRITICAL_YEAR = "per-critical-year",
    
    /** Frequency per demand - used for events that occur upon system demand */
    PER_DEMAND = "per-demand"
}

/**
 * Base Event - parent of all events
 * @memberof BaseEvents
 * @extends {Unique}`
 * @extends {Named}
 */
export interface BaseEvent extends Unique, Named {
    description?: string;
}

/**
 * @namespace BasicEvents
 * @description Basic event types and their specializations
 */

/**
 * Basic Event type
 * @memberof BasicEvents
 * @extends {BaseEvent}
 */
export interface BasicEvent extends BaseEvent {
    eventType: "BASIC";
}

/**
 * @namespace FunctionalEvents
 * @description Functional event types and their specializations
 */

/**
 * Functional Event type
 * @memberof FunctionalEvents
 * @extends {BaseEvent}
 */
export interface FunctionalEvent extends BaseEvent {
    eventType: "FUNCTIONAL";
}

/**
 * Top Event
 * @memberof FunctionalEvents
 * @extends {FunctionalEvent}
 */
export interface TopEvent extends FunctionalEvent {
    eventSubType: "TOP";
}

/**
 * @namespace InitiatingEvents
 * @description Initiating event types
 */

/**
 * Initiating Event type
 * @memberof InitiatingEvents
 * @extends {BaseEvent}
 */
export interface InitiatingEvent extends BaseEvent {
    eventType: "INITIATING";
    frequency: Frequency;
}

/**
 * @namespace Validation
 * @description Schema validation for events
 */

/**
 * Event validation schemas
 * @memberof Validation
 */
export const EventSchemas = {
    base: typia.json.application<[BaseEvent], "3.0">(),
    basic: typia.json.application<[BasicEvent], "3.0">(),
    functional: typia.json.application<[FunctionalEvent], "3.0">(),
    top: typia.json.application<[TopEvent], "3.0">(),
    initiating: typia.json.application<[InitiatingEvent], "3.0">()
} as const;