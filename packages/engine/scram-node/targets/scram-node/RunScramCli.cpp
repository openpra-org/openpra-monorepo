#include "ScramWorker.h"

//The main` node wrapper function
Napi::Value RunScramCli(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  // Check if the first argument is an object
  if (!info[0].IsObject()) {
    Napi::TypeError::New(env, "Object expected").ThrowAsJavaScriptException();
    return env.Null();
  }

  Napi::Object input = info[0].As<Napi::Object>();
  std::vector<std::string> arguments;

  // Convert JSON object to vector of strings and use this vector of strings as command-line arguments
  //arguments.push_back("scram");
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

  for (size_t j = 0; j < xmlArray.Length(); j++) {
    arguments.push_back(xmlArray.Get(j).ToString().Utf8Value());
  };

  // Expect a callback function as the second argument
  if (!info[1].IsFunction()) {
    Napi::TypeError::New(env, "Function expected as second argument").ThrowAsJavaScriptException();
    return env.Null();
  }
  Napi::Function callback = info[1].As<Napi::Function>();

  // Create and queue the worker
  ScramWorker* worker = new ScramWorker(callback, arguments);
  worker->Queue();

  return env.Undefined();
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("RunScramCli", Napi::Function::New(env, RunScramCli));
  return exports;
}

NODE_API_MODULE(scram_node, Init)
