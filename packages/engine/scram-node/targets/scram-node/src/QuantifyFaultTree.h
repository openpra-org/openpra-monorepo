#pragma once
#include <napi.h>
#include "settings.h"
#include "model.h"
#include "parameter.h"
#include "risk_analysis.h"
#include "reporter.h"
#include "fault_tree_analysis.h"
#include "importance_analysis.h"
#include "uncertainty_analysis.h"
#include "event_tree_analysis.h"

// Mapping helpers for Settings
scram::core::Settings ScramNodeOptions(const Napi::Object& nodeOptions);

// Forward declarations: recursive helpers for Model
std::unique_ptr<scram::mef::Model> ScramNodeModel(const Napi::Object& nodeModel);
std::unique_ptr<scram::mef::FaultTree> ScramNodeFaultTree(const Napi::Object& nodeFaultTree, scram::mef::Model* model);
std::unique_ptr<scram::mef::Gate> ScramNodeGate(const Napi::Object& nodeGate, scram::mef::Model* model, const std::string& basePath = "");
std::unique_ptr<scram::mef::BasicEvent> ScramNodeBasicEvent(const Napi::Object& nodeEvent, scram::mef::Model* model, const std::string& basePath = "");
std::unique_ptr<scram::mef::HouseEvent> ScramNodeHouseEvent(const Napi::Object& nodeEvent, scram::mef::Model* model, const std::string& basePath = "");
std::unique_ptr<scram::mef::Parameter> ScramNodeParameter(const Napi::Object& nodeParam, scram::mef::Model* model, const std::string& basePath = "");
std::unique_ptr<scram::mef::CcfGroup> ScramNodeCCFGroup(const Napi::Object& nodeCCF, scram::mef::Model* model, const std::string& basePath = "");
scram::mef::Expression* ScramNodeValue(const Napi::Value& nodeValue, scram::mef::Model* model, const std::string& basePath = "");

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

// Forward declarations: helpers for Reporter
Napi::Object ScramNodeModelFeatures(Napi::Env env, const scram::mef::Model& model);
Napi::Object ScramNodeResults(Napi::Env env, const scram::core::RiskAnalysis& analysis);
Napi::Object ScramNodeSafetyIntegrityLevels(Napi::Env env, const scram::core::ProbabilityAnalysis& pa);
Napi::Object ScramNodeCurve(Napi::Env env, const scram::core::ProbabilityAnalysis& pa);
Napi::Object ScramNodeStatisticalMeasure(Napi::Env env, const scram::core::UncertaintyAnalysis& ua);
Napi::Object ScramNodeImportance(Napi::Env env, const scram::core::ImportanceAnalysis& ia);
Napi::Object ScramNodeSumOfProducts(Napi::Env env, const scram::core::FaultTreeAnalysis& fta, const scram::core::ProbabilityAnalysis* pa);
Napi::Array ScramNodeHistogram(Napi::Env env, const std::map<double, double>& hist);
Napi::Array ScramNodeQuantiles(Napi::Env env, const std::vector<double>& quantiles, double mean, double sigma);
Napi::Array ScramNodeProductList(Napi::Env env, const scram::core::ProductContainer& products, const scram::core::ProbabilityAnalysis* pa);

// The main Node Addon function
Napi::Value QuantifyFaultTree(const Napi::CallbackInfo& info);
