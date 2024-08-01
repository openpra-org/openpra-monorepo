#pragma once

#include "CommandLine.h"

class ScramCLI : public CommandLine {

public:
    explicit ScramCLI(const CommandLineArgs &args) : CommandLine(args) {}

protected:
    HeaderInfo buildHeaderInfo() override {
        return {};
    }

    boost::program_options::options_description buildOptions() override {
        auto options = buildQualitativeAnalysisOptions();
        options.add(buildUncertaintyAnalysisOptions())
               .add(buildVerbosityOptions());
        return options;
    }

    static boost::program_options::options_description buildQualitativeAnalysisOptions() {
        auto opts = CommandLine::Options("Qualitative Analysis defaults: [BDD, prime-implicants, limit-order=20, cut-off=1e-14]");
        opts.add_options()
        ("minimal-cut-sets", "Compute MCS instead of prime implicants")
        ("zbdd,z", "Use ZBDDs instead of BDDs")
        ("mocus,m", "Use MOCUS instead of BDDs")
        ("limit-order,l", boost::program_options::value<unsigned long>()->default_value(20), "Upper limit for the product order")
        ("cut-off,p", OPT_VALUE(double), "Cut-off probability for products");
        return opts;
    }

    static boost::program_options::options_description buildProbabilityCalculationOptions() {
        auto opts = CommandLine::Options("Probability Calculation");
        opts.add_options()
        ("probability", "Quantify probabilities")
        ("rare-event", "Use the rare event approximation")
        ("mcub", "Use the min-cut upper-bound approximation")
        ("mission-time", boost::program_options::value<double>()->default_value(1), "System mission time [hr]")
        ("time-step", boost::program_options::value<double>()->default_value(1), "Time step [hr]");
        return opts;
    }

    static boost::program_options::options_description buildUncertaintyAnalysisOptions() {
        auto opts = CommandLine::Options("Uncertainty Analysis");
        opts.add_options()
        ("uncertainty,u", boost::program_options::value<bool>(), "Perform uncertainty quantification")
        ("seed,s", boost::program_options::value<unsigned long>()->default_value(42), "Seed for random number generator")
        ("num-trials,n",  OPT_VALUE(unsigned long), "Number of Monte-Carlo samples")
        ("num-quantiles,q", OPT_VALUE(unsigned long), "Number of quantiles for distributions")
        ("num-bins,N", OPT_VALUE(unsigned long), "Number of bins for histograms");
        return opts;
    }

    static boost::program_options::options_description buildVerbosityOptions() {
        auto opts = CommandLine::Options("Verbosity Level");
        return opts;
    }

//    /**
//     * @brief This function builds the input options for the program.
//     *
//     * @return A boost::program_options::options_description object containing the description of the input options.
//     */
//    void buildInputArguments(boost::program_options::options_description &values) override {
//        values.add_options()(",a", boost::program_options::value<long double>(),
//                             "= Length of 1st dimension (+ve real)")(",b", boost::program_options::value<long double>(),
//                                                                     "= Length of 2nd dimension (+ve real)")(
//                ",m", boost::program_options::value<long double>(), "= Number of mesh-points in 1st dimension")(
//                ",n", boost::program_options::value<long double>(), "= Number of mesh-points in 2nd dimension")(
//                ",D", boost::program_options::value<long double>(), "= Diffusion coefficient D (+ve real)")(
//                "cross-section", boost::program_options::value<long double>(), "= Removal cross-section Σₐ (+ve real)")(
//                "input-parameter-json,i", boost::program_options::value<std::string>(), "= Path to input parameter JSON")(
//                "source-terms-csv,s", boost::program_options::value<std::string>(), "= Path to source-terms 𝑞(𝑖,𝑗) CSV")(
//                "output-results-json,o", boost::program_options::value<std::string>(), "= Path to output results JSON")(
//                "output-flux-csv,f", boost::program_options::value<std::string>(), "= Path to computed flux 𝜙(𝑖,𝑗) CSV");
//
//        boost::program_options::options_description methods("Solver Methods");
//        methods.add_options()("use-LUP", "= Use the LUP method")("use-point-jacobi",
//                                                                 "= [DISABLED] Use the Point-Jacobi method")(
//                "use-gauss-seidel", "= [DISABLED] Use the Gauss-Seidel method")("use-SOR",
//                                                                                "= [DISABLED] Use the SOR method");
//        values.add(methods);
//    }
};
