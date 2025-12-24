#include "ScramNodeSettings.h"

// Step 1: TypeScript to C++ Settings Mapping
scram::core::Settings ScramNodeOptions(const Napi::Object& nodeOptions) {
    scram::core::Settings settings;

    // Set a default input file name for Monte Carlo progress logging
    // (required by convergence_controller for timestamp_string generation)
    std::vector<std::string> input_files = {"scram-node-model"};
    settings.input_files(input_files);

    // Check if Monte Carlo is requested (needs PDAG algorithm)
    bool needsPdag = false;
    if (nodeOptions.Has("monteCarlo") && nodeOptions.Get("monteCarlo").ToBoolean().Value()) {
        needsPdag = true;
    }

    // Algorithm (mocus, bdd, zbdd, pdag)
    // If monteCarlo is set and no algorithm is explicitly specified, default to pdag
    if (nodeOptions.Has("mocus")) {
        if (nodeOptions.Get("mocus").ToBoolean().Value())
            settings.algorithm("mocus");
    } else if (nodeOptions.Has("bdd")) {
        if (nodeOptions.Get("bdd").ToBoolean().Value())
            settings.algorithm("bdd");
    } else if (nodeOptions.Has("zbdd")) {
        if (nodeOptions.Get("zbdd").ToBoolean().Value())
            settings.algorithm("zbdd");
    } else if (nodeOptions.Has("pdag")) {
        if (nodeOptions.Get("pdag").ToBoolean().Value())
            settings.algorithm("pdag");
    } else {
        // Default: use PDAG if Monte Carlo is requested, otherwise MOCUS
        if (needsPdag) {
            settings.algorithm("pdag");
        } else {
            settings.algorithm("mocus");
        }
    }

    // Approximation (rare-event, mcub, monte-carlo, none)
    // Only set if explicitly provided - otherwise let the algorithm setter choose the default
    if (nodeOptions.Has("rareEvent")) {
        if (nodeOptions.Get("rareEvent").ToBoolean().Value())
            settings.approximation("rare-event");
    } else if (nodeOptions.Has("mcub")) {
        if (nodeOptions.Get("mcub").ToBoolean().Value())
            settings.approximation("mcub");
    } else if (nodeOptions.Has("monteCarlo")) {
        if (nodeOptions.Get("monteCarlo").ToBoolean().Value())
            settings.approximation("monte-carlo");
    }
    // Note: No "else" clause - let the algorithm() setter choose the appropriate default approximation

    // Prime implicants (bool)
    if (nodeOptions.Has("primeImplicants")) {
        settings.prime_implicants(nodeOptions.Get("primeImplicants").ToBoolean().Value());
    }

    // Adaptive quantification (bool)
    if (nodeOptions.Has("adaptive")) {
        settings.adaptive(nodeOptions.Get("adaptive").ToBoolean().Value());
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

    // Graph compilation and preprocessing flags
    // Expand at-least gates (--no-kn flag disables K/N gate optimization)
    if (nodeOptions.Has("noKn")) {
        settings.expand_atleast_gates(nodeOptions.Get("noKn").ToBoolean().Value());
    }

    // Expand XOR gates (--no-xor flag disables XOR gate optimization)
    if (nodeOptions.Has("noXor")) {
        settings.expand_xor_gates(nodeOptions.Get("noXor").ToBoolean().Value());
    }

    // Keep null gates (don't remove gates with no effect)
    if (nodeOptions.Has("keepNullGates")) {
        settings.keep_null_gates(nodeOptions.Get("keepNullGates").ToBoolean().Value());
    }

    // Compilation level (0-8, higher = more optimization)
    if (nodeOptions.Has("compilationLevel")) {
        settings.compilation_level(nodeOptions.Get("compilationLevel").ToNumber().Int32Value());
    }

    return settings;
}
