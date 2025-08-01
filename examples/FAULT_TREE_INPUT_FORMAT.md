# Fault Tree Input Format Documentation

This document describes the expected JSON input format for the `ScramNodeModel` function and related node wrapper functions.

## Overview

The input is a JSON object that represents a complete fault tree model with the following structure:

```json
{
  "name": "ModelName",
  "faultTrees": { ... },
  "systemBasicEvents": { ... },
  "commonCauseFailureGroups": { ... }
}
```

## Required Fields

### Top Level
- **name** (optional): String name for the model. If not provided, a timestamp-based name will be generated.

### faultTrees (Required)
A map of fault tree names to fault tree definitions. At least one of `faultTrees` or `systemLogicModels` must be present.

Each fault tree has the following structure:
```json
{
  "name": "FaultTreeName",
  "nodes": {
    "nodeId": {
      "nodeType": "NODE_TYPE",
      "name": "Node Name",
      // ... type-specific properties
    }
  },
  "quantificationSettings": {
    "method": "exact",
    "truncationLimit": 1.0e-6,
    "maxOrder": 3
  }
}
```

### systemBasicEvents (Optional)
A map of global basic events that can be referenced across fault trees.

### commonCauseFailureGroups (Optional)
A map of common cause failure group definitions.

## Node Types

### Supported Node Types

1. **AND_GATE** - Logical AND gate
2. **OR_GATE** - Logical OR gate  
3. **NAND_GATE** - Logical NAND gate
4. **NOR_GATE** - Logical NOR gate
5. **XOR_GATE** - Logical XOR gate
6. **VOTE_GATE** - Voting gate (requires minNumber)
7. **NOT_GATE** - Logical NOT gate
8. **BASIC_EVENT** - Basic failure event
9. **UNDEVELOPED_EVENT** - Undeveloped event
10. **HOUSE_EVENT** - House event (true/false condition)
11. **TRUE_EVENT** - Always true event
12. **FALSE_EVENT** - Always false event
13. **PASS_EVENT** - Pass-through event
14. **INIT_EVENT** - Initiating event
15. **TRANSFER_IN** - Transfer in from another fault tree
16. **TRANSFER_OUT** - Transfer out to another fault tree

### Node Properties

#### Common Properties
- **nodeType**: String identifying the node type
- **name**: String name for the node
- **inputs**: Array of input node IDs (for gates)

#### Type-Specific Properties

**Basic Events:**
- **probability**: Number - failure probability
- **probabilityModel**: Object with value property
- **expression**: Object with value property

**House Events:**
- **houseEventValue**: Boolean - true/false state

**Vote Gates:**
- **minNumber**: Number - minimum number of inputs required

**Transfer Gates:**
- **transferTreeId**: String - target/source fault tree name
- **sourceNodeId**: String - source node ID (for TRANSFER_IN)

**Quantification Settings:**
- **method**: String - quantification method (default: "exact")
- **truncationLimit**: Number - truncation limit
- **maxOrder**: Number - maximum order for cut sets

## Common Cause Failure Groups

CCF groups support three model types:
- **BETA_FACTOR**: Beta factor model
- **MGL**: Multiple Greek Letter model  
- **ALPHA_FACTOR**: Alpha factor model

Structure:
```json
{
  "modelType": "BETA_FACTOR",
  "name": "CCF Group Name",
  "members": {
    "basicEvents": [
      { "id": "event1" },
      { "id": "event2" }
    ]
  },
  "modelParameters": {
    "beta": 0.1
  }
}
```

## Examples

### Simple AND Gate
```json
{
  "nodeType": "AND_GATE",
  "name": "System Failure",
  "inputs": ["EventA", "EventB"]
}
```

### Basic Event with Probability
```json
{
  "nodeType": "BASIC_EVENT", 
  "name": "Component Failure",
  "probability": 1.0e-3
}
```

### Vote Gate
```json
{
  "nodeType": "VOTE_GATE",
  "name": "2-out-of-3 Voting",
  "minNumber": 2,
  "inputs": ["Comp1", "Comp2", "Comp3"]
}
```

### House Event
```json
{
  "nodeType": "HOUSE_EVENT",
  "name": "Maintenance Mode", 
  "houseEventValue": false
}
```

## Error Handling

The wrapper functions will throw errors for:
- Missing required fields
- Invalid node types
- Referenced nodes not found
- Invalid probability values
- Missing transfer information for transfer gates

## Testing

Use the provided sample files:
- `simple_fault_tree_example.json` - Basic functionality test
- `sample_fault_tree_input.json` - Comprehensive test with all features 