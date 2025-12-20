/**
 * OpenPRA Shared Types (pure TS types and DTOs).
 *
 * This package is the source of truth for shared domain types used across the
 * frontend and backend. It contains only type definitions (no runtime code)
 * and is safe to import in any environment.
 *
 * Prefer importing from this package instead of duplicating type shapes.
 * @packageDocumentation
 */
// Expose the curated barrel for external consumers
export * from './lib/index';
// Keep local utility export if needed by internal callers
export * from './lib/shared-types';
