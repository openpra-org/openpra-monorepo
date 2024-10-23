#pragma once

#include <napi.h>
#include "ScramWorker.h"

/**
 * @brief Main Node.js wrapper function to run the SCRAM CLI synchronously.
 *
 * @param info The callback info from Node.js, containing the input arguments.
 * @return Napi::Value Returns undefined on success, or throws a JavaScript exception on error.
 */
inline Napi::Value RunScramCli(const Napi::CallbackInfo &info) {
    Napi::Env env = info.Env();

    // Validate the first argument to ensure it's an object.
    if (!info[0].IsObject()) {
        Napi::TypeError::New(env, "Object expected").ThrowAsJavaScriptException();
        return env.Null();
    }

    // Extract arguments from the input object to pass to the scram command.
    auto input = info[0].As<Napi::Object>();
    std::vector<std::string> arguments;

    // Convert properties of the input object to command-line arguments.
    Napi::Array propertyNames = input.GetPropertyNames();
    Napi::Array xmlArray;
    for (uint32_t i = 0; i < propertyNames.Length(); i++) {
        Napi::Value key = propertyNames.Get(i);
        Napi::Value value = input.Get(key.ToString());
        std::string keyStr = key.ToString().Utf8Value();
        if (keyStr == "models") {
            xmlArray = value.As<Napi::Array>();
        } else {
            arguments.push_back("--" + keyStr);
            if (!value.IsBoolean()) {
                arguments.push_back(value.ToString().Utf8Value());
            }
        }
    };

    // Add XML model files at the end of the arguments.
    for (size_t j = 0; j < xmlArray.Length(); j++) {
        arguments.push_back(xmlArray.Get(j).ToString().Utf8Value());
    };

    try {
        // Create a ScramWorker to execute the command synchronously.
        ScramWorker worker(arguments);
        worker.Execute();
        return env.Undefined();
    } catch (const std::exception &e) {
        // If an exception occurs, throw a JavaScript exception with the error message.
        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();
        return env.Null();
    }
}
