#pragma once
#include <napi.h>
#include <string>
#include <vector>

// Defines a class ScramWorker for synchronous execution.
class ScramWorker {
  public:
    // Constructor that takes a vector of arguments.
    ScramWorker(std::vector<std::string> args);
    // Virtual destructor.
    virtual ~ScramWorker() {};

    // Execute method that contains the logic to be executed synchronously.
    void Execute();
  private:
    // Private member to store command-line arguments.
    std::vector<std::string> args;
};
