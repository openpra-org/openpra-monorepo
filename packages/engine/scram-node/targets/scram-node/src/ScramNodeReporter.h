#pragma once
#include <napi.h>
#include "model.h"
#include "risk_analysis.h"
#include "probability_analysis.h"
#include "uncertainty_analysis.h"
#include "importance_analysis.h"
#include "fault_tree_analysis.h"
#include "event_tree_analysis.h"

// Forward declarations: helpers for Reporter
Napi::Object ScramNodeReport(Napi::Env env, const scram::core::RiskAnalysis& analysis);
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
