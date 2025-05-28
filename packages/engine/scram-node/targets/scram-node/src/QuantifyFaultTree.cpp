#include "settings.h"
#include "QuantifyFaultTree.h"

using namespace scram;

namespace {
    // Step 1: TypeScript to C++ Settings Mapping
    core::Settings ScramNodeOptions(const Napi::Object& nodeOptions) {
        core::Settings settings;

        // Algorithm (mocus, bdd, zbdd)
        if (nodeOptions.Has("mocus")) {
            if (nodeOptions.Get("mocus").ToBoolean().Value())
                settings.algorithm("mocus");
        } else if (nodeOptions.Has("bdd")) {
            if (nodeOptions.Get("bdd").ToBoolean().Value())
                settings.algorithm("bdd");
        } else if (nodeOptions.Has("zbdd")) {
            if (nodeOptions.Get("zbdd").ToBoolean().Value())
                settings.algorithm("zbdd");
        } else {
            settings.algorithm("mocus");
        }

        // Approximation (rare-event, mcub, none)
        if (nodeOptions.Has("rareEvent")) {
            if (nodeOptions.Get("rareEvent").ToBoolean().Value())
                settings.approximation("rare-event");
        } else if (nodeOptions.Has("mcub")) {
            if (nodeOptions.Get("mcub").ToBoolean().Value())
                settings.approximation("mcub");
        } else {
            settings.approximation("none");
        }

        // Prime implicants (bool)
        if (nodeOptions.Has("primeImplicants")) {
            settings.prime_implicants(nodeOptions.Get("primeImplicants").ToBoolean().Value());
        }

        // Probability analysis (bool)
        if (nodeOptions.Has("probability")) {
            settings.probability_analysis(nodeOptions.Get("probability").ToBoolean().Value());
        }

        // Importance analysis (bool)
        if (nodeOptions.Has("importance")) {
            settings.importance_analysis(nodeOptions.Get("importance").ToBoolean().Value());
        }

        // Uncertainty analysis (bool)
        if (nodeOptions.Has("uncertainty")) {
            settings.uncertainty_analysis(nodeOptions.Get("uncertainty").ToBoolean().Value());
        }

        // CCF analysis (bool)
        if (nodeOptions.Has("ccf")) {
            settings.ccf_analysis(nodeOptions.Get("ccf").ToBoolean().Value());
        }

        // Safety Integrity Levels (bool)
        if (nodeOptions.Has("sil")) {
            settings.safety_integrity_levels(nodeOptions.Get("sil").ToBoolean().Value());
        }

        // Limit order (int)
        if (nodeOptions.Has("limitOrder")) {
            settings.limit_order(nodeOptions.Get("limitOrder").ToNumber().Int32Value());
        }

        // Cut-off (double)
        if (nodeOptions.Has("cutOff")) {
            settings.cut_off(nodeOptions.Get("cutOff").ToNumber().DoubleValue());
        }

        // Mission time (double)
        if (nodeOptions.Has("missionTime")) {
            settings.mission_time(nodeOptions.Get("missionTime").ToNumber().DoubleValue());
        }

        // Time step (double)
        if (nodeOptions.Has("timeStep")) {
            settings.time_step(nodeOptions.Get("timeStep").ToNumber().DoubleValue());
        }

        // Number of trials (int)
        if (nodeOptions.Has("numTrials")) {
            settings.num_trials(nodeOptions.Get("numTrials").ToNumber().Int32Value());
        }

        // Number of quantiles (int)
        if (nodeOptions.Has("numQuantiles")) {
            settings.num_quantiles(nodeOptions.Get("numQuantiles").ToNumber().Int32Value());
        }

        // Number of bins (int)
        if (nodeOptions.Has("numBins")) {
            settings.num_bins(nodeOptions.Get("numBins").ToNumber().Int32Value());
        }

        // Seed (int)
        if (nodeOptions.Has("seed")) {
            settings.seed(nodeOptions.Get("seed").ToNumber().Int32Value());
        }

        return settings;
    }
}

// 4. The Node Addon Method for Quantifying Fault Trees
Napi::Value QuantifyFaultTree(const Napi::CallbackInfo& info) {
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
        core::RiskAnalysis analysis(model.get(), settings);
        analysis.Analyze();
    } catch (const std::exception& e) {
        Napi::Error::New(env, "Failed to analyze the fault trees").ThrowAsJavaScriptException();
        return env.Null();
    }

    try {
        // 3. Map result to Node
        Napi::Object nodeReport = ScramNodeReport(env, analysis);
        return nodeReport;
    } catch (const std::exception& e) {
        Napi::Error::New(env, "Failed to generate the quantification report").ThrowAsJavaScriptException();
        return env.Null();
    }
}
