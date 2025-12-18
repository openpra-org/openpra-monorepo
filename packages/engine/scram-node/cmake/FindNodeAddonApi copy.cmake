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
        message(WARNING "Failed to run 'cmake-js print-cmakejs-include'. Node.js include paths not set.")
    endif()
endif()