#include <boost/program_options.hpp>
#include <exception>
#include "ScramWorker.h"
#include "scram.cc"

namespace po = boost::program_options;

// Constructor implementation: initializes the base class and moves the arguments.
ScramWorker::ScramWorker(Napi::Function& callback, std::vector<std::string> args)
  : Napi::AsyncWorker(callback), args(std::move(args)) {};

// Execute method: converts arguments and runs the scram command in a try-catch block.
void ScramWorker::Execute() {
  // Convert vector of strings to argc and argv format for command-line parsing.
  std::vector<char*> argv;
  for(std::string &s: args) {
    argv.push_back(&s[0]);
  }
  argv.push_back(NULL);

  try {
    // Parse arguments and run the scram command, catching any exceptions.
    po::variables_map vm;
    ParseArguments(argv.size()-1, argv.data(), &vm);
    RunScram(vm);
  } catch (const std::exception& e) {
    // If an exception occurs, record the error message.
    SetError(e.what());
  }
}

// OnOK method: called when Execute completes without errors, invokes the callback with no arguments.
void ScramWorker::OnOK() {
  Napi::HandleScope scope(Env());
  Callback().Call({Env().Null()});
}
