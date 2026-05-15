This package contains C++ addons for the SCRAM engine.

# Installation
```shell
nx build engine-scram-node
```

# Run Commands
Checkout [`package.json`](./package.json), to see what kind of commands you can run. Here is an example:

```bash
nx run engine-scram-node:test
nx run 
```

# SCRAM Engine: Complete Workflow Documentation

## Overview

SCRAM is a C++ engine that performs probabilistic risk assessment calculations for event trees linked with fault trees. This document provides a comprehensive explanation of the entire workflow from input processing to final analysis.

## Table of Contents

1. [Input Processing and Model Construction](#1-input-processing-and-model-construction)
2. [PDAG Construction](#2-pdag-construction)
   - [PDAG Data Structures and Node Connections](#22-pdag-data-structures-and-node-connections)
   - [Variable and Gate Indexing](#23-variable-and-gate-indexing)
   - [Gate Construction](#24-gate-construction)
3. [PDAG Preprocessing (5 Phases)](#3-pdag-preprocessing-5-phases)
   - [Gate Coalescing](#gate-coalescing)
4. [Event Tree Analysis with Linked Fault Trees](#4-event-tree-analysis-with-linked-fault-trees)
5. [Analysis Execution](#5-analysis-execution)
6. [Complete Example Workflow](#6-complete-example-workflow)

## 1. Input Processing and Model Construction

### 1.1 Input Validation and Parsing

SCRAM accepts input in OpenPSA MEF (Model Exchange Format) XML files. The processing begins with validation and parsing:

```cpp
// Main entry point in scram.cc
void RunScram(const po::variables_map& vm) {
    // 1. Parse command line arguments and construct settings
    scram::core::Settings settings;
    ConstructSettings(vm, &settings);
    
    // 2. Initialize model from input files
    std::unique_ptr<scram::mef::Model> model =
        scram::mef::Initializer(input_files, settings, vm.count("allow-extern"))
            .model();
    
    // 3. Perform risk analysis
    scram::core::RiskAnalysis analysis(model.get(), settings);
    analysis.Analyze();
}
```

**Input Processing Sequence:**
```
User Input (XML) 
    ↓
MEF Schema Validation ✅
    ↓
XML Parsing → MEF Objects (Model, FaultTree, Gate, BasicEvent, etc.)
    ↓
MEF Object Validation ✅
    ↓
Formula Creation (MEF Objects → MEF Formulas)
    ↓
Model Setup and Validation ✅
    ↓
PDAG Construction (MEF Formulas → PDAG)
```

### 1.2 MEF Object Creation

The `Initializer` class processes XML files and creates MEF objects:

```cpp
void Initializer::ProcessInputFile(const xml::Document& document) {
    xml::Element root = document.root();
    
    // Create model container
    if (!model_) {
        model_ = ConstructElement<Model>(root);
    }
    
    // Process different XML elements
    for (const xml::Element& node : root.children()) {
        if (node.name() == "define-fault-tree") {
            DefineFaultTree(node);  // Creates fault tree objects
        } else if (node.name() == "define-event-tree") {
            DefineEventTree(node);  // Creates event tree objects
        } else if (node.name() == "define-CCF-group") {
            Register<CcfGroup>(node, "", RoleSpecifier::kPublic);
        }
        // ... other element types
    }
}
```

**Example Input XML:**
```xml
<opsa-mef>
  <define-fault-tree name="system-failure">
    <define-gate name="top-event">
      <and>
        <event name="component-a"/>
        <event name="component-b"/>
      </and>
    </define-gate>
    <define-basic-event name="component-a">
      <exponential>
        <parameter name="failure-rate">1.0e-3</parameter>
      </exponential>
    </define-basic-event>
    <define-basic-event name="component-b">
      <exponential>
        <parameter name="failure-rate">2.0e-3</parameter>
      </exponential>
    </define-basic-event>
  </define-fault-tree>
</opsa-mef>
```

**Resulting MEF Objects:**
```cpp
Model* model = new Model();
FaultTree* fault_tree = new FaultTree("system-failure");
Gate* top_event = new Gate("top-event");
BasicEvent* component_a = new BasicEvent("component-a");
BasicEvent* component_b = new BasicEvent("component-b");
```

### 1.3 Formula Creation

MEF objects are converted to Boolean formulas during the initialization phase:

```cpp
template <>
void Initializer::Define(const xml::Element& gate_node, Gate* gate) {
    auto formulas = GetNonAttributeElements(gate_node);
    gate->formula(GetFormula(*formulas.begin(), gate->base_path()));
}
```

**Resulting MEF Formula:**
```cpp
// top_event->formula() becomes:
Formula(AND, {component_a, component_b})
```

**Key Point:** MEF Formulas are essential intermediate representations that:
- Provide validation of Boolean logic structure
- Enable complex logic transformations (IFF, IMPLY, etc.)
- Support dynamic modifications (house events, event trees)
- Serve as the input for PDAG construction

**Why MEF Formulas Cannot Be Skipped:**
The MEF Formula layer cannot be eliminated because:
1. **PDAG Construction Expects Formulas**: The `Pdag` constructor specifically takes `mef::Gate` objects and accesses their `formula()` method
2. **Complex Logic Transformation**: Many MEF connectives need transformation into basic AND/OR logic before analysis
3. **Validation Layer**: Formulas provide validation before analysis begins
4. **Memory Management**: Formulas handle complex Boolean expressions with shared sub-expressions
5. **Dynamic Modifications**: Event trees with house events require formula cloning and modification
```

## 2. PDAG Construction

### 2.1 PDAG Creation from MEF Formulas

The PDAG (Propositional Directed Acyclic Graph) is constructed from MEF Formulas, not directly from fault trees:

```cpp
void FaultTreeAnalysis::Analyze() noexcept {
    // Create PDAG from the top event's formula
    graph_ = std::make_unique<Pdag>(top_event_, 
                                   Analysis::settings().ccf_analysis(), 
                                   model_);
    
    // Preprocess the PDAG
    this->Preprocess(graph_.get());
    
    // Generate products for analysis
    const Zbdd& products = this->GenerateProducts(graph_.get());
}
```

**PDAG Constructor:**
```cpp
Pdag::Pdag(const mef::Gate& root, bool ccf, const mef::Model* model) noexcept {
    ProcessedNodes nodes;
    
    // 1. Gather all variables (basic events) from the gate's formula
    GatherVariables(root.formula(), ccf, &nodes);
    
    // 2. Construct gates recursively from the formula structure
    root_ = ConstructGate(root.formula(), ccf, &nodes);
    
    // 3. Process substitutions if any
    if (model) {
        ProcessSubstitutions(model, &nodes);
    }
}
```

### 2.2 PDAG Data Structures and Node Connections

The PDAG uses a sophisticated **bidirectional connection system** with multiple data structures to efficiently manage relationships between nodes:

#### **Core Data Structures**

**NodeParentManager Class:**
```cpp
class NodeParentManager {
  using Parent = std::pair<int, GateWeakPtr>;  // Parent index and weak pointer
  using ParentMap = ext::linear_map<int, GateWeakPtr, ext::MoveEraser>;
  
private:
  ParentMap parents_;  // All registered parents of this node
};
```

**Gate Class Data Members:**
```cpp
class Gate : public Node {
private:
  ArgSet args_;                    // Set of argument indices (positive/negative)
  ArgMap<Gate> gate_args_;         // Map of gate arguments: index → shared_ptr<Gate>
  ArgMap<Variable> variable_args_; // Map of variable arguments: index → shared_ptr<Variable>
  ConstantPtr constant_;           // Single constant argument (if any)
};
```

#### **Bidirectional Connection System**

Each node maintains **two types of connections**:

**Child-to-Parent Connections (Upward):**
- Every node (Gate, Variable, Constant) inherits from `NodeParentManager`
- Stores **weak pointers** to its parent gates in `parents_` map
- Key: parent gate's index, Value: weak pointer to parent gate
- Uses `ext::linear_map` for efficient small-scale lookups

**Parent-to-Child Connections (Downward):**
- Gates store **shared pointers** to their child arguments
- Three separate containers for different argument types:
  - `gate_args_`: Child gates
  - `variable_args_`: Child variables (basic events)
  - `constant_`: Single constant child
- `args_` set stores all argument indices (positive = normal, negative = complement)

#### **Connection Management Methods**

**Adding Arguments (Parent → Child):**
```cpp
template <class T>
void Gate::AddArg(int index, const std::shared_ptr<T>& arg) noexcept {
  args_.insert(index);                    // Add to index set
  mutable_args<T>().data().emplace_back(index, arg);  // Add to type-specific map
  arg->AddParent(shared_from_this());     // Establish child → parent link
}
```

**Adding Parents (Child → Parent):**
```cpp
void NodeParentManager::AddParent(const GatePtr& gate) {
  parents_.data().emplace_back(gate->index(), gate);  // Weak pointer
}
```

#### **Data Structure Design Choices**

**Why `ext::linear_map` instead of `std::unordered_map`?**
- **Cache-friendly**: Contiguous memory layout for small collections
- **Performance**: Outperforms hash maps for small numbers of entries (up to 50 entries)
- **Memory efficiency**: No hash table overhead
- **Predictable iteration**: Preserves insertion order

**Why Weak Pointers for Parents?**
- **Prevents circular references**: Avoids memory leaks
- **Automatic cleanup**: When parent is destroyed, weak pointer becomes invalid
- **Safe traversal**: Can check if parent still exists before accessing

**Why Shared Pointers for Children?**
- **Ownership semantics**: Gate owns its children
- **Automatic cleanup**: Children are destroyed when last parent is destroyed
- **Reference counting**: Multiple parents can share the same child

#### **Example Connection Structure**

```
Gate G1 (index: 10)
├── parents_: {} (root gate)
├── args_: {2, 3, 15} (indices of children)
├── gate_args_: {15 → shared_ptr<Gate G2>}
└── variable_args_: {2 → shared_ptr<Variable A>, 3 → shared_ptr<Variable B>}

Gate G2 (index: 15)
├── parents_: {10 → weak_ptr<Gate G1>}
├── args_: {4, 5}
└── variable_args_: {4 → shared_ptr<Variable C>, 5 → shared_ptr<Variable D>}

Variable A (index: 2)
├── parents_: {10 → weak_ptr<Gate G1>}
└── (no children)

Variable B (index: 3)
├── parents_: {10 → weak_ptr<Gate G1>}
└── (no children)
```

#### **Traversal and Access Patterns**

**Finding Children of a Gate:**
```cpp
// Get all gate children
for (const auto& arg : gate.args<Gate>()) {
  GatePtr child_gate = arg.second;  // shared_ptr<Gate>
  // Process child_gate
}

// Get all variable children  
for (const auto& arg : gate.args<Variable>()) {
  VariablePtr child_var = arg.second;  // shared_ptr<Variable>
  // Process child_var
}
```

**Finding Parents of a Node:**
```cpp
// Get all parents
for (const auto& parent : node.parents()) {
  if (auto parent_gate = parent.second.lock()) {  // Convert weak_ptr to shared_ptr
    // Process parent_gate
  }
}
```

#### **Performance Characteristics**

- **Lookup time**: O(N) for linear_map (but very fast for small N due to cache locality)
- **Memory usage**: Minimal overhead compared to hash maps
- **Traversal**: Efficient bidirectional traversal
- **Modification**: Fast insertion/deletion with MoveEraser policy
- **Cache performance**: Contiguous memory layout provides excellent cache locality
- **Memory safety**: Automatic cleanup through shared_ptr/weak_ptr reference counting

### 2.3 Variable and Gate Indexing

SCRAM uses the following indexing system:

```cpp
void Pdag::GatherVariables(const mef::BasicEvent& basic_event, bool ccf,
                           ProcessedNodes* nodes) noexcept {
    if (ccf && basic_event.HasCcf()) {
        // Handle CCF groups
        if (nodes->gates.emplace(&basic_event.ccf_gate(), nullptr).second)
            GatherVariables(basic_event.ccf_gate().formula(), ccf, nodes);
    } else {
        VariablePtr& var = nodes->variables[&basic_event];
        if (!var) {
            basic_events_.push_back(&basic_event);
            var = std::make_shared<Variable>(this);
            // Variables get indices starting from kVariableStartIndex (2)
            assert((kVariableStartIndex + basic_events_.size() - 1) == var->index());
        }
    }
}
```

**Indexing Scheme:**
- **Index 1**: Constant TRUE
- **Index -1**: Constant FALSE  
- **Indices 2, 3, 4, ...**: Variables (basic events)
- **Higher indices**: Gates

### 2.4 Gate Construction

PDAG gates are constructed recursively from MEF formulas:

```cpp
GatePtr Pdag::ConstructGate(const mef::Formula& formula, bool ccf,
                            ProcessedNodes* nodes) noexcept {
    Connective type = static_cast<Connective>(formula.connective());
    auto parent = std::make_shared<Gate>(type, this);
    
    // Handle special cases
    switch (type) {
        case kNot:
        case kNand:
        case kNor:
        case kXor:
            coherent_ = false;
            break;
        case kAtleast:
            parent->min_number(*formula.min_number());
            break;
    }
    
    // Add arguments from the formula
    for (const mef::Formula::Arg& arg : formula.args()) {
        if (arg.complement)
            coherent_ = false;
        AddArg(parent, arg.event, arg.complement, ccf, nodes);
    }
    
    return parent;
}
```

## 3. PDAG Preprocessing (5 Phases)

The PDAG undergoes 5 phases of preprocessing to optimize it for analysis:

### Phase 1: Basic Cleanup and Partial Normalization

```cpp
void Preprocessor::RunPhaseOne() noexcept {
    // Remove NULL gates
    if (graph_->HasNullGates()) {
        graph_->RemoveNullGates();
        if (graph_->IsTrivial()) return;
    }
    
    // Partial normalization for non-coherent graphs
    if (!graph_->coherent()) {
        NormalizeGates(/*full=*/false);
    }
}
```

**What happens:**
- Removes pass-through gates that don't contribute to logic
- Converts simple non-coherent gates (NOT, NAND, NOR) to AND/OR form

**Example:**
```
Before: NOR(A,B)
After:  OR(A,B) with negated arguments
```

### Phase 2: Structural Optimization

```cpp
void Preprocessor::RunPhaseTwo() noexcept {
    pdag::Transform(graph_,
        [this](Pdag*) { while (ProcessMultipleDefinitions()) continue; },
        [this](Pdag*) { DetectModules(); },
        [this](Pdag*) { while (CoalesceGates(/*common=*/false)) continue; },
        [this](Pdag*) { MergeCommonArgs(); },
        [this](Pdag*) { DetectDistributivity(); },
        [this](Pdag*) { DetectModules(); },
        [this](Pdag*) { BooleanOptimization(); },
        [this](Pdag*) { DecomposeCommonNodes(); },
        [this](Pdag*) { DetectModules(); },
        [this](Pdag*) { while (CoalesceGates(/*common=*/false)) continue; },
        [this](Pdag*) { DetectModules(); });
}
```

**Key Transformations:**

#### Multiple Definition Processing
```cpp
void DetectMultipleDefinitions(const GatePtr& gate,
                              std::unordered_map<GatePtr, std::vector<GateWeakPtr>>* multi_def,
                              GateSet* unique_gates) noexcept {
    if (gate->mark()) return;
    gate->mark(true);
    
    if (!gate->module()) {
        std::pair<GatePtr, bool> ret = unique_gates->insert(gate);
        if (!ret.second) {  // The gate is duplicate
            (*multi_def)[ret.first].push_back(gate);
            return;
        }
    }
    
    for (const Gate::Arg<Gate>& arg : gate->args<Gate>()) {
        DetectMultipleDefinitions(arg.second, multi_def, unique_gates);
    }
}
```

**Example:**
```
Before: G1 = AND(A,B), G2 = AND(A,B)
After:  G1 = AND(A,B), G2 = G1 (reference)
```

#### Module Detection
```cpp
void Preprocessor::DetectModules() noexcept {
    // 1. Assign timing to all nodes using DFS
    graph_->Clear<Pdag::kVisit>();
    AssignTiming(0, root_gate);
    
    // 2. Find modules
    graph_->Clear<Pdag::kGateMark>();
    FindModules(root_gate);
}

void Preprocessor::FindModules(const GatePtr& gate) noexcept {
    if (gate->mark()) return;
    gate->mark(true);
    
    int enter_time = gate->EnterTime();
    int exit_time = gate->ExitTime();
    int min_time = enter_time;
    int max_time = exit_time;
    
    // Check if all arguments are within gate's time range
    for (const Gate::Arg<Gate>& arg : gate->args<Gate>()) {
        const GatePtr& arg_gate = arg.second;
        FindModules(arg_gate);
        
        if (IsSubgraphWithinGraph(arg_gate, enter_time, exit_time)) {
            // Argument is within this gate's scope
        } else {
            // Argument extends beyond this gate's scope
            min_time = std::min(min_time, arg_gate->min_time());
            max_time = std::max(max_time, arg_gate->max_time());
        }
    }
    
    // Determine if this gate is a module
    if (!gate->module() && min_time == enter_time && max_time == exit_time) {
        gate->module(true);
    }
}
```

**Example:**
```
G1 = AND(A,B)  // Module: all children within G1's time range
G2 = OR(G1,C)  // Not a module: G1 is outside G2's time range
```

#### Gate Coalescing

Gate coalescing transforms nested gates of the same type into a flattened structure by moving child arguments up and removing intermediate gates.

**Coalescing Algorithm:**
```cpp
bool Preprocessor::CoalesceGates(const GatePtr& gate, bool common) noexcept {
    if (gate->mark()) return false;
    gate->mark(true);
    
    Connective target_type = kNull;
    switch (gate->type()) {
        case kNand:
        case kAnd:
            target_type = kAnd;
            break;
        case kNor:
        case kOr:
            target_type = kOr;
            break;
    }
    
    std::vector<GatePtr> to_join;
    for (const Gate::Arg<Gate>& arg : gate->args<Gate>()) {
        const GatePtr& arg_gate = arg.second;
        if (arg_gate->type() == target_type) {
            to_join.push_back(arg_gate);
        }
    }
    
    // Join gates of the same type
    for (const GatePtr& arg : to_join) {
        gate->CoalesceGate(arg);
    }
    
    return !to_join.empty();
}
```

**Core Coalescing Implementation:**
```cpp
void Gate::CoalesceGate(const GatePtr& arg_gate) noexcept {
    // 1. Move all gate arguments from arg_gate to this gate
    for (const auto& arg : arg_gate->gate_args_) {
        AddArg(arg);  // This calls AddArg(index, shared_ptr)
        if (constant()) return;
    }
    
    // 2. Move all variable arguments from arg_gate to this gate  
    for (const auto& arg : arg_gate->variable_args_) {
        AddArg(arg);  // This calls AddArg(index, shared_ptr)
        if (constant()) return;
    }
    
    // 3. Remove the arg_gate from this gate's arguments
    args_.erase(arg_gate->index());
    gate_args_.erase(arg_gate->index());
    
    // 4. Remove this gate as parent of arg_gate
    arg_gate->EraseParent(Node::index());
}
```

**Example Transformation: `AND(AND(A,B), AND(C,D))` → `AND(A,B,C,D)`**

**Before Coalescing:**
```
Gate G1 (index: 10) - Root AND gate
├── parents_: {} (root gate)
├── args_: {15, 20} (indices of child gates)
├── gate_args_: {15 → shared_ptr<Gate G2>, 20 → shared_ptr<Gate G3>}
└── variable_args_: {}

Gate G2 (index: 15) - First inner AND gate
├── parents_: {10 → weak_ptr<Gate G1>}
├── args_: {2, 3} (indices of variables A, B)
├── gate_args_: {}
└── variable_args_: {2 → shared_ptr<Variable A>, 3 → shared_ptr<Variable B>}

Gate G3 (index: 20) - Second inner AND gate  
├── parents_: {10 → weak_ptr<Gate G1>}
├── args_: {4, 5} (indices of variables C, D)
├── gate_args_: {}
└── variable_args_: {4 → shared_ptr<Variable C>, 5 → shared_ptr<Variable D>}

Variable A (index: 2)
├── parents_: {15 → weak_ptr<Gate G2>}
└── (no children)

Variable B (index: 3)
├── parents_: {15 → weak_ptr<Gate G2>}
└── (no children)

Variable C (index: 4)
├── parents_: {20 → weak_ptr<Gate G3>}
└── (no children)

Variable D (index: 5)
├── parents_: {20 → weak_ptr<Gate G3>}
└── (no children)
```

**After Coalescing:**
```
Gate G1 (index: 10) - Root AND gate (now directly connected to variables)
├── parents_: {} (root gate)
├── args_: {2, 3, 4, 5} (indices of variables A, B, C, D)
├── gate_args_: {} (no more intermediate gates)
└── variable_args_: {2 → shared_ptr<Variable A>, 3 → shared_ptr<Variable B>, 
                     4 → shared_ptr<Variable C>, 5 → shared_ptr<Variable D>}

Gate G2 (index: 15) - Orphaned (no parents, will be garbage collected)
├── parents_: {} (empty - no longer referenced)
├── args_: {2, 3} (still has children, but no parents)
├── gate_args_: {}
└── variable_args_: {2 → shared_ptr<Variable A>, 3 → shared_ptr<Variable B>}

Gate G3 (index: 20) - Orphaned (no parents, will be garbage collected)
├── parents_: {} (empty - no longer referenced)
├── args_: {4, 5} (still has children, but no parents)
├── gate_args_: {}
└── variable_args_: {4 → shared_ptr<Variable C>, 5 → shared_ptr<Variable D>}

Variable A (index: 2)
├── parents_: {10 → weak_ptr<Gate G1>, 15 → weak_ptr<Gate G2>}
└── (no children)

Variable B (index: 3)
├── parents_: {10 → weak_ptr<Gate G1>, 15 → weak_ptr<Gate G2>}
└── (no children)

Variable C (index: 4)
├── parents_: {10 → weak_ptr<Gate G1>, 20 → weak_ptr<Gate G3>}
└── (no children)

Variable D (index: 5)
├── parents_: {10 → weak_ptr<Gate G1>, 20 → weak_ptr<Gate G3>}
└── (no children)
```

**Key Pointer Changes:**

1. **Child-to-Parent Links (Variables → Gates)**:
   - Variables A, B, C, D **gain a new parent** (G1)
   - Variables A, B **keep their old parent** (G2) - but G2 becomes orphaned
   - Variables C, D **keep their old parent** (G3) - but G3 becomes orphaned

2. **Parent-to-Child Links (Gates → Variables)**:
   - G1 **gains direct connections** to A, B, C, D
   - G1 **loses connections** to G2 and G3
   - G2 and G3 **keep their connections** to their variables but become unreachable

3. **Intermediate Gates (G2, G3)**:
   - **Lose their parent** (G1)
   - **Keep their children** (A, B, C, D) but become orphaned
   - **Will be garbage collected** when their shared_ptr reference count reaches 0

4. **Memory Management**:
   - G2 and G3 become **orphaned nodes** with no incoming references
   - They will be **automatically cleaned up** by the shared_ptr reference counting
   - The variables (A, B, C, D) are now **shared between the root gate and orphaned gates**
   - When orphaned gates are destroyed, variables will **lose those parent references**

**Final State After Garbage Collection:**
```
Gate G1 (index: 10) - Root AND gate
├── parents_: {}
├── args_: {2, 3, 4, 5}
├── gate_args_: {}
└── variable_args_: {2 → shared_ptr<Variable A>, 3 → shared_ptr<Variable B>, 
                     4 → shared_ptr<Variable C>, 5 → shared_ptr<Variable D>}

Variable A (index: 2)
├── parents_: {10 → weak_ptr<Gate G1>}  // Only G1 remains
└── (no children)

Variable B (index: 3)
├── parents_: {10 → weak_ptr<Gate G1>}  // Only G1 remains
└── (no children)

Variable C (index: 4)
├── parents_: {10 → weak_ptr<Gate G1>}  // Only G1 remains
└── (no children)

Variable D (index: 5)
├── parents_: {10 → weak_ptr<Gate G1>}  // Only G1 remains
└── (no children)

// G2 and G3 are destroyed and no longer exist
```

This transformation **flattens the hierarchy** by moving all leaf nodes (variables) directly under the root gate, eliminating the intermediate gates while preserving the logical structure. The memory management is handled automatically through shared_ptr reference counting.

#### Boolean Optimization
```cpp
void Preprocessor::BooleanOptimization() noexcept {
    // Find nodes with multiple parents
    std::vector<GateWeakPtr> common_gates;
    std::vector<std::weak_ptr<Variable>> common_variables;
    GatherCommonNodes(&common_gates, &common_variables);
    
    // Process each common node for optimization
    for (const auto& gate : common_gates) {
        ProcessCommonNode(gate);
    }
}

template <class N>
void Preprocessor::ProcessCommonNode(const std::weak_ptr<N>& common_node) noexcept {
    // 1. Mark ancestors
    GatePtr root;
    MarkAncestors(common_node, &root);
    
    // 2. Simulate failure propagation
    int mult_tot = PropagateState(root, common_node);
    
    // 3. Identify redundant connections
    std::unordered_map<int, GateWeakPtr> destinations;
    CollectStateDestinations(root, common_node->index(), &destinations);
    
    // 4. Remove redundant paths
    if (destinations.size() > 0 && destinations.size() < mult_tot) {
        std::vector<GateWeakPtr> redundant_parents;
        CollectRedundantParents(common_node, &destinations, &redundant_parents);
        ProcessRedundantParents(common_node, redundant_parents);
    }
}
```

**Example:**
```
Before: G1→A, G2→A, G3→A (all paths lead to same result)
After:  G1→A, G2→A (G3 removed as redundant)
```

### Phase 3: Full Normalization

```cpp
void Preprocessor::RunPhaseThree() noexcept {
    assert(!graph_->normal());
    NormalizeGates(/*full=*/true);
    graph_->normal(true);
    
    if (graph_->IsTrivial()) return;
    RunPhaseTwo();  // Apply optimizations to normalized graph
}
```

**Gate Normalization Algorithms:**

#### XOR Gate Normalization
```cpp
void Preprocessor::NormalizeXorGate(const GatePtr& gate) noexcept {
    assert(gate->args().size() == 2);
    
    // XOR(A,B) → OR(AND(A,NOT(B)), AND(NOT(A),B))
    auto gate_one = std::make_shared<Gate>(kAnd, graph_);
    auto gate_two = std::make_shared<Gate>(kAnd, graph_);
    
    gate->type(kOr);
    
    // First argument: A
    auto it = gate->args().begin();
    gate->ShareArg(*it, gate_one);
    gate->ShareArg(*it, gate_two);
    gate_two->NegateArg(*it);
    
    // Second argument: B
    ++it;
    gate->ShareArg(*it, gate_one);
    gate_one->NegateArg(*it);
    gate->ShareArg(*it, gate_two);
    
    gate->EraseArgs();
    gate->AddArg(gate_one);
    gate->AddArg(gate_two);
}
```

#### K/N Gate Normalization
```cpp
void Preprocessor::NormalizeAtleastGate(const GatePtr& gate) noexcept {
    assert(gate->type() == kAtleast);
    int min_number = gate->min_number();
    
    // Base cases
    if (gate->args().size() == min_number) {
        gate->type(kAnd);  // All must fail
        return;
    }
    if (min_number == 1) {
        gate->type(kOr);   // At least one must fail
        return;
    }
    
    // Recursive decomposition: K/N(A,B,C) → OR(AND(A, K-1/N-1(B,C)), K/N-1(B,C))
    auto it = boost::max_element(gate->args(), [&gate](int lhs, int rhs) {
        return gate->GetArg(lhs)->order() < gate->GetArg(rhs)->order();
    });
    
    auto first_arg = std::make_shared<Gate>(kAnd, graph_);
    gate->TransferArg(*it, first_arg);
    
    auto grand_arg = std::make_shared<Gate>(kAtleast, graph_);
    first_arg->AddArg(grand_arg);
    grand_arg->min_number(min_number - 1);
    
    auto second_arg = std::make_shared<Gate>(kAtleast, graph_);
    second_arg->min_number(min_number);
    
    for (int index : gate->args()) {
        gate->ShareArg(index, grand_arg);
        gate->ShareArg(index, second_arg);
    }
    
    gate->type(kOr);
    gate->EraseArgs();
    gate->AddArg(first_arg);
    gate->AddArg(second_arg);
    
    // Recursively normalize sub-gates
    NormalizeAtleastGate(grand_arg);
    NormalizeAtleastGate(second_arg);
}
```

### Phase 4: Complement Propagation

```cpp
void Preprocessor::RunPhaseFour() noexcept {
    assert(!graph_->coherent());
    
    // Handle root complement
    if (graph_->complement()) {
        const GatePtr& root = graph_->root();
        if (root->type() == kOr || root->type() == kAnd) {
            root->type(root->type() == kOr ? kAnd : kOr);
        }
        root->NegateArgs();
        graph_->complement() = false;
    }
    
    // Propagate complements down to variables
    std::unordered_map<int, GatePtr> complements;
    graph_->Clear<Pdag::kGateMark>();
    PropagateComplements(graph_->root(), false, &complements);
    
    if (graph_->IsTrivial()) return;
    RunPhaseTwo();
}
```

**Complement Propagation Algorithm:**
```cpp
void Preprocessor::PropagateComplements(const GatePtr& gate, bool keep_modules,
                                       std::unordered_map<int, GatePtr>* complements) noexcept {
    if (gate->mark()) return;
    gate->mark(true);
    
    std::vector<std::pair<int, GatePtr>> to_swap;
    for (const Gate::Arg<Gate>& arg : gate->args<Gate>()) {
        const GatePtr& arg_gate = arg.second;
        
        if ((arg.first > 0) || (keep_modules && arg_gate->module())) {
            PropagateComplements(arg_gate, keep_modules, complements);
            continue;
        }
        
        // Apply De Morgan's laws
        Connective type = arg_gate->type();
        Connective complement_type = type == kOr ? kAnd : kOr;
        
        GatePtr complement;
        if (arg_gate->parents().size() == 1) {
            // Reuse existing gate
            arg_gate->type(complement_type);
            arg_gate->NegateArgs();
            complement = arg_gate;
        } else {
            // Create new complement gate
            complement = arg_gate->Clone();
            complement->type(complement_type);
            complement->NegateArgs();
            complements->emplace(arg_gate->index(), complement);
        }
        
        to_swap.emplace_back(arg.first, complement);
        PropagateComplements(complement, keep_modules, complements);
    }
    
    // Apply the swaps
    for (const auto& arg : to_swap) {
        gate->EraseArg(arg.first);
        gate->AddArg(arg.second);
    }
}
```

**Example:**
```
Before: AND(NOT(OR(A,B)), NOT(AND(C,D)))
After:  AND(AND(NOT(A), NOT(B)), OR(NOT(C), NOT(D)))
```

### Phase 5: Final Optimization

```cpp
void Preprocessor::RunPhaseFive() noexcept {
    // Final gate coalescing (including common gates)
    while (CoalesceGates(/*common=*/true)) continue;
    
    if (graph_->IsTrivial()) return;
    RunPhaseTwo();  // Apply all optimizations one final time
    
    if (graph_->IsTrivial()) return;
    while (CoalesceGates(/*common=*/true)) continue;
}
```

## 4. Event Tree Analysis with Linked Fault Trees

### 4.1 Event Tree Processing

When analyzing event trees with linked fault trees, SCRAM creates a hierarchical PDAG structure:

```cpp
void EventTreeAnalysis::Analyze() noexcept {
    // Walk event tree paths and collect sequences
    SequenceCollector collector{initiating_event_, *context_};
    CollectSequences(initiating_event_.event_tree()->initial_state(), &collector);
    
    // For each sequence, create a gate representing the sequence
    for (auto& sequence : collector.sequences) {
        auto gate = std::make_unique<mef::Gate>("__" + sequence.first->name());
        
        // Process collected formulas and expressions
        for (PathCollector& path_collector : sequence.second) {
            if (path_collector.formulas.size() == 1) {
                gate_formulas.push_back(std::move(path_collector.formulas.front()));
            } else if (path_collector.formulas.size() > 1) {
                // Combine multiple formulas with AND
                mef::Formula::ArgSet arg_set;
                for (mef::FormulaPtr& arg_formula : path_collector.formulas) {
                    arg_set.Add(make_gate(std::move(arg_formula)));
                }
                gate_formulas.push_back(
                    std::make_unique<mef::Formula>(mef::kAnd, std::move(arg_set)));
            }
        }
        
        // Create final sequence gate
        if (gate_formulas.size() == 1) {
            gate->formula(std::move(gate_formulas.front()));
        } else if (gate_formulas.size() > 1) {
            // Combine multiple formulas with OR
            mef::Formula::ArgSet arg_set;
            for (mef::FormulaPtr& arg_formula : gate_formulas) {
                arg_set.Add(make_gate(std::move(arg_formula)));
            }
            gate->formula(std::make_unique<mef::Formula>(mef::kOr, std::move(arg_set)));
        }
        
        sequences_.push_back({*sequence.first, std::move(gate), is_expression_only});
    }
}
```

### 4.2 House Event Integration

House events are applied to fault trees during sequence collection:

```cpp
void Visit(const mef::SetHouseEvent* house_event) override {
    collector_.path_collector_.set_instructions[house_event->name()] = 
        house_event->state();
}

void Visit(const mef::CollectFormula* collect_formula) override {
    collector_.path_collector_.formulas.push_back(
        core::Clone(collect_formula->formula(),
                   collector_.path_collector_.set_instructions,
                   collector_.clones_));
}
```

**House Event Processing:**
```cpp
std::unique_ptr<mef::Formula> Clone(const mef::Formula& formula,
                                   const std::unordered_map<std::string, bool>& set_instructions,
                                   std::vector<std::unique_ptr<mef::Event>>* clones) noexcept {
    struct {
        mef::Formula::ArgEvent operator()(mef::HouseEvent* arg) {
            if (auto it = ext::find(set_house, arg->id())) {
                if (it->second == arg->state()) {
                    return arg;
                }
                // Create clone with different state
                auto clone = std::make_unique<mef::HouseEvent>(
                    arg->name(), "__clone__." + arg->id(), mef::RoleSpecifier::kPrivate);
                clone->state(it->second);
                auto* ptr = clone.get();
                event_register->emplace_back(std::move(clone));
                return ptr;
            }
            return arg;
        }
        // ... other operators
    } cloner{set_instructions, clones};
    
    // Apply cloner to all arguments
    mef::Formula::ArgSet arg_set;
    for (const mef::Formula::Arg& arg : formula.args()) {
        arg_set.Add(std::visit(cloner, arg.event), arg.complement);
    }
    
    return std::make_unique<mef::Formula>(formula.connective(), std::move(arg_set),
                                         formula.min_number(), formula.max_number());
}
```

### 4.3 Integrated PDAG Structure

The final integrated PDAG combines event tree and fault tree levels:

```
Integrated PDAG:
TOP (Event Tree + Fault Trees)
├── Sequence 1 Gate
│   ├── House Event A (TRUE)
│   ├── Fault Tree 1 Gate (expanded)
│   │   ├── AND(A1, A2)
│   │   └── OR(A3, A4)
│   └── Fault Tree 2 Gate (expanded)
│       ├── Basic Event B1
│       └── Basic Event B2
├── Sequence 2 Gate
│   ├── House Event A (FALSE)
│   ├── Fault Tree 1 Gate (expanded with different house event settings)
│   └── Expression (Time calculation)
└── Sequence 3 Gate
    ├── House Event B (TRUE)
    └── Fault Tree 3 Gate (expanded)
        ├── Basic Event C1
        └── Basic Event C2
```

### 4.4 House Event Optimization

When house events are set to FALSE, SCRAM optimizes away those sequences:

```cpp
template <>
void Gate::AddConstantArg<false>() noexcept {
    switch (type_) {
        case kAnd:
            MakeConstant(false);  // AND(FALSE, anything) = FALSE
            break;
        case kOr:
            ReduceLogic(kNull);   // OR(FALSE, B) = B
            break;
        // ... other cases
    }
}

bool Pdag::IsTrivial() noexcept {
    if (root_->constant()) {
        // If root becomes a constant, the entire sequence is trivial
        return true;
    }
    return false;
}
```

**Example:**
```
Original: AND(A, B, C)
House Event: A = FALSE
Result: AND(FALSE, B, C) → FALSE (constant)
Analysis: Sequence probability = 0, eliminated
```

## 5. Analysis Execution

### 5.1 Algorithm Selection

SCRAM supports multiple analysis algorithms:

```cpp
void RiskAnalysis::RunAnalysis(const mef::Gate& target, Result* result) noexcept {
    switch (Analysis::settings().algorithm()) {
        case Algorithm::kBdd:
            return RunAnalysis<Bdd>(target, result);
        case Algorithm::kZbdd:
            return RunAnalysis<Zbdd>(target, result);
        case Algorithm::kMocus:
            return RunAnalysis<Mocus>(target, result);
    }
}
```

### 5.2 BDD Analysis

```cpp
template <class Algorithm>
void RiskAnalysis::RunAnalysis(const mef::Gate& target, Result* result) noexcept {
    // Create fault tree analyzer
    auto fta = std::make_unique<FaultTreeAnalyzer<Algorithm>>(
        target, Analysis::settings(), model_);
    fta->Analyze();
    
    // Perform probability analysis
    if (Analysis::settings().probability_analysis()) {
        switch (Analysis::settings().approximation()) {
            case Approximation::kNone:
                RunAnalysis<Algorithm, Bdd>(fta.get(), result);
                break;
            case Approximation::kRareEvent:
                RunAnalysis<Algorithm, RareEventCalculator>(fta.get(), result);
                break;
            case Approximation::kMcub:
                RunAnalysis<Algorithm, McubCalculator>(fta.get(), result);
        }
    }
    
    result->fault_tree_analysis = std::move(fta);
}
```

### 5.3 Probability Calculation

```cpp
double ProbabilityAnalyzer<Bdd>::CalculateProbability(
    const Bdd::VertexPtr& vertex, bool mark,
    const Pdag::IndexMap<double>& p_vars) noexcept {
    
    if (vertex->terminal()) {
        return 1;
    }
    
    Ite& ite = Ite::Ref(vertex);
    if (ite.mark() == mark) {
        return ite.p();
    }
    
    ite.mark(mark);
    double p_var = 0;
    
    if (ite.module()) {
        const Bdd::Function& res = bdd_graph_->modules().find(ite.index())->second;
        p_var = CalculateProbability(res.vertex, mark, p_vars);
        if (res.complement) {
            p_var = 1 - p_var;
        }
    } else {
        p_var = p_vars[ite.index()];
    }
    
    double high = CalculateProbability(ite.high(), mark, p_vars);
    double low = CalculateProbability(ite.low(), mark, p_vars);
    
    if (ite.complement_edge()) {
        low = 1 - low;
    }
    
    ite.p(p_var * high + (1 - p_var) * low);
    return ite.p();
}
```

## 6. Complete Example Workflow

### 6.1 Input Model

**Fault Tree:**
```
TOP = AND(OR(A,B), OR(C,D))
A: Basic Event (failure rate = 1e-3)
B: Basic Event (failure rate = 2e-3)
C: Basic Event (failure rate = 3e-3)
D: Basic Event (failure rate = 4e-3)
```

**Event Tree:**
```
Initiating Event: System Failure
├── Sequence 1: ECCS Available = TRUE
│   ├── Fault Tree: ECCS System Failure
│   └── Fault Tree: Containment Failure
└── Sequence 2: ECCS Available = FALSE
    └── Fault Tree: Backup System Failure
```

### 6.2 Processing Steps

**Step 1: MEF Object Creation**
```cpp
Model* model = new Model();
FaultTree* ft1 = new FaultTree("ECCS-System-Failure");
FaultTree* ft2 = new FaultTree("Containment-Failure");
FaultTree* ft3 = new FaultTree("Backup-System-Failure");
Gate* top1 = new Gate("top1");
Gate* top2 = new Gate("top2");
Gate* top3 = new Gate("top3");
BasicEvent* A = new BasicEvent("A");
BasicEvent* B = new BasicEvent("B");
// ... other events
```

**Step 2: Formula Creation**
```cpp
top1->formula(AND(OR(A,B), OR(C,D)));
top2->formula(OR(E,F));
top3->formula(AND(G,H));
```

**Step 3: PDAG Construction**
```
PDAG 1: Constructed from TOP1's formula: AND(OR(A,B), OR(C,D))
PDAG 2: Constructed from TOP2's formula: OR(E,F)
PDAG 3: Constructed from TOP3's formula: AND(G,H)
```

**Step 4: Preprocessing (Phase 1-5)**
```
Phase 1: Basic cleanup
Phase 2: Structural optimization
Phase 3: Full normalization (already normalized)
Phase 4: Complement propagation (no complements)
Phase 5: Final optimization
```

**Step 5: Event Tree Integration**
```
Integrated PDAG:
TOP (System Failure)
├── Sequence 1: ECCS_Available = TRUE
│   ├── AND(OR(A,B), OR(C,D))  // ECCS System Failure
│   └── OR(E,F)                // Containment Failure
└── Sequence 2: ECCS_Available = FALSE
    └── AND(G,H)               // Backup System Failure
```

**Step 6: Analysis**
```cpp
// Calculate sequence probabilities
double seq1_prob = P(AND(OR(A,B), OR(C,D))) * P(OR(E,F));
double seq2_prob = 0;  // ECCS_Available = FALSE eliminates this sequence

// Total risk
double total_risk = seq1_prob + seq2_prob = seq1_prob;
```

## Conclusion

This workflow demonstrates how SCRAM transforms high-level risk models through MEF Formulas into PDAGs for probabilistic analysis. The MEF Formula layer is essential as it provides validation, enables complex logic transformations, and serves as the bridge between the declarative model structure and the computational analysis structure.
