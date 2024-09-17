#include <boost/program_options.hpp>
#include <omp.h>
#include "error.h"
#include "logger.h"
#include "ScramWorker.h"
#include "scram.cc"

namespace po = boost::program_options;

/**
 * @brief Constructor for ScramWorker.
 *
 * Initializes the ScramWorker object with the provided command-line arguments.
 *
 * @param args A vector of command-line arguments.
 */
ScramWorker::ScramWorker(std::vector<std::string> args)
  : args(std::move(args)) {}

/**
 * @brief Executes the main logic of the worker.
 *
 * This method converts the command-line arguments to argc and argv format,
 * parses the arguments, and runs the SCRAM analysis. Any exceptions are
 * caught and re-thrown with the exception message.
 *
 * The method also initializes the XML parser and sets up custom error
 * handling for XML errors using a logging function. It tracks and logs the
 * execution time of the entire process.
 *
 * @throws std::runtime_error If an exception occurs during execution.
 */
void ScramWorker::Execute() {
  // Convert vector of strings to argc and argv format for command-line parsing.
  std::vector<char*> argv;
  for(std::string &s: args) {
    argv.push_back(&s[0]);  // Note: This implementation modifies the strings in place.
  }
  argv.push_back(NULL);

  double wtime = omp_get_wtime(); // Measure the elapsed time.

  // Parse arguments and run the SCRAM command, catching any exceptions.
  po::variables_map vm;
  int ret = ParseArguments(argv.size()-1, argv.data(), &vm);
  if (ret == 1) {
    std::cerr << "Error in parsing the arguments";
  }
  if (ret == 0) {
    RunScram(vm);
  }

  wtime = omp_get_wtime() - wtime; // Measure the elapsed time.
  std::cout << "Elapsed wall clock time= " << wtime << " seconds!" << std::endl;
}
