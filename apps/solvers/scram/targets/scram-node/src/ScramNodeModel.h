#pragma once
#include <napi.h>
#include <memory>
#include <string>
#include <vector>
#include <map>
#include <unordered_map>
#include <set>
#include <optional>
#include <type_traits>

#include "model.h"
#include "fault_tree.h"
#include "event.h"
#include "event_tree.h"
#include "parameter.h"
#include "ccf_group.h"
#include "expression/constant.h"
#include "expression/exponential.h"
#include "expression/numerical.h"
#include "expression/random_deviate.h"
#include "expression/test_event.h"

// ----------------------------------------------------------------------------
// Overview
// ----------------------------------------------------------------------------
// ScramNodeModel builds a scram::mef::Model from a JS/TS object.
// It supports two input styles:
// 1) Legacy JSON-style inputs (basicEvents/parameters/ccfGroups/gates/faultTrees/eventTrees)
// 2) TS MVP FaultTree format: an FT object with { name, top: LogicExpr, basicEvents[], [houseEvents[]] }
//
// The building occurs in phases:
//  - Parse (legacy) -> Intermediate structs (Parsed...)
//  - Build basic elements and parameters
//  - Build CCF groups
//  - Build gates (dependency-ordered)
//  - Build FaultTrees (legacy) or directly build TS MVP FaultTree (top LogicExpr)
//  - Build EventTrees and InitiatingEvents; link IE -> ET by name
//  - Transfer registry-owned elements into the Model
// ----------------------------------------------------------------------------

// Forward declaration: main model builder
std::unique_ptr<scram::mef::Model> ScramNodeModel(const Napi::Object& nodeModel);

// New function: Build model and return summary info without running analysis
Napi::Value BuildModelOnly(const Napi::CallbackInfo& info);

// ----------------------------------------------------------------------------
// Element Registry for tracking parsed elements (legacy path)
// ----------------------------------------------------------------------------
class ElementRegistry {
public:
    // Check if element exists and return pointer if found (non-owning)
    template<typename T>
    T* FindElement(const std::string& name) const {
        if constexpr (std::is_same_v<T, scram::mef::BasicEvent>) {
            auto it = basic_events_.find(name);
            return it != basic_events_.end() ? it->second.get() : nullptr;
        } else if constexpr (std::is_same_v<T, scram::mef::Gate>) {
            auto it = gates_.find(name);
            return it != gates_.end() ? it->second.get() : nullptr;
        } else if constexpr (std::is_same_v<T, scram::mef::Parameter>) {
            auto it = parameters_.find(name);
            return it != parameters_.end() ? it->second.get() : nullptr;
        } else if constexpr (std::is_same_v<T, scram::mef::CcfGroup>) {
            auto it = ccf_groups_.find(name);
            return it != ccf_groups_.end() ? it->second.get() : nullptr;
        } else if constexpr (std::is_same_v<T, scram::mef::Expression>) {
            auto it = expressions_.find(name);
            return it != expressions_.end() ? it->second.get() : nullptr;
        }
        return nullptr;
    }
    
    // Register an element (takes ownership)
    template<typename T>
    void RegisterElement(const std::string& name, std::unique_ptr<T> element) {
        if constexpr (std::is_same_v<T, scram::mef::BasicEvent>) {
            basic_events_[name] = std::move(element);
        } else if constexpr (std::is_same_v<T, scram::mef::Gate>) {
            gates_[name] = std::move(element);
        } else if constexpr (std::is_same_v<T, scram::mef::Parameter>) {
            parameters_[name] = std::move(element);
        } else if constexpr (std::is_same_v<T, scram::mef::CcfGroup>) {
            ccf_groups_[name] = std::move(element);
        } else if constexpr (std::is_same_v<T, scram::mef::Expression>) {
            expressions_[name] = std::move(element);
        }
    }
    
