#include <napi.h>
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

    // 1. Map Node options/model to C++
    auto settings = ScramNodeOptions(nodeOptions);
    auto model = ScramNodeModel(nodeModel);

    try {
        // 2. Run analysis
        scram::core::RiskAnalysis analysis(model.get(), settings);
        analysis.Analyze();
        // 3. Map result to Node
        return ScramNodeReport(env, analysis);
    } catch (const std::exception& e) {
        Napi::Error::New(env, "Failed to run the analysis").ThrowAsJavaScriptException();
        return env.Null();
    }
}
