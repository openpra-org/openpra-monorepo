#include <napi.h>

#include "ScramNodeQuantify.h"
#include "ScramNodeModel.h"

/**
 * @brief Initializes the module, making the SCRAM functions available to Node.js.
 *
 * @param env The Napi environment.
 * @param exports The exports object to add the function to.
 * @return Napi::Object The modified exports object.
 */
Napi::Object Init(Napi::Env env, Napi::Object exports) {
    exports.Set("QuantifyModel", Napi::Function::New(env, QuantifyModel));
    exports.Set("BuildModelOnly", Napi::Function::New(env, BuildModelOnly));
    return exports;
}

// Macro to register the module with Node.js
NODE_API_MODULE(scram_node, Init)
