/**
* @file CommandLine.h
* @brief This file contains the definition of the CommandLine class.
* The CommandLine class is used to parse command line arguments.
*/

// TODO:: ADD License

#pragma once

#include <boost/program_options.hpp>
#include <iostream>
#include <string>
#include <utility>

#include "CommandLineHelpers.h"
#include "logger.h"

#ifndef OPT_VALUE
#define OPT_VALUE(type) boost::program_options::value<type>()->value_name(#type)
#endif

/**
* @struct HeaderInfo
* @brief A struct to store information about the tool.
*/
typedef struct {
    std::string ToolName;
    std::string ToolDescription;
    std::string HeaderArt;
} HeaderInfo;

/**
* @struct CommandLineArgs
* @brief A struct to store command line arguments.
*
* This struct contains two members: argc and argv. argc is an integer that represents the number of command line arguments,
* and argv is a pointer to an array of character pointers that represent the command line arguments themselves.
*/
struct CommandLineArgs {
    int argc{}; ///< The number of command line arguments.
    char **argv{}; ///< The array of command line arguments.
};

/**
* @class CommandLine
* @brief A class to parse command line arguments and display information about the project.
*
* This class contains methods to parse command line arguments using the Boost library, and to display information about
* the project. The constructor takes a HeaderInfo object and command line arguments, and initializes the class. The
* getArguments method returns the parsed command line arguments. The printLine method prints a line to the console. The
* buildGenerics method builds a set of generic command line options. The printHeader method prints the project header
* to the console. The printPrecisionInformation method prints information about the precision of long double values.
* The initialize method initializes the class by printing the compile configurations and precision information, and
* parsing the command line arguments. The printCompileConfigs method prints the compile configurations to the console.
*/

class CommandLine {

public:
    /**
    * @brief Constructor for the CommandLine class.
    * @param headerInfo A HeaderInfo object containing information about the project.
    * @param args Command line arguments.
    * This constructor initializes the CommandLine object with the provided HeaderInfo object and command line
    * arguments. It also prints the project header.
    */
    explicit CommandLine(CommandLineArgs args) {
        cmdArgs = args;
        initialized = false;
    }

    /**
    * @brief Default constructor for the CommandLine class.
    * This constructor initializes the CommandLine object with an empty variables map.
    */
    explicit CommandLine() { variablesMap = boost::program_options::variables_map(); }

    /**
    * @brief Destructor for the CommandLine class.
    * This is a virtual destructor that does nothing.
    */
    virtual ~CommandLine() = default;

    /**
    * @brief Method to get the parsed command line arguments.
    * @return A reference to the variables map that contains the parsed command line arguments.
    * This method returns the parsed command line arguments. If the CommandLine object is not initialized,
    * it calls the initialize method before returning the arguments.
    */
    boost::program_options::variables_map &getArguments() {
        if (!initialized) {
            initialize();
        }
        return variablesMap;
    }

    /**
    * @brief Method to get a copy of the parsed command line arguments.
    * @return A copy of the variables map that contains the parsed command line arguments.
    * This method returns a copy of the parsed command line arguments. If the CommandLine object is not initialized,
    * it calls the initialize method before returning the arguments.
    */
    boost::program_options::variables_map getArgumentsMap() {
        if (!initialized) {
            initialize();
        }
        return variablesMap;
    }

    /**
    * @brief Method to get the command line argv, argc objects.
    * @return A const reference to the CommandLineArgs object that contains the command line arguments.
    * This method returns the command line arguments that were passed to the program.
    */
    [[nodiscard]] const CommandLineArgs &getCmdArgs() const { return cmdArgs; }


    [[maybe_unused]] static boost::program_options::options_description Options(const std::basic_string<char>& caption) {
        const std::basic_string<char> line = R"(--------------------------------------------------------------------------------)";
        return boost::program_options::options_description(caption + "\n" + line);
    }

    /**
     * @brief Method to print a line to the console.
     * This method prints a line of dashes to the console.
     */
    static void printLine() {
        std::cout << R"(--------------------------------------------------------------------------------)"
                  << "\n";
    }

protected:

    /**
    * @brief Method to build a set of input arguments.
    * @param inputArguments A reference to an options_description object that will be filled with the input arguments.
    * This is a pure virtual method that must be implemented by derived classes. It is used to build a set of input arguments
    * for the command line parser.
    */
    virtual boost::program_options::options_description buildOptions() = 0;

    /**
    * @brief Method to build a set of input arguments.
    * @param inputArguments A reference to an options_description object that will be filled with the input arguments.
    * This is a pure virtual method that must be implemented by derived classes. It is used to build a set of input arguments
    * for the command line parser.
    */
//    virtual boost::program_options::options_description &buildInputArguments(boost::program_options::options_description &) = 0;
//
//    /**
//    * @brief Method to print the input arguments.
//    * @param values A reference to a variables_map object that contains the parsed command line arguments.
//    * This is a pure virtual method that must be implemented by derived classes. It is used to print the input arguments
//    * to the console.
//    */
//    virtual void printInputArguments(boost::program_options::variables_map &values) = 0;
//
//    /**
//    * @brief Method to perform a check on the input arguments.
//    * @param values A reference to a variables_map object that contains the parsed command line arguments.
//    * This is a pure virtual method that must be implemented by derived classes. It is used to perform a check on the input
//    * arguments to ensure they are valid.
//    */
//    virtual void performInputArgumentsCheck(boost::program_options::variables_map &values) = 0;
//
//    /**
//    * @brief Method to fill the inputs object based on the parsed command line arguments.
//    * @param ToFill A reference to the inputs object that will be filled.
//    * @param values A reference to a variables_map object that contains the parsed command line arguments.
//    * This is a pure virtual method that must be implemented by derived classes. It is used to fill the inputs object based
//    * on the parsed command line arguments.
//    */
//    virtual void buildInputs(boost::program_options::variables_map &values) = 0;

