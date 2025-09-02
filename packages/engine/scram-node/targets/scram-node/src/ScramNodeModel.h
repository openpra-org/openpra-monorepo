#pragma once
#include <napi.h>
#include <memory>
#include <string>
#include <vector>
#include <map>
#include <unordered_map>
#include <set>

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

// Forward declarations: recursive helpers for Model
std::unique_ptr<scram::mef::Model> ScramNodeModel(const Napi::Object& nodeModel);

// Element Registry for tracking parsed elements
class ElementRegistry {
public:
    // Check if element exists and return pointer if found
    template<typename T>
    T* FindElement(const std::string& name) const {
        if constexpr (std::is_same_v<T, scram::mef::BasicEvent>) {
            auto it = basic_events_.find(name);
            return it != basic_events_.end() ? it->second : nullptr;
        } else if constexpr (std::is_same_v<T, scram::mef::Gate>) {
            auto it = gates_.find(name);
            return it != gates_.end() ? it->second : nullptr;
        } else if constexpr (std::is_same_v<T, scram::mef::Parameter>) {
            auto it = parameters_.find(name);
            return it != parameters_.end() ? it->second : nullptr;
        } else if constexpr (std::is_same_v<T, scram::mef::CcfGroup>) {
            auto it = ccf_groups_.find(name);
            return it != ccf_groups_.end() ? it->second : nullptr;
        } else if constexpr (std::is_same_v<T, scram::mef::Expression>) {
            auto it = expressions_.find(name);
            return it != expressions_.end() ? it->second : nullptr;
        }
        return nullptr;
    }
    
    // Register an element (takes ownership)
    template<typename T>
    void RegisterElement(const std::string& name, std::unique_ptr<T> element) {
        T* ptr = element.get();
        if constexpr (std::is_same_v<T, scram::mef::BasicEvent>) {
            basic_events_[name] = ptr;
        } else if constexpr (std::is_same_v<T, scram::mef::Gate>) {
            gates_[name] = ptr;
        } else if constexpr (std::is_same_v<T, scram::mef::Parameter>) {
            parameters_[name] = ptr;
        } else if constexpr (std::is_same_v<T, scram::mef::CcfGroup>) {
            ccf_groups_[name] = ptr;
        } else if constexpr (std::is_same_v<T, scram::mef::Expression>) {
            expressions_[name] = ptr;
        }
    }
    
