#pragma once
#include <napi.h>

// Forward declarations for SCRAM
namespace scram {
  namespace core { class Settings; }
}

// Mapping helpers
scram::core::Settings ScramNodeOptions(const Napi::Object& nodeOptions);

// The main Node Addon function
Napi::Value QuantifyFaultTree(const Napi::CallbackInfo& info);
