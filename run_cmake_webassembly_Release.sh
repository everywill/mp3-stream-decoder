#!/bin/bash

SHELL_FOLDER=$(dirname $(readlink -f "$0"))
echo SHELL_FOLDER=$SHELL_FOLDER

SOURCE_DIR_PATH=${SHELL_FOLDER}

CMAKE_BUILD_TYPE=Release

CMAKE_BUILD_DIR_NAME=webassembly_${CMAKE_BUILD_TYPE}

CMAKE_BUILD_DIR_PATH=${SHELL_FOLDER}/build/${CMAKE_BUILD_DIR_NAME}

CMAKE_DEBUG_OUTPUT=${SHELL_FOLDER}/bin/${CMAKE_BUILD_DIR_NAME}

emcmake cmake -S "${SOURCE_DIR_PATH}" \
    -B "${CMAKE_BUILD_DIR_PATH}" \
    -DCMAKE_BUILD_TYPE="${CMAKE_BUILD_TYPE}" \
    -DCMAKE_RUNTIME_OUTPUT_DIRECTORY_RELEASE="${CMAKE_DEBUG_OUTPUT}"