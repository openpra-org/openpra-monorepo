if(NOT CMAKE_JS_INC)
    # Include Node-API wrappers
    execute_process(COMMAND node_modules/.bin/cmake-js "print-cmakejs-include"
            WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
            RESULT_VARIABLE result
            OUTPUT_VARIABLE CMAKE_JS_INC
            OUTPUT_STRIP_TRAILING_WHITESPACE
    )

    # Check if the command was successful
    if(result EQUAL 0)
        message(STATUS "Node.js include paths set to: ${CMAKE_JS_INC}")
    else()
        # Command failed
        message(WARNING "Failed to run 'cmake-js print-cmakejs-include'. CMAKE_JS_INC not set.")
    endif()
endif()

if(NOT CMAKE_JS_LIB)
    # Include Node-API wrappers
    execute_process(COMMAND node_modules/.bin/cmake-js "print-cmakejs-lib"
            WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
            RESULT_VARIABLE result
            OUTPUT_VARIABLE CMAKE_JS_LIB
            OUTPUT_STRIP_TRAILING_WHITESPACE
    )

    # Check if the command was successful
    if(result EQUAL 0)
        message(STATUS "Node.js lib paths set to: ${CMAKE_JS_LIB}")
    else()
        # Command failed
        message(WARNING "Failed to run 'cmake-js print-cmakejs-lib'. CMAKE_JS_LIB not set.")
    endif()
endif()

if(NOT CMAKE_JS_SRC)
    # Include Node-API wrappers
    execute_process(COMMAND node_modules/.bin/cmake-js "print-cmakejs-src"
            WORKING_DIRECTORY ${CMAKE_SOURCE_DIR}
            RESULT_VARIABLE result
            OUTPUT_VARIABLE CMAKE_JS_SRC
            OUTPUT_STRIP_TRAILING_WHITESPACE
    )

    # Check if the command was successful
    if(result EQUAL 0)
        message(STATUS "Node.js src paths set to: ${CMAKE_JS_SRC}")
    else()
        # Command failed
        message(WARNING "Failed to run 'cmake-js print-cmakejs-src'. CMAKE_JS_SRC not set.")
    endif()
endif()
