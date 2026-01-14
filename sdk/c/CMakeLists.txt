# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 KirkyX. All rights reserved.

cmake_minimum_required(VERSION 3.10)
project(securenotify-c VERSION 0.1.0 LANGUAGES C)

# Set C standard
set(CMAKE_C_STANDARD 99)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_C_EXTENSIONS OFF)

# Find required packages
find_package(CURL REQUIRED)
find_package(Threads REQUIRED)

# Set output directories
set(CMAKE_ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
set(CMAKE_LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib)
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin)

# Add include directory
include_directories(${CMAKE_CURRENT_SOURCE_DIR}/include)

# Source files
set(SOURCES
    src/securenotify.c
    src/securenotify_error.c
)

# Build static library
add_library(securenotify STATIC ${SOURCES})
target_include_directories(securenotify PUBLIC
    $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
    $<INSTALL_INTERFACE:include>
)
target_link_libraries(securenotify PUBLIC
    CURL::libcurl
    Threads::Threads
)

# Build shared library (optional)
if(BUILD_SHARED_LIBS)
    add_library(securenotify-shared SHARED ${SOURCES})
    target_include_directories(securenotify-shared PUBLIC
        $<BUILD_INTERFACE:${CMAKE_CURRENT_SOURCE_DIR}/include>
        $<INSTALL_INTERFACE:include>
    )
    target_link_libraries(securenotify-shared PUBLIC
        CURL::libcurl
        Threads::Threads
    )
    set_target_properties(securenotify-shared PROPERTIES
        OUTPUT_NAME securenotify
        VERSION ${PROJECT_VERSION}
        SOVERSION 1
    )
endif()

# Set output name for static library
set_target_properties(securenotify PROPERTIES
    OUTPUT_NAME securenotify
)

# Example: basic_usage
add_executable(basic_usage example/basic_usage.c)
target_link_libraries(basic_usage securenotify CURL::libcurl Threads::Threads)

# Example: subscribe_example
add_executable(subscribe_example example/subscribe_example.c)
target_link_libraries(subscribe_example securenotify CURL::libcurl Threads::Threads)

# Test: test_client
add_executable(test_client tests/test_client.c)
target_link_libraries(test_client securenotify CURL::libcurl Threads::Threads)

# Test: test_subscribe
add_executable(test_subscribe tests/test_subscribe.c)
target_link_libraries(test_subscribe securenotify CURL::libcurl Threads::Threads)

# Installation
include(GNUInstallDirs)

install(TARGETS securenotify
    ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
)

if(BUILD_SHARED_LIBS)
    install(TARGETS securenotify-shared
        ARCHIVE DESTINATION ${CMAKE_INSTALL_LIBDIR}
        LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
        RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
    )
endif()

install(DIRECTORY include/
    DESTINATION ${CMAKE_INSTALL_INCLUDEDIR}/securenotify
)

install(TARGETS basic_usage subscribe_example
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
)

# CTest
enable_testing()
add_test(NAME test_client COMMAND test_client)
add_test(NAME test_subscribe COMMAND test_subscribe)

# Print configuration
message(STATUS "")
message(STATUS "SecureNotify C SDK Configuration:")
message(STATUS "  Version:       ${PROJECT_VERSION}")
message(STATUS "  C Standard:    ${CMAKE_C_STANDARD}")
message(STATUS "  Build Type:    ${CMAKE_BUILD_TYPE}")
message(STATUS "  CURL Version:  ${CURL_VERSION}")
message(STATUS "  Install Prefix: ${CMAKE_INSTALL_PREFIX}")
message(STATUS "")
