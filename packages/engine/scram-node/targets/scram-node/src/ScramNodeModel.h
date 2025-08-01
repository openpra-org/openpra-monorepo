#pragma once
#include <napi.h>
#include <memory>
#include <string>
#include <vector>
#include <map>
#include <chrono>

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

// Event Tree mapping
std::unique_ptr<scram::mef::EventTree> ScramNodeEventTree(const Napi::Object& nodeEventTree, scram::mef::Model* model);
std::unique_ptr<scram::mef::InitiatingEvent> ScramNodeInitiatingEvent(const Napi::Object& nodeIE, scram::mef::Model* model);

// Fault Tree Mapping
std::unique_ptr<scram::mef::FaultTree> ScramNodeFaultTree(const Napi::Object& nodeFaultTree, scram::mef::Model* model);
std::unique_ptr<scram::mef::Gate> ScramNodeGate(const Napi::Object& nodeGate, scram::mef::Model* model, const std::string& basePath = "");
std::unique_ptr<scram::mef::BasicEvent> ScramNodeBasicEvent(const Napi::Object& nodeEvent, scram::mef::Model* model, const std::string& basePath = "");
std::unique_ptr<scram::mef::HouseEvent> ScramNodeHouseEvent(const Napi::Object& nodeEvent, scram::mef::Model* model, const std::string& basePath = "");
std::unique_ptr<scram::mef::Parameter> ScramNodeParameter(const Napi::Object& nodeParam, scram::mef::Model* model, const std::string& basePath = "");
std::unique_ptr<scram::mef::CcfGroup> ScramNodeCCFGroup(const Napi::Object& nodeCCF, scram::mef::Model* model, const std::string& basePath = "");
scram::mef::Expression* ScramNodeValue(const Napi::Value& nodeValue, scram::mef::Model* model, const std::string& basePath = "");

struct EventTreeTrieNode {
    // Key: state string, Value: child node
    std::map<std::string, std::unique_ptr<EventTreeTrieNode>> children;
    // For each state, the refGate (if any) to collect at this step
    std::map<std::string, Napi::Value> refGates;
    // If this is a leaf, the end state name
    std::string endState;
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
