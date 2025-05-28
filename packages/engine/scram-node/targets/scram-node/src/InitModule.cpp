#include "AsyncRunScramCli.h"
#include "RunScramCli.h"
#include "QuantifyFaultTree.h"

#include <napi.h>

/**
 * @brief Initializes the module, making the RunScramCli function available to Node.js.
 *
 * @param env The Napi environment.
 * @param exports The exports object to add the function to.
 * @return Napi::Object The modified exports object.
 */
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("AsyncRunScramCli", Napi::Function::New(env, AsyncRunScramCli));
    exports.Set("RunScramCli", Napi::Function::New(env, RunScramCli));
    exports.Set("QuantifyFaultTree", Napi::Function::New(env, QuantifyFaultTree));
    return exports;
}

// Macro to register the module with Node.js
NODE_API_MODULE(scram_node, Init)
