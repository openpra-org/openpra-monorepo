#include <boost/core/typeinfo.hpp>
#include <boost/exception/all.hpp>
#include <boost/program_options.hpp>
#include <libxml/xmlerror.h>  // initGenericErrorDefaultFunc
#include <libxml/xmlversion.h>
#include <libxml/parser.h>  // xmlInitParser, xmlCleanupParser
#include <omp.h>

#include "error.h"
#include "ext/scope_guard.h"
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

  // Initialize XML library.
  LIBXML_TEST_VERSION
  xmlInitParser();
  SCOPE_EXIT(&xmlCleanupParser);

  // Set up custom XML error handling.
  xmlGenericErrorFunc xml_error_printer = LogXmlError;
  initGenericErrorDefaultFunc(&xml_error_printer);

  try {
    // Parse arguments and run the SCRAM command, catching any exceptions.
    po::variables_map vm;
    int ret = ParseArguments(argv.size()-1, argv.data(), &vm);
    if (ret == 0) {
      RunScram(vm);
    }
  } catch (const scram::LogicError& err) {
    // Handle SCRAM-specific logic errors.
    LOG(scram::ERROR) << "Logic Error:\n" << boost::diagnostic_information(err);
  } catch (const scram::IOError& err) {
    // Handle SCRAM-specific IO errors.
    LOG(scram::DEBUG1) << boost::diagnostic_information(err);
    std::cerr << boost::core::demangled_name(typeid(err)) << "\n\n";
    PrintErrorInfo<boost::errinfo_file_name>("File", err);
    PrintErrorInfo<boost::errinfo_file_open_mode>("Open mode", err);
    if (const int* errnum = boost::get_error_info<boost::errinfo_errno>(err)) {
      std::cerr << "Error code: " << *errnum << "\n";
      std::cerr << "Error string: " << std::strerror(*errnum) << "\n";
    }
    std::cerr << "\n" << err.what() << std::endl;
  } catch (const scram::Error& err) {
    // Handle other SCRAM-specific errors.
    using namespace scram;  // NOLINT
    LOG(DEBUG1) << boost::diagnostic_information(err);
    std::cerr << boost::core::demangled_name(typeid(err)) << "\n\n";
    PrintErrorInfo<errinfo_value>("Value", err);
    PrintErrorInfo<boost::errinfo_file_name>("File", err);
    PrintErrorInfo<boost::errinfo_at_line>("Line", err);
    PrintErrorInfo<mef::errinfo_connective>("MEF Connective", err);
    PrintErrorInfo<mef::errinfo_reference>("MEF reference", err);
    PrintErrorInfo<mef::errinfo_base_path>("MEF base path", err);
    PrintErrorInfo<mef::errinfo_element_id>("MEF Element ID", err);
    PrintErrorInfo<mef::errinfo_element_type>("MEF Element type", err);
    PrintErrorInfo<mef::errinfo_container_id>("MEF Container", err);
    PrintErrorInfo<mef::errinfo_container_type>("MEF Container type", err);
    PrintErrorInfo<mef::errinfo_attribute>("MEF Attribute", err);
    PrintErrorInfo<mef::errinfo_cycle>("Cycle", err);
    PrintErrorInfo<xml::errinfo_element>("XML element", err);
    PrintErrorInfo<xml::errinfo_attribute>("XML attribute", err);
    std::cerr << "\n" << err.what() << std::endl;
  } catch (const boost::exception& boost_err) {
    // Handle unexpected Boost exceptions.
    LOG(scram::ERROR) << "Unexpected Boost Exception:\n"
                      << boost::diagnostic_information(boost_err);
  } catch (const std::exception& err) {
    // Handle unexpected standard exceptions.
    LOG(scram::ERROR) << "Unexpected Exception: "
                      << boost::core::demangled_name(typeid(err)) << ":\n"
                      << err.what();
  }

  wtime = omp_get_wtime() - wtime; // Measure the elapsed time.
  std::cout << "Elapsed wall clock time= " << wtime << " seconds!" << std::endl;
}
