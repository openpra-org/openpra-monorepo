#include <boost/test/unit_test.hpp>
#include <boost/test/tools/output_test_stream.hpp>
#include <boost/program_options.hpp>
#include <iostream>
#include <string>
#include <vector>
#include "ScramWorker.h"

// Mocking the main function and its dependencies
namespace po = boost::program_options;

int ParseArguments(int argc, char* argv[], po::variables_map* vm);
void RunScram(const po::variables_map& vm);

BOOST_AUTO_TEST_CASE(NoInputOrConfigFile) {
    boost::test_tools::output_test_stream output;
    std::streambuf* oldCerrStreamBuf = std::cerr.rdbuf(output.rdbuf());

    std::vector<std::string> args = {"--mocus", "--mcub", "--probability"};
    ScramWorker worker(args);
    worker.Execute();

    BOOST_CHECK(output.is_equal("No input or configuration file is given.\n\nUsage:    scram [options] input-files...\n\nOptions:\n  --help                Display this help message\n  --version             Display version information\n  --project arg         Project file with analysis configurations\n  --allow-extern        **UNSAFE** Allow external libraries\n  --validate            Validate input files without analysis\n  --bdd                 Perform qualitative analysis with BDD\n  --zbdd                Perform qualitative analysis with ZBDD\n  --mocus               Perform qualitative analysis with MOCUS\n  --prime-implicants    Calculate prime implicants\n  --probability         Perform probability analysis\n  --importance          Perform importance analysis\n  --uncertainty         Perform uncertainty analysis\n  --ccf                 Perform common-cause failure analysis\n  --sil                 Compute the Safety Integrity Level metrics\n  --rare-event          Use the rare event approximation\n  --mcub                Use the MCUB approximation\n  --limit-order arg     Upper limit for the product order\n  --cut-off arg         Cut-off probability for products\n  --mission-time arg    System mission time in hours\n  --time-step arg       Time step in hours for probability analysis\n  --num-trials arg      Number of trials for Monte Carlo simulations\n  --num-quantiles arg   Number of quantiles for distributions\n  --num-bins arg        Number of bins for histograms\n  --seed arg            Seed for the pseudo-random number generator\n  --output arg          Output file for reports\n  --no-indent           Omit indentation whitespace in output XML\n  --verbosity arg       Set log verbosity\n\nDebug Options:\n  --serialize           Serialize the input model without further analysis\n  --preprocessor        Stop analysis after the preprocessing step\n  --print               Print analysis results in a terminal friendly way\n  --no-report           Don't generate analysis report\n"));

    std::cerr.rdbuf(oldCerrStreamBuf);
}

BOOST_AUTO_TEST_CASE(MutuallyExclusiveQualitativeAnalysisAlgorithms) {
    boost::test_tools::output_test_stream output;
    std::streambuf* oldCerrStreamBuf = std::cerr.rdbuf(output.rdbuf());

    std::vector<std::string> args = {"--bdd", "--zbdd", "--mcub", "--probability", "/tmp/model1.xml"};
    ScramWorker worker(args);
    worker.Execute();

    BOOST_CHECK(output.is_equal("Mutually exclusive qualitative analysis algorithms.\n(MOCUS/BDD/ZBDD) cannot be applied at the same time.\n\nUsage:    scram [options] input-files...\n\nOptions:\n  --help                Display this help message\n  --version             Display version information\n  --project arg         Project file with analysis configurations\n  --allow-extern        **UNSAFE** Allow external libraries\n  --validate            Validate input files without analysis\n  --bdd                 Perform qualitative analysis with BDD\n  --zbdd                Perform qualitative analysis with ZBDD\n  --mocus               Perform qualitative analysis with MOCUS\n  --prime-implicants    Calculate prime implicants\n  --probability         Perform probability analysis\n  --importance          Perform importance analysis\n  --uncertainty         Perform uncertainty analysis\n  --ccf                 Perform common-cause failure analysis\n  --sil                 Compute the Safety Integrity Level metrics\n  --rare-event          Use the rare event approximation\n  --mcub                Use the MCUB approximation\n  --limit-order arg     Upper limit for the product order\n  --cut-off arg         Cut-off probability for products\n  --mission-time arg    System mission time in hours\n  --time-step arg       Time step in hours for probability analysis\n  --num-trials arg      Number of trials for Monte Carlo simulations\n  --num-quantiles arg   Number of quantiles for distributions\n  --num-bins arg        Number of bins for histograms\n  --seed arg            Seed for the pseudo-random number generator\n  --output arg          Output file for reports\n  --no-indent           Omit indentation whitespace in output XML\n  --verbosity arg       Set log verbosity\n\nDebug Options:\n  --serialize           Serialize the input model without further analysis\n  --preprocessor        Stop analysis after the preprocessing step\n  --print               Print analysis results in a terminal friendly way\n  --no-report           Don't generate analysis report\n"));

    std::cerr.rdbuf(oldCerrStreamBuf);
}

