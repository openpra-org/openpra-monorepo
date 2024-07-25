#pragma once
#include <napi.h>
#include <string>
#include <vector>

class ScramWorker : public Napi::AsyncWorker {
  public:
    ScramWorker(Napi::Function& callback, std::vector<std::string> args);
    virtual ~ScramWorker() {};

    void Execute();
    void OnOK();

  private:
    std::vector<std::string> args;
};
