#pragma once
#include <napi.h>
#include <string>
#include <vector>

/**
 * @class AsyncScramWorker
 * @brief Defines a class for asynchronous execution of SCRAM engine.
 *
 * This class inherits from Napi::AsyncWorker to perform tasks in a separate thread
 * and notify upon completion. It's designed to execute SCRAM-related operations
 * asynchronously in a Node.js environment.
 */
class AsyncScramWorker : public Napi::AsyncWorker {
public:
    /**
     * @brief Constructor for ScramWorker.
     * @param callback A Napi::Function reference for asynchronous callback.
     * @param args A vector of command-line arguments for the SCRAM engine.
     */
    explicit AsyncScramWorker(Napi::Function &callback, std::vector<std::string> args);

    /**
     * @brief Virtual destructor for ScramWorker.
     */
    ~AsyncScramWorker() override= default;

    /**
     * @brief Executes the main logic of the worker.
     *
     * This method contains the task to be performed in the background thread.
     * It's called automatically by the Node.js event loop.
     */
    void Execute() override;

    /**
     * @brief Callback method called upon successful execution.
     *
     * This method is invoked when the Execute method completes successfully.
     * It's responsible for handling the results and invoking the JavaScript callback.
     */
    void OnOK() override;

private:
    /**
     * @brief Stores the command-line arguments for the SCRAM engine.
     */
    std::vector<std::string> args;
};
