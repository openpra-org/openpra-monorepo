# Quantification Request Format Documentation

This document describes the expected JSON request format for fault tree quantification using the `NodeQuantRequest` interface.

## Overview

The request body should contain both `settings` and `model` fields:

```json
{
  "settings": { ... },
  "model": { ... }
}
```

## Settings Field

The `settings` field contains analysis configuration options:

### Analysis Methods (Boolean flags)
- **mocus**: Perform qualitative analysis with MOCUS algorithm
- **bdd**: Perform qualitative analysis with Binary Decision Diagrams
- **zbdd**: Perform qualitative analysis with Zero-suppressed BDDs
- **primeImplicants**: Calculate prime implicants

### Analysis Types (Boolean flags)
- **probability**: Perform probability analysis
- **importance**: Perform importance analysis
- **uncertainty**: Perform uncertainty analysis
- **ccf**: Perform common-cause failure analysis
- **sil**: Compute Safety Integrity Level metrics

### Approximation Methods (Boolean flags)
- **rareEvent**: Use rare event approximation
- **mcub**: Use MCUB approximation

### Analysis Parameters
- **limitOrder**: Upper limit for product order (number)
- **cutOff**: Cut-off probability for products (number)
- **missionTime**: System mission time in hours (number)
- **timeStep**: Time step in hours for probability analysis (number)
- **numTrials**: Number of trials for Monte Carlo simulations (number)
- **numQuantiles**: Number of quantiles for distributions (number)
- **numBins**: Number of bins for histograms (number)
- **seed**: Seed for pseudo-random number generator (number)

## Model Field

The `model` field contains the fault tree model data using the `Partial<SystemsAnalysis>` format:

### Required Fields
- **faultTrees**: Record of fault tree definitions

### Optional Fields
- **commonCauseFailureGroups**: Record of CCF group definitions

### Fault Tree Structure
Each fault tree should have:
- **id**: Unique identifier
- **name**: Human-readable name
- **systemReference**: Reference to the system
- **description**: Description of the fault tree
- **topEventId**: ID of the top event node
- **nodes**: Record of node definitions

### Node Structure
Each node should have:
- **id**: Unique identifier
- **nodeType**: Type of node (AND_GATE, OR_GATE, BASIC_EVENT, etc.)
- **name**: Human-readable name
- **description**: Description of the node
- **inputs**: Array of input node IDs (for gates)
- **probability**: Failure probability (for basic events)
- **houseEventValue**: Boolean value (for house events)

### Common Cause Failure Groups
CCF groups should have:
- **id**: Unique identifier
- **name**: Human-readable name
- **description**: Description of the CCF group
- **modelType**: Type of CCF model (BETA_FACTOR, MGL, ALPHA_FACTOR)
- **members**: Object containing basic event references
- **modelParameters**: Object containing model-specific parameters

## Example Usage

### Simple Example
```json
{
  "settings": {
    "mocus": true,
    "probability": true,
    "limitOrder": 2,
    "cutOff": 1.0e-6,
    "missionTime": 8760
  },
  "model": {
    "faultTrees": {
      "SimpleSystem": {
        "id": "simple-001",
        "name": "Simple System",
        "systemReference": {
          "id": "sys-001",
          "name": "Simple System"
        },
        "description": "A simple fault tree",
        "topEventId": "TOP",
        "nodes": {
          "TOP": {
            "id": "top-001",
            "nodeType": "AND_GATE",
            "name": "System Failure",
            "inputs": ["EVENT_A", "EVENT_B"]
          },
          "EVENT_A": {
            "id": "event-a-001",
            "nodeType": "BASIC_EVENT",
            "name": "Component A Failure",
            "probability": 1.0e-3
          },
          "EVENT_B": {
            "id": "event-b-001",
            "nodeType": "BASIC_EVENT",
            "name": "Component B Failure",
            "probability": 2.0e-3
          }
        }
      }
    }
  }
}
```

### Comprehensive Example
See `sample_quantification_request.json` for a comprehensive example with:
- Multiple fault trees
- Different node types (AND, OR, VOTE gates)
- House events
- Common cause failure groups
- Full analysis settings

## Testing Recommendations

1. **Start Simple**: Use `simple_quantification_request.json` for basic functionality testing
2. **Full Features**: Use `sample_quantification_request.json` for comprehensive testing
3. **Settings Testing**: Modify the settings to test different analysis methods
4. **Model Testing**: Modify the model structure to test different fault tree configurations

## Error Handling

The system will validate:
- Required fields are present
- Node types are valid
- Input references exist
- Probability values are valid
- CCF group configurations are correct

## Response Format

The quantification service will return analysis results including:
- Minimal cut sets (if MOCUS/BDD analysis requested)
- Probability calculations (if probability analysis requested)
- Importance measures (if importance analysis requested)
- CCF analysis results (if CCF analysis requested) 