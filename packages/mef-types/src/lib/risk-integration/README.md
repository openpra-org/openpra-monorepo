# Risk Integration Module

## Overview

The Risk Integration module is a downstream technical element in the OpenPRA framework that synthesizes outputs from multiple upstream elements to calculate overall risk metrics and identify significant contributors. This module follows the requirements from RG 1.247 for acceptable NLWR PRA.

## Dependency Structure

This module implements a clean, hierarchical dependency structure:

```
Core Elements (events, shared patterns)
         ↓
Midstream Elements (ESQ, RCA)
         ↓
Risk Integration
```

### Key Design Principles

1. **Clean Dependency Hierarchy**: Risk Integration primarily depends on Event Sequence Quantification (ESQ) and Radiological Consequence Analysis (RCA), which serve as proxy layers for upstream elements.

2. **Reference Types**: Uses string-based reference types (e.g., `EventSequenceReference`) to maintain loose coupling between modules.

3. **Proxied Imports**: Imports types from ESQ and RCA that re-export necessary types from upstream elements, avoiding direct dependencies.

4. **Bidirectional Feedback**: Provides structured feedback to upstream modules through dedicated feedback interfaces.

## Files in this Directory

- **risk-integration.ts**: Main schema file containing all interface definitions
- **index.ts**: Export file providing simplified imports and dependency management
- **integration-readme.md**: Detailed guide to integration with other technical elements
- **dependency-examples.md**: Examples of proper usage patterns and anti-patterns
- **README.md**: This file - overview and structure explanation

## Usage

Import the Risk Integration module using one of these patterns:

```typescript
// Import the entire module
import * as RiskIntegration from "../technical-elements/risk-integration";

// Import specific interfaces
import { RiskSignificanceCriteria, IntegratedRiskResults } from "../technical-elements/risk-integration";

// Import the main interface
import { RiskIntegration } from "../technical-elements/risk-integration";
```

## Best Practices

1. Always use ESQ and RCA as intermediaries instead of importing directly from upstream modules
2. Use reference types when referring to entities from other modules
3. Document feedback mechanisms for upstream modules
4. Keep dependencies unidirectional

## Documentation

For detailed implementation examples and integration patterns, see the following files:

- **integration-readme.md**: Integration architecture and patterns
- **dependency-examples.md**: Code examples and anti-patterns
- **Risk Integration Documentation.md**: Traceability to regulatory requirements
