#pragma once
#include <napi.h>
#include <string>
#include <vector>

/**
 * @class ScramWorker
 * @brief Defines a class for synchronous execution.
 *
 * This class provides functionality for executing tasks synchronously
 * based on command-line arguments.
 */
class ScramWorker {
  public:
    /**
     * @brief Constructor for ScramWorker.
     * @param args A vector of command-line arguments.
     */
    ScramWorker(std::vector<std::string> args);

    /**
     * @brief Virtual destructor for ScramWorker.
     */
    virtual ~ScramWorker() {};

    /**
     * @brief Executes the main logic of the worker.
     *
     * This method contains the synchronous execution logic based on
     * the provided command-line arguments.
     */
    void Execute();

  private:
    /**
     * @brief Stores the command-line arguments.
     */
    std::vector<std::string> args;
};
