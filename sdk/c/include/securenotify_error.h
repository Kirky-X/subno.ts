/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright (c) 2026 KirkyX. All rights reserved. */

/**
 * @file securenotify_error.h
 * @brief Error handling definitions for SecureNotify C SDK
 *
 * This header defines error codes and error handling utilities for the
 * SecureNotify C SDK. All error functions use the securenotify_error_t
 * opaque type to carry detailed error information.
 */

#ifndef SECURENOTIFY_ERROR_H
#define SECURENOTIFY_ERROR_H

#include <stdint.h>
#include "securenotify_types.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @defgroup error Error Codes and Handling
 * @brief Error codes and utilities for error handling
 * @{
 */

/**
 * @brief Error codes for SecureNotify operations
 *
 * Error codes are organized into categories:
 * - 0: Success (SECURENOTIFY_OK)
 * - 1xxx: API errors (request-level errors)
 * - 2xxx: Network errors
 * - 9xxx: Unknown/internal errors
 */
typedef enum securenotify_error_code {
    /** Operation completed successfully */
    SECURENOTIFY_OK = 0,

    /* API Errors (1000-1999) */

    /** General API error (check error message for details) */
    SECURENOTIFY_ERROR_API = 1000,
    /** Authentication failed - invalid or missing API key */
    SECURENOTIFY_ERROR_AUTH_FAILED = 1001,
    /** Rate limit exceeded - too many requests */
    SECURENOTIFY_ERROR_RATE_LIMIT = 1002,
    /** Resource not found */
    SECURENOTIFY_ERROR_NOT_FOUND = 1004,
    /** Validation error - invalid request parameters */
    SECURENOTIFY_ERROR_VALIDATION = 1400,
    /** Internal server error */
    SECURENOTIFY_ERROR_INTERNAL = 1500,

    /* Network Errors (2000-2999) */

    /** Network connectivity error */
    SECURENOTIFY_ERROR_NETWORK = 2000,
    /** Request timeout */
    SECURENOTIFY_ERROR_TIMEOUT = 2001,
    /** Connection refused or failed */
    SECURENOTIFY_ERROR_CONNECTION = 2002,
    /** TLS/SSL error */
    SECURENOTIFY_ERROR_TLS = 2003,
    /** DNS resolution failed */
    SECURENOTIFY_ERROR_DNS = 2004,

    /* Unknown Errors (9000-9999) */

    /** Unknown error occurred */
    SECURENOTIFY_ERROR_UNKNOWN = 9999,
} securenotify_error_code_t;

/**
 * @brief Error structure for carrying detailed error information
 *
 * This structure is created using securenotify_error_new() and must be
 * freed using securenotify_error_free() after use.
 */
struct securenotify_error {
    /** Error code indicating the type of error */
    securenotify_error_code_t code;
    /** Error message (may be NULL for SECURENOTIFY_OK) */
    char* message;
    /** HTTP status code if applicable (0 for network errors) */
    int32_t http_status;
};

/**
 * @brief Create a new error structure
 *
 * @return Pointer to a new error structure, or NULL on allocation failure
 *
 * The returned error structure must be freed using securenotify_error_free().
 * Initially, the error will have code SECURENOTIFY_OK and NULL message.
 */
securenotify_error_t* securenotify_error_new(void);

/**
 * @brief Free an error structure
 *
 * @param error Pointer to error structure to free (can be NULL)
 *
 * This function safely handles NULL pointers and frees all allocated
 * memory within the error structure.
 */
void securenotify_error_free(securenotify_error_t* error);

/**
 * @brief Set error information
 *
 * @param error Pointer to error structure
 * @param code Error code
 * @param message Error message (copied, caller retains ownership)
 * @param http_status HTTP status code (0 if not applicable)
 *
 * This function copies the message string, so the caller may free the
 * original message after this call.
 */
void securenotify_error_set(
    securenotify_error_t* error,
    securenotify_error_code_t code,
    const char* message,
    int32_t http_status
);

/**
 * @brief Get error message
 *
 * @param error Pointer to error structure
 * @return Error message string (empty string if no message)
 *
 * The returned pointer remains valid until the error structure is modified
 * or freed.
 */
const char* securenotify_error_message(const securenotify_error_t* error);

/**
 * @brief Get error code
 *
 * @param error Pointer to error structure
 * @return Error code
 */
securenotify_error_code_t securenotify_error_code(const securenotify_error_t* error);

/**
 * @brief Get HTTP status code
 *
 * @param error Pointer to error structure
 * @return HTTP status code (0 if not applicable)
 */
int32_t securenotify_error_http_status(const securenotify_error_t* error);

/**
 * @brief Check if error indicates success
 *
 * @param error Pointer to error structure
 * @return true if error code is SECURENOTIFY_OK, false otherwise
 */
bool securenotify_error_is_ok(const securenotify_error_t* error);

/**
 * @brief Check if error is a network error
 *
 * @param error Pointer to error structure
 * @return true if error is a network-related error
 */
bool securenotify_error_is_network_error(const securenotify_error_t* error);

/**
 * @brief Get human-readable string for error code
 *
 * @param code Error code
 * @return Static string describing the error code
 */
const char* securenotify_error_code_to_string(securenotify_error_code_t code);

/** @} */ // end of error

#ifdef __cplusplus
}
#endif

#endif /* SECURENOTIFY_ERROR_H */