BOOST_AUTO_TEST_CASE(RareEventAndMCUBApproximations) {
    boost::test_tools::output_test_stream output;
    std::streambuf* oldCerrStreamBuf = std::cerr.rdbuf(output.rdbuf());

    std::vector<std::string> args = {"--mocus", "--rare-event", "--mcub", "--probability", "/tmp/model1.xml"};
    ScramWorker worker(args);
    worker.Execute();

    BOOST_CHECK(output.is_equal("The rare event and MCUB approximations cannot be applied at the same time.\n\nUsage:    scram [options] input-files...\n\nOptions:\n  --help                Display this help message\n  --version             Display version information\n  --project arg         Project file with analysis configurations\n  --allow-extern        **UNSAFE** Allow external libraries\n  --validate            Validate input files without analysis\n  --bdd                 Perform qualitative analysis with BDD\n  --zbdd                Perform qualitative analysis with ZBDD\n  --mocus               Perform qualitative analysis with MOCUS\n  --prime-implicants    Calculate prime implicants\n  --probability         Perform probability analysis\n  --importance          Perform importance analysis\n  --uncertainty         Perform uncertainty analysis\n  --ccf                 Perform common-cause failure analysis\n  --sil                 Compute the Safety Integrity Level metrics\n  --rare-event          Use the rare event approximation\n  --mcub                Use the MCUB approximation\n  --limit-order arg     Upper limit for the product order\n  --cut-off arg         Cut-off probability for products\n  --mission-time arg    System mission time in hours\n  --time-step arg       Time step in hours for probability analysis\n  --num-trials arg      Number of trials for Monte Carlo simulations\n  --num-quantiles arg   Number of quantiles for distributions\n  --num-bins arg        Number of bins for histograms\n  --seed arg            Seed for the pseudo-random number generator\n  --output arg          Output file for reports\n  --no-indent           Omit indentation whitespace in output XML\n  --verbosity arg       Set log verbosity\n\nDebug Options:\n  --serialize           Serialize the input model without further analysis\n  --preprocessor        Stop analysis after the preprocessing step\n  --print               Print analysis results in a terminal friendly way\n  --no-report           Don't generate analysis report\n"));

    std::cerr.rdbuf(oldCerrStreamBuf);
}

BOOST_AUTO_TEST_CASE(InvalidVerbosityLevel) {
    boost::test_tools::output_test_stream output;
    std::streambuf* oldCerrStreamBuf = std::cerr.rdbuf(output.rdbuf());

    std::vector<std::string> args = {"--mocus", "--mcub", "probability", "--verbosity", "10", "/tmp/model1.xml"};
    ScramWorker worker(args);
    worker.Execute();

    BOOST_CHECK(output.is_equal("Log verbosity must be between 0 and 7.\n\nUsage:    scram [options] input-files...\n\nOptions:\n  --help                Display this help message\n  --version             Display version information\n  --project arg         Project file with analysis configurations\n  --allow-extern        **UNSAFE** Allow external libraries\n  --validate            Validate input files without analysis\n  --bdd                 Perform qualitative analysis with BDD\n  --zbdd                Perform qualitative analysis with ZBDD\n  --mocus               Perform qualitative analysis with MOCUS\n  --prime-implicants    Calculate prime implicants\n  --probability         Perform probability analysis\n  --importance          Perform importance analysis\n  --uncertainty         Perform uncertainty analysis\n  --ccf                 Perform common-cause failure analysis\n  --sil                 Compute the Safety Integrity Level metrics\n  --rare-event          Use the rare event approximation\n  --mcub                Use the MCUB approximation\n  --limit-order arg     Upper limit for the product order\n  --cut-off arg         Cut-off probability for products\n  --mission-time arg    System mission time in hours\n  --time-step arg       Time step in hours for probability analysis\n  --num-trials arg      Number of trials for Monte Carlo simulations\n  --num-quantiles arg   Number of quantiles for distributions\n  --num-bins arg        Number of bins for histograms\n  --seed arg            Seed for the pseudo-random number generator\n  --output arg          Output file for reports\n  --no-indent           Omit indentation whitespace in output XML\n  --verbosity arg       Set log verbosity\n\nDebug Options:\n  --serialize           Serialize the input model without further analysis\n  --preprocessor        Stop analysis after the preprocessing step\n  --print               Print analysis results in a terminal friendly way\n  --no-report           Don't generate analysis report\n"));

    std::cerr.rdbuf(oldCerrStreamBuf);
}
