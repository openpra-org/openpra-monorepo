#include "ScramNodeSettings.h"

// Step 1: TypeScript to C++ Settings Mapping
scram::core::Settings ScramNodeOptions(const Napi::Object& nodeOptions) {
    scram::core::Settings settings;

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