    // Get all registered elements of a type (non-owning view)
    template<typename T>
    const std::unordered_map<std::string, std::unique_ptr<T>>& GetElements() const {
        if constexpr (std::is_same_v<T, scram::mef::BasicEvent>) {
            return basic_events_;
        } else if constexpr (std::is_same_v<T, scram::mef::Gate>) {
            return gates_;
        } else if constexpr (std::is_same_v<T, scram::mef::Parameter>) {
            return parameters_;
        } else if constexpr (std::is_same_v<T, scram::mef::CcfGroup>) {
            return ccf_groups_;
        } else if constexpr (std::is_same_v<T, scram::mef::Expression>) {
            return expressions_;
        }
        static const std::unordered_map<std::string, std::unique_ptr<T>> empty;
        return empty;
    }
    
    // Clear registry (called after model is built)
    void Clear() {
        basic_events_.clear();
        gates_.clear();
        parameters_.clear();
        ccf_groups_.clear();
        expressions_.clear();
    }
    
    // Extract all elements to transfer ownership to model
    void ExtractAllToModel(scram::mef::Model* model) {
        // Transfer basic events
        for (auto& [_, element] : basic_events_) {
            model->Add(std::move(element));
        }
        // Transfer gates
        for (auto& [_, element] : gates_) {
            model->Add(std::move(element));
        }
        // Transfer parameters
        for (auto& [_, element] : parameters_) {
            model->Add(std::move(element));
        }
        // Transfer CCF groups
        for (auto& [_, element] : ccf_groups_) {
            model->Add(std::move(element));
        }
        // Transfer expressions
        for (auto& [_, element] : expressions_) {
            model->Add(std::move(element));
        }
        // Clear the maps (elements are now owned by the model)
        Clear();
    }

private:
    std::unordered_map<std::string, std::unique_ptr<scram::mef::BasicEvent>> basic_events_;
    std::unordered_map<std::string, std::unique_ptr<scram::mef::Gate>> gates_;
    std::unordered_map<std::string, std::unique_ptr<scram::mef::Parameter>> parameters_;
    std::unordered_map<std::string, std::unique_ptr<scram::mef::CcfGroup>> ccf_groups_;
    std::unordered_map<std::string, std::unique_ptr<scram::mef::Expression>> expressions_;
};

// ----------------------------------------------------------------------------
// Intermediate parsed structures (legacy parsing path)
// ----------------------------------------------------------------------------
struct ParsedBasicEvent {
    std::string name;
    std::string description;
    std::string type;                      // "basic", "house"
    Napi::Value value;                     // boolean | number | string | Parameter | BuiltInFunction | RandomDeviate | NumericalOperation
    std::optional<double> systemMissionTime;
    std::string base_path;
};

struct ParsedGate {
    std::string name;
    std::string description;
    std::string type;                      // "and" | "or" | "not" | "xor" | "nand" | "nor" | "iff" | "atleast" | "cardinality" | "imply"
    std::vector<std::string> gate_refs;    // Child gates by name
    std::vector<std::string> event_refs;   // Child events by name
    std::optional<int> min_number;         // For atleast/cardinality
    std::optional<int> max_number;         // For cardinality
    std::string base_path;
};

struct ParsedParameter {
    std::string name;
    std::string description;
    Napi::Value value;                     // Complex Value type
    std::string unit;                      // "unitless" | "bool" | "int" | "float" | "hours" | "hour-1" | "years" | "year-1" | "fit" | "demands"
    std::string base_path;
};

struct ParsedCCFGroup {
    std::string name;
    std::string description;
    std::string model_type;                // "beta-factor" | "MGL" | "alpha-factor"
    std::vector<std::string> member_refs;
    std::optional<double> distribution;
    std::vector<std::pair<int, double>> factors;
    std::string base_path;
};

struct ParsedFaultTree {
    std::string name;
    std::string description;
    std::string top_event_ref;             // Top gate name (legacy path)
    std::vector<std::string> ccf_group_refs;
};

