#include "ScramWorker.h"

// Main Node.js wrapper function to run the scram CLI asynchronously.
Napi::Value RunScramCli(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // Validate the first argument to ensure it's an object.
  if (!info[0].IsObject()) {
    Napi::TypeError::New(env, "Object expected").ThrowAsJavaScriptException();
    return env.Null();
  }

  // Extract arguments from the input object to pass to the scram command.
  Napi::Object input = info[0].As<Napi::Object>();
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

  // Validate the second argument to ensure it's a callback function.
  if (!info[1].IsFunction()) {
    Napi::TypeError::New(env, "Function expected as second argument").ThrowAsJavaScriptException();
    return env.Null();
  }
  Napi::Function callback = info[1].As<Napi::Function>();

  // Create a ScramWorker to run the scram command asynchronously and queue it for execution.
  ScramWorker* worker = new ScramWorker(callback, arguments);
  worker->Queue();

  return env.Undefined();
}

// Initializes the module, making the RunScramCli function available to Node.js
Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("RunScramCli", Napi::Function::New(env, RunScramCli));
  return exports;
}

// Macro to register the module with Node.js
NODE_API_MODULE(scram_node, Init)
