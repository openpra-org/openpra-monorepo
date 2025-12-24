#pragma once
#include <napi.h>
#include <ostream>
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
Napi::Object ScramNodeSumOfProducts(Napi::Env env, const scram::core::FaultTreeAnalysis& fta, const scram::core::ProbabilityAnalysis* pa, const scram::core::RiskAnalysis::Result* result = nullptr);
Napi::Array  ScramNodeQuantiles(Napi::Env env, const std::vector<double>& quantiles, double mean, double sigma);
Napi::Array  ScramNodeProductList(Napi::Env env, const scram::core::ProductContainer& products, const scram::core::ProbabilityAnalysis* pa);

// Streaming report writer used to avoid building large in-memory objects.
// If exclude_product_lists is true, only summary stats (probability, product count) are included
void ScramNodeReportToJsonStream(std::ostream& out, const scram::core::RiskAnalysis& analysis, bool exclude_product_lists = false);

// Extract only metadata from a JSON report file without loading massive productList arrays
// This reads the file, extracts essential fields, and returns a lightweight N-API object
Napi::Object ScramNodeExtractMetadataFromFile(Napi::Env env, const std::string& filePath, const scram::core::RiskAnalysis& analysis);