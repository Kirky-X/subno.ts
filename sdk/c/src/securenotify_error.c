/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright (c) 2026 KirkyX. All rights reserved. */

/**
 * @file securenotify_error.c
 * @brief Error handling implementation for SecureNotify C SDK
 */

#include <stdlib.h>
#include <string.h>
#include "securenotify_error.h"

securenotify_error_t* securenotify_error_new(void) {
    securenotify_error_t* error = (securenotify_error_t*)malloc(sizeof(securenotify_error_t));
    if (error) {
        error->code = SECURENOTIFY_OK;
        error->message = NULL;
        error->http_status = 0;
    }
    return error;
}

void securenotify_error_free(securenotify_error_t* error) {
    if (error) {
        if (error->message) {
            free(error->message);
        }
        free(error);
    }
}

void securenotify_error_set(
    securenotify_error_t* error,
    securenotify_error_code_t code,
    const char* message,
    int32_t http_status
) {
    if (!error) {
        return;
    }

    error->code = code;
    error->http_status = http_status;

    if (error->message) {
        free(error->message);
        error->message = NULL;
    }

    if (message) {
        error->message = strdup(message);
    }
}

const char* securenotify_error_message(const securenotify_error_t* error) {
    if (!error || !error->message) {
        return "";
    }
    return error->message;
}

securenotify_error_code_t securenotify_error_code(const securenotify_error_t* error) {
    if (!error) {
        return SECURENOTIFY_ERROR_UNKNOWN;
    }
    return error->code;
}

int32_t securenotify_error_http_status(const securenotify_error_t* error) {
    if (!error) {
        return 0;
    }
    return error->http_status;
}

bool securenotify_error_is_ok(const securenotify_error_t* error) {
    return error && error->code == SECURENOTIFY_OK;
}

bool securenotify_error_is_network_error(const securenotify_error_t* error) {
    if (!error) {
        return false;
    }

    switch (error->code) {
        case SECURENOTIFY_ERROR_NETWORK:
        case SECURENOTIFY_ERROR_TIMEOUT:
        case SECURENOTIFY_ERROR_CONNECTION:
        case SECURENOTIFY_ERROR_TLS:
        case SECURENOTIFY_ERROR_DNS:
            return true;
        default:
            return false;
    }
}

const char* securenotify_error_code_to_string(securenotify_error_code_t code) {
    switch (code) {
        case SECURENOTIFY_OK:
            return "Success";

        case SECURENOTIFY_ERROR_API:
            return "API error";
        case SECURENOTIFY_ERROR_AUTH_FAILED:
            return "Authentication failed";
        case SECURENOTIFY_ERROR_RATE_LIMIT:
            return "Rate limit exceeded";
        case SECURENOTIFY_ERROR_NOT_FOUND:
            return "Resource not found";
        case SECURENOTIFY_ERROR_VALIDATION:
            return "Validation error";
        case SECURENOTIFY_ERROR_INTERNAL:
            return "Internal server error";

        case SECURENOTIFY_ERROR_NETWORK:
            return "Network error";
        case SECURENOTIFY_ERROR_TIMEOUT:
            return "Request timeout";
        case SECURENOTIFY_ERROR_CONNECTION:
            return "Connection error";
        case SECURENOTIFY_ERROR_TLS:
            return "TLS/SSL error";
        case SECURENOTIFY_ERROR_DNS:
            return "DNS resolution failed";

        case SECURENOTIFY_ERROR_UNKNOWN:
        default:
            return "Unknown error";
    }
}
