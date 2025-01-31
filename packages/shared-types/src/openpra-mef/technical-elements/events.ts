import typia, { tags } from "typia";
import { Named, Unique } from "./meta";

// Base Event - parent of all events
export interface BaseEvent extends Unique, Named {
    description?: string;
}

// Basic Event branch
export interface BasicEvent extends BaseEvent {
    eventType: "BASIC";
    probability: number & tags.Minimum<0>;
}

export interface LicensingBasisEvent extends BasicEvent {
    eventSubType: "LICENSING_BASIS";
}

// Functional Event branch
export interface FunctionalEvent extends BaseEvent {
    eventType: "FUNCTIONAL";
}

export interface TopEvent extends FunctionalEvent {
    eventSubtType: "TOP";
}

// Initiating Event branch (keeping your existing structure)
export interface InitiatingEvent extends BaseEvent {
    eventType: "INITIATING";
    frequency: number & tags.Minimum<0>;
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