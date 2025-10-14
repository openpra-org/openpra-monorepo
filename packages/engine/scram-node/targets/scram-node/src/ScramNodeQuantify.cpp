#include <napi.h>
#include <iostream>
#include "ScramNodeSettings.h"
#include "ScramNodeModel.h"
#include "ScramNodeReporter.h"
#include "risk_analysis.h"

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
        std::cout << "[QuantifyModel] Creating settings..." << std::endl;
        auto settings = ScramNodeOptions(nodeOptions);
        std::cout << "[QuantifyModel] Creating model..." << std::endl;
        auto model = ScramNodeModel(nodeModel);

        // 2. Run analysis
        std::cout << "[QuantifyModel] Creating RiskAnalysis..." << std::endl;
        scram::core::RiskAnalysis analysis(model.get(), settings);
        std::cout << "[QuantifyModel] Starting Analyze()..." << std::endl;
        analysis.Analyze();
        std::cout << "[QuantifyModel] Analyze() complete!" << std::endl;
        // 3. Map result to Node
        std::cout << "[QuantifyModel] Generating report..." << std::endl;
        return ScramNodeReport(env, analysis);
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
