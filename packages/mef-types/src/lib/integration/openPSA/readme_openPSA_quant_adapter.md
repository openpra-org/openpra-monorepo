# Quantification Adapter for OpenPRA

This adapter provides integration between OpenPRA's data model and a third-party quantification engine interface (`QuantificationInput`). It enables quantification of OpenPRA PRA models without modifying the OpenPRA schema, maintaining a clean separation between systems.

## Purpose

The adapter serves as a bridge between:

- **OpenPRA's data model**: A comprehensive schema for probabilistic risk assessment modeling
- **Third-party quantification engine**: A specialized engine for quantifying fault trees and event trees

## Implementation Approach

The adapter is implemented with two main components:

1. **`quantification-adapter-types.ts`**: Contains adapter-specific type definitions that shadow the OpenPRA types
2. **`quantification-adapter.ts`**: Contains the conversion logic using these type definitions

This approach ensures:

- No modifications to OpenPRA's schema
- Type safety within the adapter code
- Runtime resilience with defensive property access

## Key Features

- No modifications to OpenPRA's schema
- One-way conversion from OpenPRA to the quantification format
- Clean error handling for incompatible elements
- Support for partial model conversion when complete conversion isn't needed
- Safe property access through `safeGet()` helper function
- **Data Analysis integration** for improved parameter handling

## Data Analysis Integration

The quantification adapter now supports integration with OpenPRA's Data Analysis module, enabling:

1. **Enhanced Parameter Representation**: Uses detailed probability distributions and uncertainty information from Data Analysis
2. **Cross-Module References**: Maintains links between Systems Analysis and Data Analysis entities
3. **Richer Quantification Input**: Produces more accurate quantification models with detailed parameter information

### Integration Points

The adapter now recognizes and processes:

- **Basic Event Probability Models**: Uses `probabilityModel` from Data Analysis when available
- **CCF Parameters**: Imports detailed Common Cause Failure models from Data Analysis
- **Component Failure Data**: Includes comprehensive failure data in the quantification model
- **Global Parameters**: Supports references to Data Analysis parameters

### Prioritization Logic

When converting model elements, the adapter follows this prioritization:

1. Data Analysis data (most detailed and preferred)
2. Systems Analysis extended attributes
3. Simple probability values (fallback option)

### Usage Example with Data Analysis Integration

```typescript
// Import models from both Systems Analysis and Data Analysis
import { QuantificationAdapter } from "mef-types/src/lib/integration";

// Ensure your Systems Analysis model has references to Data Analysis
// This can be done via the dataAnalysisReference field in the SystemsAnalysis interface

// Convert with the Data Analysis integration
const result = QuantificationAdapter.convertToQuantificationInput(
  openPRASystemsAnalysis, // Your OpenPRA systems analysis model with Data Analysis references
  openPRAEventSequenceAnalysis, // Your OpenPRA event sequence analysis model
);

// The quantification input now includes rich data from both modules
const quantificationInput = result.quantificationInput;
```

## How to Use the Adapter

### Basic Usage

```typescript
import { QuantificationAdapter } from "mef-types/src/lib/integration";

// Convert OpenPRA models to the quantification input format
const result = QuantificationAdapter.convertToQuantificationInput(
  openPRASystemsAnalysis, // Your OpenPRA systems analysis model
  openPRAEventSequenceAnalysis, // Your OpenPRA event sequence analysis model
  openPRAInitiatingEventsAnalysis, // Optional - initiating events analysis
  {
    includeEventTrees: true, // Optional configuration
    includeFaultTrees: true,
    includeCCFGroups: true,
    errorHandling: "warn", // "fail", "warn", or "ignore"
  },
);

// Access the converted model
const quantificationInput = result.quantificationInput;

// Check for any conversion warnings
console.log(`Conversion completed with ${result.warnings.length} warnings`);
if (result.warnings.length > 0) {
  console.log(result.warnings);
}

// Use ID mapping to trace between models
const openPRAId = "BE-001";
const quantificationId = result.idMapping[openPRAId];
```

### TypeScript Considerations

Since the adapter uses its own type definitions, you have two options for type safety:

#### Option 1: Use Type Assertion (Simplest)

```typescript
import { QuantificationAdapter } from "../shared-types/src/openpra-mef/technical-elements/integration";

// Just pass your OpenPRA models directly
const result = QuantificationAdapter.convertToQuantificationInput(systemsAnalysis, eventSequenceAnalysis);
```

#### Option 2: Use the Adapter's Type Conversion Functions (More Type-Safe)

```typescript
import { QuantificationAdapter } from "mef-types/src/lib/integration";
import { asSystemsAnalysis, asEventSequenceAnalysis } from "mef-types/src/lib/integration";

// First convert to adapter types (optional, performed internally anyway)
const adaptedSystemsAnalysis = asSystemsAnalysis(systemsAnalysis);
const adaptedEventSequenceAnalysis = asEventSequenceAnalysis(eventSequenceAnalysis);

// Then convert to quantification input
const result = QuantificationAdapter.convertToQuantificationInput(adaptedSystemsAnalysis, adaptedEventSequenceAnalysis);
```

### Handling Errors and Warnings

The adapter uses a defensive approach to handle missing or incompatible data:

1. **Error Handling**: Configure with `errorHandling` option:
   - `"fail"`: Throws errors when critical issues are encountered
   - `"warn"`: Records warnings but continues conversion (default)
   - `"ignore"`: Silently skips problematic elements

