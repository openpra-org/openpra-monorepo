cmake_policy(SET CMP0091 NEW)
cmake_policy(SET CMP0042 NEW)

add_definitions(-DNAPI_VERSION=7)
set(CMAKE_EXPORT_COMPILE_COMMANDS 1)

include_directories(${CMAKE_JS_INC})

set(SOURCE_FILES module.cpp)
set(CMAKE_JS_SRC)


add_library(scram-node SHARED ${SOURCE_FILES} ${CMAKE_JS_SRC})
set_target_properties(scram-node PROPERTIES PREFIX "" SUFFIX ".node")
target_link_libraries(scram-node ${CMAKE_JS_LIB})

if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
   execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})
endif()