    /**
    * @var variablesMap
    * @brief A variables_map object to store the parsed command line arguments.
    *
    * This object is used to store the parsed command line arguments. It is filled by the Boost library's command line
    * parser.
    */
    boost::program_options::variables_map variablesMap;

    /**
    * @var initialized
    * @brief A boolean flag to indicate whether the CommandLine object has been initialized.
    *
    * This flag is set to true when the CommandLine object is initialized, and is used to prevent the object from being
    * initialized more than once.
    */
    bool initialized = false;

    /**
    * @var cmdArgs
    * @brief A CommandLineArgs object to store the command line arguments.
    *
    * This object is used to store the command line arguments that were passed to the program.
    */
    CommandLineArgs cmdArgs;

    /**
     * @brief Builds the header information.
     * @return The header information.
     */
    virtual HeaderInfo buildHeaderInfo() = 0;

    /**
     * @brief Method to print the project header to the console.
     * @param headerInfo A reference to a HeaderInfo object containing information about the project.
     * This method prints the project name, project description, student name, and submission date to the console.
     */
    static void printHeader(const HeaderInfo& headerInfo) {
        if (!headerInfo.HeaderArt.empty()) {
            std::cerr << headerInfo.HeaderArt << std::endl;
        } else {
            std::cerr << R"(
                    ███╗   ██╗███████╗      ███████╗ █████╗  ██╗
                    ████╗  ██║██╔════╝      ██╔════╝██╔══██╗███║
                    ██╔██╗ ██║█████╗  █████╗███████╗╚██████║╚██║
                    ██║╚██╗██║██╔══╝  ╚════╝╚════██║ ╚═══██║ ██║
                    ██║ ╚████║███████╗      ███████║ █████╔╝ ██║
                    ╚═╝  ╚═══╝╚══════╝      ╚══════╝ ╚════╝  ╚═╝
        )" << std::endl;
        }
        std::cerr << headerInfo.ToolName << ": " << headerInfo.ToolDescription << std::endl;
        printLine();
    }

    /**
     * @brief Method to build a set of generic command line options.
     * @return An options description containing the generic command line options.
     * This method builds a set of generic command line options, such as "help", "quiet", and "precision",
     * and returns them as an options description.
     */
    static boost::program_options::options_description buildGenerics() {
        auto generics = CommandLine::Options("General Options");
        generics.add_options()
        ("help,h", "Show this help message")
        ("version,v", "Display version information");
        return generics;
    }

    virtual /**
    * @brief Method to initialize the CommandLine object.
    * This method initializes the CommandLine object by printing the compile configurations and precision information,
    * and parsing the command line arguments. If the CommandLine object is already initialized, it does nothing.
    */
    void initialize() {

        if (initialized) {
            return;
        }


        using a = stderr;

        // if help, print options and exit
        if (variablesMap.count("help")) {
            std::cout << options << "\n";
            exit(0);
        }

        // print the header
        printHeader(buildHeaderInfo());

        initialized = true;
        auto options = buildOptions().add(buildGenerics());
        boost::program_options::store(boost::program_options::parse_command_line(cmdArgs.argc, cmdArgs.argv, options),
                                      variablesMap);
        boost::program_options::notify(variablesMap);

        // if help, print options and exit
        if (variablesMap.count("help")) {
            std::cout << options << "\n";
            exit(0);
        }

        // print compiler information
        if (!variablesMap.count("quiet")) {
            printCompileConfigs();
            // print command line options
            std::cout << options << "\n";
        }

        // consume and correct the input arguments
        //performInputArgumentsCheck(variablesMap);

        if (variablesMap.count("bench")) {
            // build the profiler now
            //ProfilerHelper::validateOptions(variablesMap);
        }

        if (!variablesMap.count("quiet")) {
            // print the input arguments
            //printInputArguments(variablesMap);
        }

        // finally, build and save the _inputs object
        //buildInputs(_inputs, variablesMap);
    }

    /**
    * @brief Method to print the compile configurations to the console.
    * This method prints the compiler ID, compiler version, compiler flags, and Boost version and libraries to the
    * console.
    */
    static void printCompileConfigs() {
        //std::cout << "using " << sizeof(MyBLAS::NumericType) * 8 <<"-bit floats\n";
        //std::cout << "compiler: " << CXX_COMPILER_ID << " " << CXX_COMPILER_VERSION;
        //std::cout << "\nboost: " << Boost_VERSION << " " << Boost_LIBRARIES << "\n";
    }
};
