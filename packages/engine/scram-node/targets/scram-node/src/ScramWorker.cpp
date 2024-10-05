#include "ScramWorker.h"
#include <boost/program_options.hpp>
#include <exception>

#include "targets/scram-cli/utils/ParseArguments.h"
#include "targets/scram-cli/utils/RunScram.h"

namespace po = boost::program_options;

/**
 * @brief Constructor for ScramWorker.
 * @param args A vector of command-line arguments.
 */
ScramWorker::ScramWorker(std::vector<std::string> args)
    : args(std::move(args)){};

/**
 * @brief Executes the main logic of the worker.
 *
 * This method converts the command-line arguments to argc and argv format,
 * parses the arguments, and runs the SCRAM analysis. Any exceptions are
 * caught and re-thrown with the exception message.
 *
 * @throws std::runtime_error If an exception occurs during execution.
 */
void ScramWorker::Execute() {
    // Convert vector of strings to argc and argv format for command-line parsing.
    std::vector<char *> argv;
    for (std::string &s: args) {
        argv.push_back(&s[0]);
    }
    argv.push_back(NULL);

    try {
        // Parse arguments and run the scram command, catching any exceptions.
        po::variables_map vm;
        ScramCLI::ParseArguments(argv.size() - 1, argv.data(), &vm);
        ScramCLI::RunScram(vm);
    } catch (const std::exception &e) {
        // If an exception occurs, throw it with a specific message.
        throw std::runtime_error(e.what());
    }
}