    // Get all registered elements of a type
    template<typename T>
    const std::unordered_map<std::string, T*>& GetElements() const {
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
        static const std::unordered_map<std::string, T*> empty;
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

private:
    std::unordered_map<std::string, scram::mef::BasicEvent*> basic_events_;
    std::unordered_map<std::string, scram::mef::Gate*> gates_;
    std::unordered_map<std::string, scram::mef::Parameter*> parameters_;
    std::unordered_map<std::string, scram::mef::CcfGroup*> ccf_groups_;
    std::unordered_map<std::string, scram::mef::Expression*> expressions_;
};

// Intermediate parsed structures
struct ParsedBasicEvent {
    std::string name;
    std::string description;
    std::string value_type;
    Napi::Value value;
    std::string base_path;
};

struct ParsedGate {
    std::string name;
    std::string description;
    std::string type;
    std::vector<std::string> gate_refs;
    std::vector<std::string> event_refs;
    std::optional<int> min_number;
    std::optional<int> max_number;
    std::string base_path;
};

struct ParsedParameter {
    std::string name;
    std::string description;
    std::string value_type;
    Napi::Value value;
    std::string unit;
    std::string base_path;
};

struct ParsedCCFGroup {
    std::string name;
    std::string description;
    std::string model_type;
    std::vector<std::string> member_refs;
    std::string distribution_type;
    Napi::Value distribution;
    std::vector<std::pair<int, Napi::Value>> factors;
    std::string base_path;
};

struct ParsedFaultTree {
    std::string name;
    std::string description;
    std::string top_event_ref;
    std::vector<std::string> ccf_group_refs;
};

struct ParsedFunctionalEvent {
    std::string name;
    std::string state;
    std::string ref_gate_ref; // optional
};

struct ParsedEventSequence {
    std::string end_state;
    std::vector<ParsedFunctionalEvent> functional_events;
};

struct ParsedEventTree {
    std::string name;
    std::string description;
    std::string initiating_event_ref;
    std::vector<std::string> functional_event_refs;
    std::vector<ParsedEventSequence> sequences;
};

struct ParsedInitiatingEvent {
    std::string name;
    std::string description;
    double frequency;
    std::string unit;
};

// Event Tree mapping
std::unique_ptr<scram::mef::EventTree> ScramNodeEventTree(const ParsedEventTree& parsed, scram::mef::Model* model, const ElementRegistry& registry);
std::unique_ptr<scram::mef::InitiatingEvent> ScramNodeInitiatingEvent(const ParsedInitiatingEvent& parsed, scram::mef::Model* model);

// Fault Tree Mapping
std::unique_ptr<scram::mef::FaultTree> ScramNodeFaultTree(const ParsedFaultTree& parsed, scram::mef::Model* model, const ElementRegistry& registry);

// Element builders (now separate from parsing)
std::unique_ptr<scram::mef::Gate> BuildGate(const ParsedGate& parsed, scram::mef::Model* model, const ElementRegistry& registry);
std::unique_ptr<scram::mef::BasicEvent> BuildBasicEvent(const ParsedBasicEvent& parsed, scram::mef::Model* model, const ElementRegistry& registry);
std::unique_ptr<scram::mef::HouseEvent> BuildHouseEvent(const ParsedBasicEvent& parsed, scram::mef::Model* model, const ElementRegistry& registry);
std::unique_ptr<scram::mef::Parameter> BuildParameter(const ParsedParameter& parsed, scram::mef::Model* model, const ElementRegistry& registry);
std::unique_ptr<scram::mef::CcfGroup> BuildCCFGroup(const ParsedCCFGroup& parsed, scram::mef::Model* model, const ElementRegistry& registry);

// Expression builders
scram::mef::Expression* BuildExpression(const Napi::Value& nodeValue, scram::mef::Model* model, const ElementRegistry& registry, const std::string& basePath = "");

// Parsing functions (now separate from building)
ParsedBasicEvent ParseBasicEvent(const Napi::Object& nodeEvent);
ParsedGate ParseGate(const Napi::Object& nodeGate);
ParsedParameter ParseParameter(const Napi::Object& nodeParam);
ParsedCCFGroup ParseCCFGroup(const Napi::Object& nodeCCF);
ParsedFaultTree ParseFaultTree(const Napi::Object& nodeFaultTree);
ParsedEventTree ParseEventTree(const Napi::Object& nodeEventTree);
ParsedInitiatingEvent ParseInitiatingEvent(const Napi::Object& nodeIE);

struct EventTreeTrieNode {
    // Key: state string, Value: child node
    std::map<std::string, std::unique_ptr<EventTreeTrieNode>> children;
    // For each state, the refGate (if any) to collect at this step
    std::map<std::string, std::string> ref_gate_refs;
    // If this is a leaf, the end state name
    std::string end_state;
};

// Helper: Convert JS string to GateType enum
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

// Helper: Convert JS string to CCF model type
inline std::string ScramNodeCCFModelType(const std::string& type) {
    if (type == "beta-factor" || type == "MGL" || type == "alpha-factor")
        return type;
    throw std::runtime_error("Unknown CCF model type: " + type);
}

// Helper: Convert JS string to Units enum
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

// Helper: Convert JS string to event type
inline std::string ScramNodeEventType(const std::string& type) {
    if (type == "basic" || type == "house" || type == "undeveloped")
        return type;
    throw std::runtime_error("Unknown event type: " + type);
}
