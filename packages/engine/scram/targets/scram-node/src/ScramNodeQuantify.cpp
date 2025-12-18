#include <chrono>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <limits>
#include <random>
#include <sstream>
#include <string>
#include <napi.h>
#include "ScramNodeSettings.h"
#include "ScramNodeModel.h"
#include "ScramNodeReporter.h"
#include "risk_analysis.h"
#include "event_tree_analysis.h"

// Forward declaration
const scram::core::RiskAnalysis::Result* FindSequenceResult(
    const scram::core::RiskAnalysis& analysis,
    const scram::mef::InitiatingEvent& initiating_event,
    const scram::mef::Sequence& sequence);

// Step 4: The Node Addon Method for Quantifying Fault Trees
Napi::Value QuantifyModel(const Napi::CallbackInfo& info) {
    Napi::Env env = info.Env();
    if (info.Length() < 2) {
        Napi::TypeError::New(env, "Settings and Model - both are required").ThrowAsJavaScriptException();
        return env.Null();
    }
    if (!info[0].IsObject()) {
        Napi::TypeError::New(env, "Settings object required").ThrowAsJavaScriptException();
        return env.Null();
    }
    if (!info[1].IsObject()) {
        Napi::TypeError::New(env, "Model object required").ThrowAsJavaScriptException();
        return env.Null();
    }

    Napi::Object nodeOptions = info[0].As<Napi::Object>();
    Napi::Object nodeModel = info[1].As<Napi::Object>();

    try {
        // 1. Map Node options/model to C++
        auto settings = ScramNodeOptions(nodeOptions);
        auto model = ScramNodeModel(nodeModel);

        // 2. Run analysis with timing
        scram::core::RiskAnalysis analysis(model.get(), settings);
        
        // Measure analysis time
        auto analysis_start = std::chrono::steady_clock::now();
        analysis.Analyze();
        auto analysis_end = std::chrono::steady_clock::now();
        
        // Calculate analysis duration in seconds
        double analysis_seconds = std::chrono::duration<double>(analysis_end - analysis_start).count();
        
        // Set runtime metrics
        scram::core::RiskAnalysis::RuntimeMetrics metrics;
        metrics.analysis_seconds = analysis_seconds;
        metrics.total_runtime_seconds = analysis_seconds; // For now, set total to same as analysis
        analysis.set_runtime_metrics(metrics);

        // Check if this is an adaptive analysis
        bool has_adaptive = false;
        for (const auto& result : analysis.results()) {
          if (result.fault_tree_analysis && result.fault_tree_analysis->adaptive_mode_used()) {
            has_adaptive = true;
            break;
          }
        }
        
        // Also check event tree sequences (simplified - check settings)
        if (!has_adaptive && settings.algorithm() == scram::core::Algorithm::kBdd && !analysis.event_tree_results().empty()) {
          // If using BDD with event trees, likely has adaptive sequences
          has_adaptive = true;
        }
        
        // Generate full report with cut sets
        Napi::Object report = ScramNodeReport(env, analysis);
        
        return report;
    } catch (const std::exception& e) {
        // Preserve the actual error message from SCRAM
        std::string errorMsg = "SCRAM Error: ";
        errorMsg += e.what();
        Napi::Error::New(env, errorMsg).ThrowAsJavaScriptException();
        return env.Null();
    } catch (...) {
        Napi::Error::New(env, "SCRAM Error: Unknown exception occurred").ThrowAsJavaScriptException();
        return env.Null();
    }
}
