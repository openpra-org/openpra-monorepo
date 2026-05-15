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
        
        Napi::Object metadata;
        if (has_adaptive) {
          // For adaptive analyses, use full report to get probability_analysis results
          metadata = ScramNodeReport(env, analysis);
        } else {
          // FIRST: Extract metadata (stats we always want, regardless of file write success)
          // This ensures we get timing and count data even if writing productLists fails
          metadata = ScramNodeExtractMetadataFromFile(env, "", analysis);
        }

        // 3. Stream report to a temporary file to avoid large in-memory objects
        const auto reportPath = [&]() {
            std::filesystem::path tempDir;
            try {
                tempDir = std::filesystem::temp_directory_path();
            } catch (const std::exception &ex) {
                throw std::runtime_error(std::string("Unable to resolve temp directory: ") + ex.what());
            }

            auto randomSuffix = []() {
                std::random_device rd;
                std::uniform_int_distribution<std::uint64_t> dist(0, std::numeric_limits<std::uint64_t>::max());
                std::uint64_t value = dist(rd);
                std::ostringstream oss;
                oss << std::hex << value;
                return oss.str();
            };

            const auto timestamp = std::chrono::steady_clock::now().time_since_epoch().count();
            std::ostringstream filename;
            filename << "scram-report-" << timestamp << "-" << randomSuffix() << ".json";
            return (tempDir / filename.str());
        }();

        std::ofstream out(reportPath, std::ios::binary);
        if (!out) {
            throw std::runtime_error("Failed to create temporary SCRAM report file: " + reportPath.string());
        }

        // Try to write full report with productLists to simulate expensive serialization
        // This measures the true cost of writing millions of cut sets to disk
        // If this fails, we still have the metadata extracted above
        try {
            ScramNodeReportToJsonStream(out, analysis, false); // false = include productLists
            out.flush();
            out.close();

            // Clean up the temporary file - we've already extracted what we need
            try {
                std::filesystem::remove(reportPath);
            } catch (const std::exception &ex) {
                // Ignore cleanup errors
            }
        } catch (const std::exception &ex) {
            // Close and clean up file if it exists
            if (out.is_open()) {
                out.close();
            }
            try {
                if (std::filesystem::exists(reportPath)) {
                    std::filesystem::remove(reportPath);
                }
            } catch (...) {
                // Ignore cleanup errors
            }
        }

        return metadata;
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
