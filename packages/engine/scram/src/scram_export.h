#ifndef SCRAM_EXPORT_H_
#define SCRAM_EXPORT_H_

#if defined(_WIN32) || defined(__CYGWIN__)
  #ifdef SCRAM_BUILDING_DLL
    #define SCRAM_EXPORT __declspec(dllexport)
  #else
    #define SCRAM_EXPORT __declspec(dllimport)
  #endif
#else
  #define SCRAM_EXPORT
#endif

#endif // SCRAM_EXPORT_H_
