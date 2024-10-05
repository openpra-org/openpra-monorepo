#include <boost/program_options.hpp>
#include <exception>
#include "AsyncScramWorker.h"

#include "targets/scram-cli/utils/RunScram.h"
#include "targets/scram-cli/utils/ParseArguments.h"

namespace po = boost::program_options;

/**
 * @brief Constructor for ScramWorker.
 * @param callback A Napi::Function reference for asynchronous callback.
 * @param args A vector of command-line arguments for the SCRAM engine.
 */
AsyncScramWorker::AsyncScramWorker(Napi::Function& callback, std::vector<std::string> args)
  : Napi::AsyncWorker(callback), args(std::move(args)) {};

/**
 * @brief Executes the main logic of the worker.
 *
 * This method converts the command-line arguments to argc and argv format,
 * parses the arguments, and runs the SCRAM analysis. Any exceptions are
 * caught and recorded as errors.
 */
void AsyncScramWorker::Execute() {
  // Convert vector of strings to argc and argv format for command-line parsing.
  std::vector<char*> argv;
  for(std::string &s: args) {
    argv.push_back(&s[0]);
  }
  argv.push_back(NULL);

  try {
    // Parse arguments and run the scram command, catching any exceptions.
    po::variables_map vm;
    ScramCLI::ParseArguments(argv.size() - 1, argv.data(), &vm);
    ScramCLI::RunScram(vm);
  } catch (const std::exception& e) {
    // If an exception occurs, record the error message.
    SetError(e.what());
  }
}

/**
 * @brief Callback method called upon successful execution.
 *
 * This method is invoked when the Execute method completes without errors.
 * It calls the JavaScript callback function with a null argument, indicating
 * successful completion.
 */
void AsyncScramWorker::OnOK() {
  Napi::HandleScope scope(Env());
  Callback().Call({Env().Null()});
}
