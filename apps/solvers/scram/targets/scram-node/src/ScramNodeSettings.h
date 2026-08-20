#pragma once
#include <napi.h>
#include "settings.h"

// Mapping helpers for Settings
scram::core::Settings ScramNodeOptions(const Napi::Object& nodeOptions);
