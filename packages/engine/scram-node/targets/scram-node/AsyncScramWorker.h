// Defines a class ScramWorker that inherits from Napi::AsyncWorker for asynchronous tasks.
// This class is designed to execute a task in a separate thread and notify upon completion.
class ScramWorker : public Napi::AsyncWorker {
  public:
    // Constructor that takes a callback function and a vector of arguments.
    ScramWorker(Napi::Function& callback, std::vector<std::string> args);
    // Virtual destructor.
    virtual ~ScramWorker() {};

    // The Execute method contains the task to be performed in the background.
    void Execute();
    // The OnOK method is called when the Execute method completes successfully.
    void OnOK();

  private:
    // Private member to store command-line arguments.
    std::vector<std::string> args;
};
