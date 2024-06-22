set(CMAKE_INCLUDE_CURRENT_DIR ON)

cmake_policy(SET CMP0091 NEW)
cmake_policy(SET CMP0042 NEW)

add_definitions(-DNAPI_VERSION=9)
set(CMAKE_EXPORT_COMPILE_COMMANDS 1)
find_package(NodeAddonApi)
include_directories(${CMAKE_JS_INC})

set(SCRAM_NODE_SRC SimpleAsyncWorker.cpp RunSimpleAsyncWorker.cpp)
set(SCRAM_NODE_HEADERS SimpleAsyncWorker.h)


add_library(scram-node SHARED ${SCRAM_NODE_SRC})
set_target_properties(scram-node PROPERTIES PREFIX "" SUFFIX ".node")
target_link_libraries(scram-node scram ${Boost_LIBRARIES})
target_include_directories(scram-node PRIVATE ${CMAKE_JS_INC})


if(MSVC AND CMAKE_JS_NODELIB_DEF AND CMAKE_JS_NODELIB_TARGET)
   execute_process(COMMAND ${CMAKE_AR} /def:${CMAKE_JS_NODELIB_DEF} /out:${CMAKE_JS_NODELIB_TARGET} ${CMAKE_STATIC_LINKER_FLAGS})
endif()
