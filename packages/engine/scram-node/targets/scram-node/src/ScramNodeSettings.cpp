#include "ScramNodeSettings.h"

// Step 1: TypeScript to C++ Settings Mapping
scram::core::Settings ScramNodeOptions(const Napi::Object& nodeOptions) {
    scram::core::Settings settings;

    // Algorithm (mocus, bdd, zbdd, pdag)
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
        settings.algorithm("mocus");
    }

    // Approximation (rare-event, mcub, monte-carlo, none)
    if (nodeOptions.Has("rareEvent")) {
        if (nodeOptions.Get("rareEvent").ToBoolean().Value())
            settings.approximation("rare-event");
    } else if (nodeOptions.Has("mcub")) {
        if (nodeOptions.Get("mcub").ToBoolean().Value())
            settings.approximation("mcub");
    } else if (nodeOptions.Has("monteCarlo")) {
        if (nodeOptions.Get("monteCarlo").ToBoolean().Value())
            settings.approximation("monte-carlo");
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

    // Monte Carlo specific parameters
    // Confidence level for convergence (double, 0-1)
    if (nodeOptions.Has("confidence")) {
        settings.ci_confidence(nodeOptions.Get("confidence").ToNumber().DoubleValue());
    }

    // Relative margin of error (delta) for convergence (double, >0)
    if (nodeOptions.Has("delta")) {
        settings.ci_rel_margin_error(nodeOptions.Get("delta").ToNumber().DoubleValue());
    }

    // Burn-in trials before convergence checks (int)
    if (nodeOptions.Has("burnIn")) {
        settings.ci_burnin_trials(nodeOptions.Get("burnIn").ToNumber().DoubleValue());
    }

    // Early stopping on convergence (bool)
    if (nodeOptions.Has("earlyStop")) {
        settings.early_stop(nodeOptions.Get("earlyStop").ToBoolean().Value());
    }

    // Convergence interval policy (string: "bayes" or "wald")
    if (nodeOptions.Has("ciPolicy")) {
        std::string policy = nodeOptions.Get("ciPolicy").ToString().Utf8Value();
        settings.ci_policy(policy);
    }

    // Batch size for Monte Carlo (int)
    if (nodeOptions.Has("batchSize")) {
        settings.batch_size(nodeOptions.Get("batchSize").ToNumber().Int32Value());
    }

    // Sample size for Monte Carlo (int)
    if (nodeOptions.Has("sampleSize")) {
        settings.sample_size(nodeOptions.Get("sampleSize").ToNumber().Int32Value());
    }

    // Node allocation overhead ratio (double, >=0)
    if (nodeOptions.Has("overheadRatio")) {
        settings.overhead_ratio(nodeOptions.Get("overheadRatio").ToNumber().DoubleValue());
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

    // Oracle probability for diagnostics (double, >=0)
    if (nodeOptions.Has("oracleP")) {
        settings.oracle_p(nodeOptions.Get("oracleP").ToNumber().DoubleValue());
    }

    // Watch mode (display analysis status on TTY)
    if (nodeOptions.Has("watchMode")) {
        settings.watch_mode(nodeOptions.Get("watchMode").ToBoolean().Value());
    }

    return settings;
}