struct ParsedFunctionalEvent {
    std::string name;
    std::string state;                     // "failure" | "success" | "bypass"
    std::string ref_gate_ref;              // gate name (optional; empty string if none)
};

struct ParsedEventSequence {
    std::string end_state;
    std::vector<ParsedFunctionalEvent> functional_events;
};

struct ParsedEventTree {
    std::string name;
    std::string description;
    std::string initiating_event_ref;      // will be linked post-build
    std::vector<std::string> functional_event_refs;
    std::vector<ParsedEventSequence> sequences;
};

struct ParsedInitiatingEvent {
    std::string name;
    std::string description;
    double frequency{1.0};
    std::string unit;                      // e.g., "year-1"
};

// ----------------------------------------------------------------------------
// Complex Value type structures (legacy)
// ----------------------------------------------------------------------------
struct ParsedBuiltInFunction {
    std::string function_type;             // "exponential", "GLM", "Weibull", "periodicTest"
    std::vector<Napi::Value> arguments;
};

struct ParsedRandomDeviate {
    std::string deviate_type;              // "uniformDeviate", "normalDeviate", "lognormalDeviate", "gammaDeviate", "betaDeviate", "histogram"
    std::vector<Napi::Value> arguments;    // or histogram base/bins flattened
};

struct ParsedNumericalOperation {
    std::string operation;                 // "neg", "add", "sub", "mul", "div", "pow", "sin", "cos", ... (see implementation)
    std::vector<Napi::Value> arguments;
};

// ----------------------------------------------------------------------------
// Event Tree mapping (legacy)
// ----------------------------------------------------------------------------
std::unique_ptr<scram::mef::EventTree> ScramNodeEventTree(
    const ParsedEventTree& parsed,
    scram::mef::Model* model,
    const ElementRegistry& registry);

std::unique_ptr<scram::mef::InitiatingEvent> ScramNodeInitiatingEvent(
    const ParsedInitiatingEvent& parsed,
    scram::mef::Model* model);

// ----------------------------------------------------------------------------
// Fault Tree mapping (legacy)
// ----------------------------------------------------------------------------
std::unique_ptr<scram::mef::FaultTree> ScramNodeFaultTree(
    const ParsedFaultTree& parsed,
    scram::mef::Model* model,
    const ElementRegistry& registry);

// ----------------------------------------------------------------------------
// Element builders (legacy building path)
// ----------------------------------------------------------------------------
std::unique_ptr<scram::mef::Gate> BuildGate(
    const ParsedGate& parsed,
    scram::mef::Model* model,
    const ElementRegistry& registry);

std::unique_ptr<scram::mef::Gate> BuildGateWithFormula(
    const ParsedGate& parsed,
    scram::mef::Model* model,
    const ElementRegistry& registry);

std::unique_ptr<scram::mef::BasicEvent> BuildBasicEvent(
    const ParsedBasicEvent& parsed,
    scram::mef::Model* model,
    const ElementRegistry& registry);

std::unique_ptr<scram::mef::HouseEvent> BuildHouseEvent(
    const ParsedBasicEvent& parsed,
    scram::mef::Model* model,
    const ElementRegistry& registry);

std::unique_ptr<scram::mef::Parameter> BuildParameter(
    const ParsedParameter& parsed,
    scram::mef::Model* model,
    const ElementRegistry& registry);

std::unique_ptr<scram::mef::CcfGroup> BuildCCFGroup(
    const ParsedCCFGroup& parsed,
    scram::mef::Model* model,
    const ElementRegistry& registry);

// ----------------------------------------------------------------------------
// Expression builders (legacy)
// ----------------------------------------------------------------------------
scram::mef::Expression* BuildExpression(
    const Napi::Value& nodeValue,
    scram::mef::Model* model,
    const ElementRegistry& registry,
    const std::string& basePath = "");

scram::mef::Expression* BuildParameterExpression(
    const ParsedParameter& parsed,
    scram::mef::Model* model,
    const ElementRegistry& registry);

