#include <boost/program_options.hpp>
#include <exception>
#include "ScramWorker.h"
#include "scram.cc"

namespace po = boost::program_options;

ScramWorker::ScramWorker(Napi::Function& callback, std::vector<std::string> args)
  : Napi::AsyncWorker(callback), args(std::move(args)) {};

void ScramWorker::Execute() {
  // Convert vector of strings to argc and argv format
  std::vector<char*> argv;
  for(std::string &s: args) {
    argv.push_back(&s[0]);
  }
  argv.push_back(NULL);

  try {
    // Simulate calling the main function
    po::variables_map vm;
    ParseArguments(argv.size()-1, argv.data(), &vm);
    RunScram(vm);
  } catch (const std::exception& e) {
    SetError(e.what());
  }
}

void ScramWorker::OnOK() {
  Napi::HandleScope scope(Env());
  Callback().Call({Env().Null()});
}
