#include "CommandLine.h"
#include "ScramCLI.h"

/**
 * @brief The main function of the program.
 *
 * @param argc The number of command line arguments.
 * @param argv The command line arguments.
 *
 * @return The exit status of the program.
 */
int main(int argc, char **argv) {
    CommandLineArgs args = {
            .argc = argc,
            .argv = argv,
    };
    auto options = ScramCLI(args).getArguments();
    //RunScram(options);
}