scram::mef::Expression* BuildBuiltInFunctionExpression(
    const ParsedBuiltInFunction& parsed,
    scram::mef::Model* model,
    const ElementRegistry& registry);

scram::mef::Expression* BuildRandomDeviateExpression(
    const ParsedRandomDeviate& parsed,
    scram::mef::Model* model,
    const ElementRegistry& registry);

scram::mef::Expression* BuildNumericalOperationExpression(
    const ParsedNumericalOperation& parsed,
    scram::mef::Model* model,
    const ElementRegistry& registry);

// ----------------------------------------------------------------------------
// Parsing functions (legacy path - separated from building)
// ----------------------------------------------------------------------------
ParsedBasicEvent    ParseBasicEvent(const Napi::Object& nodeEvent);
ParsedGate          ParseGate(const Napi::Object& nodeGate);
ParsedParameter     ParseParameter(const Napi::Object& nodeParam);
ParsedCCFGroup      ParseCCFGroup(const Napi::Object& nodeCCF);
ParsedFaultTree     ParseFaultTree(const Napi::Object& nodeFaultTree);
ParsedEventTree     ParseEventTree(const Napi::Object& nodeEventTree);
ParsedInitiatingEvent ParseInitiatingEvent(const Napi::Object& nodeIE);

// Complex Value type parsing
ParsedParameter         ParseParameterValue(const Napi::Object& nodeParam);
ParsedBuiltInFunction   ParseBuiltInFunction(const Napi::Object& nodeFunction);
ParsedRandomDeviate     ParseRandomDeviate(const Napi::Object& nodeDeviate);
ParsedNumericalOperation ParseNumericalOperation(const Napi::Object& nodeOperation);

// Helper function to recursively parse gates and events from a hierarchical fault tree (legacy)
void ParseFaultTreeElements(
    const Napi::Object& node, 
    std::vector<ParsedGate>& parsedGates,
    std::vector<ParsedBasicEvent>& parsedBasicEvents,
    std::set<std::string>& seenBasicEvents,
    const std::string& basePath = "");

// ----------------------------------------------------------------------------
// Helper: Convert JS strings to underlying SCRAM enums/types
// ----------------------------------------------------------------------------

// Convert JS string to GateType enum
inline scram::mef::Connective ScramNodeGateType(const std::string& type) {
    using namespace scram::mef;
    if (type == "and") return kAnd;
    if (type == "or") return kOr;
    if (type == "not") return kNot;
    if (type == "xor") return kXor;
    if (type == "nand") return kNand;
    if (type == "nor") return kNor;
    if (type == "iff") return kIff;
    if (type == "atleast") return kAtleast;
    if (type == "cardinality") return kCardinality;
    if (type == "imply") return kImply;
    throw std::runtime_error("Unknown gate type: " + type);
}

// Convert JS string to CCF model type (validate only; returns same string on success)
inline std::string ScramNodeCCFModelType(const std::string& type) {
    if (type == "beta-factor" || type == "MGL" || type == "alpha-factor" || type == "phi-factor")
        return type;
    throw std::runtime_error("Unknown CCF model type: " + type);
}

// Convert JS string to Units enum
inline scram::mef::Units ScramNodeUnit(const std::string& unit) {
    using namespace scram::mef;
    if (unit == "unitless") return kUnitless;
    if (unit == "bool") return kBool;
    if (unit == "int") return kInt;
    if (unit == "float") return kFloat;
    if (unit == "hours") return kHours;
    if (unit == "hour-1") return kInverseHours;
    if (unit == "years") return kYears;
    if (unit == "year-1") return kInverseYears;
    if (unit == "fit") return kFit;
    if (unit == "demands") return kDemands;
    throw std::runtime_error("Unknown unit: " + unit);
}

// Convert JS string to event type: currently "basic" or "house"
inline std::string ScramNodeEventType(const std::string& type) {
    if (type == "basic" || type == "house")
        return type;
    throw std::runtime_error("Unknown event type: " + type);
}