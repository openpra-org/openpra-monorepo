/**
 * @packageDocumentation
 * MEF technical element type utilities and helpers.
 *
 * This package contains small runtime helpers and type-centric utilities
 * around MEF technical elements extracted from shared-types.
 */
// Runtime-light helpers (keep minimal; this package is primarily types-only)
export * from './lib/mef-types';

// Public type barrels for common MEF contracts used across the monorepo.
// Note: keep these exports type-only to avoid runtime resolution of .d.ts files.

export type {
  CommandLineOptions,
  QuantifyRequest,
  QuantifyRequest1,
  QuantifyRequest2,
} from 'shared-types';
export type { QuantifyReport, BinaryQuantifyReport } from 'shared-types';
export type { ExecutionTask } from 'shared-types';
export type { ExecutionResult } from 'shared-types';