2. **Warnings**: Always check `result.warnings` for conversion issues

3. **Partial Conversion**: Even with errors, a partial model is returned with placeholders

### Validation

The adapter performs basic validation by default (can be disabled with `validateOutput: false`):

- Checks for required fields
- Validates fault tree and event tree structures
- Reports missing events or sequences

## Compatibility Gaps

The adapter addresses several key differences between the OpenPRA model and the third-party quantification interface:

### 1. Schema Structure Differences

| OpenPRA                              | Quantification Input                 | Adaptation Approach                                     |
| ------------------------------------ | ------------------------------------ | ------------------------------------------------------- |
| Node-based fault tree representation | Formula-based logical representation | Convert OpenPRA's node structure to formula structure   |
| Event tree with sequence paths       | Branch-based event tree structure    | Map sequences to branch paths                           |
| Diverse parameter expressions        | Hierarchical expression model        | Convert to prescribed expression structure              |
| Varied component references          | Component definition structure       | Map component attributes to required format             |
| **Data Analysis module**             | Parameter expression format          | Map detailed probability models to expression structure |

### 2. Data Type Gaps

| Element                           | Gap                                                                    | Solution                                                     |
| --------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| House events                      | OpenPRA doesn't directly map house events as in the third-party schema | Extract implied house events from fault tree conditions      |
| Common cause failure (CCF) groups | Different format for factor representation                             | Map OpenPRA CCF groups to the expected structure             |
| Expression models                 | Different approach to mathematical expressions                         | Convert expressions to the hierarchical format               |
| Event tree sequences              | Different representation of paths                                      | Map OpenPRA sequences to branch/path structure               |
| **Probability distributions**     | Different distribution representation                                  | Convert Data Analysis distributions to quantification format |

### 3. Functional Gaps

| Functionality          | Gap                                              | Workaround                                                            |
| ---------------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| Substitutions          | OpenPRA may not have direct substitution support | Create placeholders as needed                                         |
| External libraries     | Different approach to external functions         | Map to the external library format when available                     |
| Expression types       | Different supported mathematical functions       | Map to closest equivalent expressions                                 |
| **Complex CCF models** | Different parameterization approach              | Extract factors from Data Analysis modules and map to expected format |

## Type Compatibility Solutions

### Our Solution: Shadow Types

Instead of modifying OpenPRA's schema, we've created adapter-specific type definitions in `quantification-adapter-types.ts` that:

1. **Shadow the official types**: Define only the properties needed by the adapter
2. **Provide type conversion functions**: `asSystemsAnalysis()`, `asEventSequenceAnalysis()`, etc.
3. **Offer runtime safety**: `safeGet()` function for accessing properties safely
4. **Include type guards**: `isSystemsAnalysis()`, `isEventSequenceAnalysis()`, etc.
5. **Support Data Analysis integration**: Include references to Data Analysis types and modules

This approach allows the adapter to work with OpenPRA's runtime objects while maintaining type safety within the adapter code.

### How It Works

The adapter never accesses properties directly. Instead, it:

1. Converts the original objects to the adapter's type definitions
2. Uses `safeGet()` for all property access with appropriate defaults
3. Handles missing or unexpected properties gracefully

For example:

```typescript
// Safe property access with default value
const id = safeGet(basicEvent, "id", "UNKNOWN_ID");

// Safe iteration with empty fallback
const basicEventsRecord = safeGet(systemsAnalysis, "systemBasicEvents", {});
Object.values(basicEventsRecord).forEach(/* ... */);

// Accessing Data Analysis references
const dataAnalysisRef = safeGet(basicEvent, "dataAnalysisBasicEventRef", null);
if (dataAnalysisRef) {
  // Use Data Analysis reference...
}
```

## Limitations

- Some advanced features of the quantification input schema may not have direct equivalents in OpenPRA
- Complex expression types might require manual adjustment
- Event tree path conversion is simplified and may require enhancement for complex trees
- House events identification is limited by the data available in OpenPRA models

## Future Enhancements

Potential areas for improvement:

1. Extended house event identification
2. More robust event tree path mapping
3. Support for additional expression types
4. Result parsing back into OpenPRA model
5. Better error recovery during conversion
6. Improved TypeScript type compatibility without modifying OpenPRA schema
7. **Enhanced Data Analysis integration** for more distribution types and uncertainty propagation
8. **Two-way synchronization** between Systems Analysis and Data Analysis modules

## Testing the Adapter

When testing the adapter, focus on these critical areas:

1. Basic event probability conversion
2. Fault tree gate logic conversion
3. Event tree path mapping
4. CCF group factor conversion
5. Parameter unit conversion
6. **Data Analysis integration** - verify that detailed probability models are properly converted

## Implementation Notes

The adapter handles the following mapping complexities:

1. **Basic Events**: Maps system basic events to the quantification input format, with priority given to Data Analysis probability models
2. **Fault Trees**: Converts node-based fault trees to formula-based trees
3. **Event Trees**: Maps event tree structures to the branching format
4. **CCF Groups**: Transforms OpenPRA CCF models to the expected format, with support for detailed model-specific parameters
5. **Parameters**: Converts OpenPRA parameters to expression-based parameters, with support for Data Analysis references
6. **Units**: Maps between different unit specifications
7. **Component Attributes**: Includes detailed component failure data and quantification attributes
