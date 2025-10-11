/**
 * @packageDocumentation
 * @module technical_elements.core
 */
import typia, { tags } from "typia";
import { Named, Unique } from "./meta";

/**
 * @namespace technical_elements.core.events
 * @description Base event types and interfaces for the technical elements
 */

/**
 * Represents a frequency value that must be non-negative
 * @description Used for event frequencies across different event types
 * @memberof technical_elements.core.events
 * @group Events
 */
export type Frequency = number & tags.Minimum<0>;

/**
 * Types of probability distributions used for uncertainty analysis
 * @description Standardized distribution types used across the PRA
 * @memberof technical_elements.core.events
 * @group Events
 */
export enum DistributionType {
  EXPONENTIAL = "exponential",
  BINOMIAL = "binomial",
  NORMAL = "normal",
  LOGNORMAL = "lognormal",
  WEIBULL = "weibull",
  POISSON = "poisson",
  UNIFORM = "uniform",
  BETA = "beta",
  GAMMA = "gamma",
  POINT_ESTIMATE = "point_estimate"
}

/**
 * Comprehensive frequency representation with distribution information
 * @description Extended frequency type that includes unit, distribution, and source information
 * @memberof technical_elements.core.events
 * @group Events
 */
export interface FrequencyWithDistribution {
  /** Mean or point estimate value of the frequency */
  value: Frequency;
  
  /** Units of measurement for the frequency */
  units: FrequencyUnit;
  
  /** Distribution information for uncertainty analysis */
  distribution?: {
    /** Type of probability distribution */
    type: DistributionType;
    
    /** Parameters of the distribution */
    parameters: number[];
  };
  
  /** Source of the frequency data */
  source?: string;
}

/**
 * Units used for frequency measurements in probabilistic risk assessment
 * @description Standardized units for expressing event frequencies across the PRA
 * @example
 * const unit: FrequencyUnit = FrequencyUnit.PER_REACTOR_YEAR;
 * @memberof technical_elements.core.events
 * @group Events
 */
export enum FrequencyUnit {
  /** Frequency per reactor year - used for reactor-specific events */
  PER_REACTOR_YEAR = "per-reactor-year",
  /** Frequency per calendar year - used for site-wide events */
  PER_CALENDAR_YEAR = "per-calendar-year",
  /** Frequency per critical year - used for events that can only occur during critical operation */
  PER_CRITICAL_YEAR = "per-critical-year",
  /** Frequency per demand - used for events that occur upon system demand */
  PER_DEMAND = "per-demand",
  /** Frequency per plant year - used for plant-wide events */
  PER_PLANT_YEAR = "per-plant-year"
}

/**
 * Base Event - parent of all events
 * @memberof technical_elements.core.events
 * @extends {Unique}
 * @extends {Named}
 * @group Events
 */
export interface BaseEvent extends Unique, Named {
  description?: string;
}

/**
 * @namespace technical_elements.core.events.basic
 * @description Basic event types and their specializations
 */

/**
 * Basic Event type
 * @memberof technical_elements.core.events.basic
 * @extends {BaseEvent}
 * @group Events
 */
export interface BasicEvent extends BaseEvent {
  eventType: "BASIC";
}

/**
 * @namespace technical_elements.core.events.functional
 * @description Functional event types and their specializations
 */

/**
 * Functional Event type
 * @memberof technical_elements.core.events.functional
 * @extends {BaseEvent}
 * @group Events
 */
export interface FunctionalEvent extends BaseEvent {
  eventType: "FUNCTIONAL";
}

/**
 * Top Event
 * @memberof technical_elements.core.events.functional
 * @extends {FunctionalEvent}
 * @group Events
 */
export interface TopEvent extends FunctionalEvent {
  eventSubType: "TOP";
}

/**
 * @namespace technical_elements.core.events.initiating
 * @description Initiating event types
 */

/**
 * Initiating Event type
 * @memberof technical_elements.core.events.initiating
 * @extends {BaseEvent}
 * @group Events
 */
export interface InitiatingEvent extends BaseEvent {
  eventType: "INITIATING";
  
  /**
   * Frequency of the initiating event
   * @description Can be either a simple numeric frequency or a complex object with distribution information
   */
  frequency: Frequency | FrequencyWithDistribution;
}

/**
 * @namespace technical_elements.core.validation
 * @description Schema validation for events
 */

/**
 * @internal
 * Event validation schemas
 * @memberof technical_elements.core.validation
 * @group Events
 */
export const EventSchemas = {
  base: typia.json.application<[BaseEvent], "3.0">(),
  basic: typia.json.application<[BasicEvent], "3.0">(),
  functional: typia.json.application<[FunctionalEvent], "3.0">(),
  top: typia.json.application<[TopEvent], "3.0">(),
  initiating: typia.json.application<[InitiatingEvent], "3.0">()
} as const;