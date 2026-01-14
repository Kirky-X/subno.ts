/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright (c) 2026 KirkyX. All rights reserved. */

/**
 * @file test_client.c
 * @brief Unit tests for SecureNotify C SDK client functionality
 *
 * This file contains unit tests for:
 * - Error handling
 * - Client lifecycle
 * - Public key management
 * - Channel management
 * - Message publishing
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "securenotify.h"

/* Test counter */
static int tests_run = 0;
static int tests_passed = 0;

/* Test macros */
#define TEST(name) do { \
    tests_run++; \
    printf("  [TEST] %s... ", name); \
} while(0)

#define TEST_PASS() do { \
    tests_passed++; \
    printf("PASSED\n"); \
} while(0)

#define TEST_FAIL(msg) do { \
    printf("FAILED: %s\n", msg); \
} while(0)

#define ASSERT(cond, msg) do { \
    if (!(cond)) { \
        TEST_FAIL(msg); \
        return; \
    } \
} while(0)

/* Test error handling */
static void test_error_handling(void) {
    printf("\n--- Error Handling Tests ---\n");

    TEST("error_new");
    securenotify_error_t* error = securenotify_error_new();
    ASSERT(error != NULL, "Failed to create error");
    ASSERT(securenotify_error_code(error) == SECURENOTIFY_OK, "Initial code should be OK");
    ASSERT(strcmp(securenotify_error_message(error), "") == 0, "Initial message should be empty");
    TEST_PASS();

    TEST("error_set");
    securenotify_error_set(error, SECURENOTIFY_ERROR_API, "Test error message", 400);
    ASSERT(securenotify_error_code(error) == SECURENOTIFY_ERROR_API, "Error code should be set");
    ASSERT(strcmp(securenotify_error_message(error), "Test error message") == 0, "Error message should match");
    ASSERT(securenotify_error_http_status(error) == 400, "HTTP status should be set");
    TEST_PASS();

    TEST("error_is_ok");
    ASSERT(!securenotify_error_is_ok(error), "Error should not be OK");
    securenotify_error_set(error, SECURENOTIFY_OK, NULL, 0);
    ASSERT(securenotify_error_is_ok(error), "Error should be OK now");
    TEST_PASS();

    TEST("error_is_network_error");
    securenotify_error_set(error, SECURENOTIFY_ERROR_NETWORK, "Network error", 0);
    ASSERT(securenotify_error_is_network_error(error), "Should be network error");
    securenotify_error_set(error, SECURENOTIFY_ERROR_API, "API error", 500);
    ASSERT(!securenotify_error_is_network_error(error), "Should not be network error");
    TEST_PASS();

    TEST("error_code_to_string");
    ASSERT(strcmp(securenotify_error_code_to_string(SECURENOTIFY_OK), "Success") == 0, "OK string");
    ASSERT(strcmp(securenotify_error_code_to_string(SECURENOTIFY_ERROR_NETWORK), "Network error") == 0, "Network string");
    ASSERT(strcmp(securenotify_error_code_to_string(SECURENOTIFY_ERROR_AUTH_FAILED), "Authentication failed") == 0, "Auth string");
    TEST_PASS();

    securenotify_error_free(error);
}

/* Test client lifecycle */
static void test_client_lifecycle(void) {
    printf("\n--- Client Lifecycle Tests ---\n");

    securenotify_error_t* error = securenotify_error_new();
    ASSERT(error != NULL, "Failed to create error");
    (void)error;

    TEST("client_new");
    securenotify_client_t* client = securenotify_client_new(
        "https://api.example.com",
        "test-api-key",
        error
    );
    ASSERT(client != NULL, "Failed to create client");
    TEST_PASS();

    TEST("client_get_base_url");
    securenotify_string_t* url = securenotify_client_get_base_url(client, error);
    ASSERT(url != NULL, "Failed to get base URL");
    ASSERT(strcmp(url->data, "https://api.example.com") == 0, "URL mismatch");
    securenotify_string_free(url);
    TEST_PASS();

    TEST("client_get_state");
    securenotify_connection_state_t state = securenotify_client_get_state(client);
    ASSERT(state == SECURENOTIFY_DISCONNECTED, "State should be disconnected");
    TEST_PASS();

    TEST("client_free");
    securenotify_client_free(client);
    TEST_PASS();

    securenotify_error_free(error);
}

/* Test memory cleanup functions */
static void test_memory_cleanup(void) {
    printf("\n--- Memory Cleanup Tests ---\n");

    TEST("public_key_free_null");
    securenotify_public_key_free(NULL);
    TEST_PASS();

    TEST("channel_free_null");
    securenotify_channel_free(NULL);
    TEST_PASS();

    TEST("message_result_free_null");
    securenotify_message_result_free(NULL);
    TEST_PASS();

    TEST("api_key_free_null");
    securenotify_api_key_free(NULL);
    TEST_PASS();

    TEST("string_free_null");
    securenotify_string_free(NULL);
    TEST_PASS();

    TEST("subscription_free_null");
    securenotify_subscription_free(NULL);
    TEST_PASS();

    TEST("error_free_null");
    securenotify_error_free(NULL);
    TEST_PASS();

    TEST("public_key_list_free_null");
    securenotify_public_key_list_free(NULL);
    TEST_PASS();

    TEST("channel_list_free_null");
    securenotify_channel_list_free(NULL);
    TEST_PASS();

    TEST("message_list_free_null");
    securenotify_message_list_free(NULL);
    TEST_PASS();

    TEST("api_key_list_free_null");
    securenotify_api_key_list_free(NULL);
    TEST_PASS();
}

/* Test version info */
static void test_version(void) {
    printf("\n--- Version Tests ---\n");

    TEST("version");
    const char* version = securenotify_version();
    ASSERT(version != NULL, "Version should not be NULL");
    ASSERT(strlen(version) > 0, "Version should not be empty");
    printf("(v%s) ", version);
    TEST_PASS();

    TEST("build_info");
    const char* build_info = securenotify_build_info();
    ASSERT(build_info != NULL, "Build info should not be NULL");
    ASSERT(strlen(build_info) > 0, "Build info should not be empty");
    TEST_PASS();
}

/* Test priority constants */
static void test_priorities(void) {
    printf("\n--- Priority Tests ---\n");

    TEST("priority_values");
    ASSERT(SECURENOTIFY_PRIORITY_CRITICAL == 100, "CRITICAL should be 100");
    ASSERT(SECURENOTIFY_PRIORITY_HIGH == 75, "HIGH should be 75");
    ASSERT(SECURENOTIFY_PRIORITY_NORMAL == 50, "NORMAL should be 50");
    ASSERT(SECURENOTIFY_PRIORITY_LOW == 25, "LOW should be 25");
    ASSERT(SECURENOTIFY_PRIORITY_BULK == 0, "BULK should be 0");
    TEST_PASS();

    TEST("channel_type_values");
    ASSERT(SECURENOTIFY_CHANNEL_PUBLIC == 0, "PUBLIC should be 0");
    ASSERT(SECURENOTIFY_CHANNEL_ENCRYPTED == 1, "ENCRYPTED should be 1");
    ASSERT(SECURENOTIFY_CHANNEL_TEMPORARY == 2, "TEMPORARY should be 2");
    TEST_PASS();

    TEST("subscription_status_values");
    ASSERT(SECURENOTIFY_SUBSCRIPTION_INACTIVE == 0, "INACTIVE should be 0");
    ASSERT(SECURENOTIFY_SUBSCRIPTION_CONNECTING == 1, "CONNECTING should be 1");
    ASSERT(SECURENOTIFY_SUBSCRIPTION_ACTIVE == 2, "ACTIVE should be 2");
    ASSERT(SECURENOTIFY_SUBSCRIPTION_RECONNECTING == 3, "RECONNECTING should be 3");
    TEST_PASS();

    TEST("connection_state_values");
    ASSERT(SECURENOTIFY_DISCONNECTED == 0, "DISCONNECTED should be 0");
    ASSERT(SECURENOTIFY_CONNECTING == 1, "CONNECTING should be 1");
    ASSERT(SECURENOTIFY_CONNECTED == 2, "CONNECTED should be 2");
    ASSERT(SECURENOTIFY_RECONNECTING == 3, "RECONNECTING should be 3");
    TEST_PASS();
}

/* Test error code constants */
static void test_error_codes(void) {
    printf("\n--- Error Code Tests ---\n");

    TEST("error_code_values");
    ASSERT(SECURENOTIFY_OK == 0, "OK should be 0");
    ASSERT(SECURENOTIFY_ERROR_API == 1000, "API should be 1000");
    ASSERT(SECURENOTIFY_ERROR_AUTH_FAILED == 1001, "AUTH_FAILED should be 1001");
    ASSERT(SECURENOTIFY_ERROR_RATE_LIMIT == 1002, "RATE_LIMIT should be 1002");
    ASSERT(SECURENOTIFY_ERROR_NOT_FOUND == 1004, "NOT_FOUND should be 1004");
    ASSERT(SECURENOTIFY_ERROR_VALIDATION == 1400, "VALIDATION should be 1400");
    ASSERT(SECURENOTIFY_ERROR_INTERNAL == 1500, "INTERNAL should be 1500");
    ASSERT(SECURENOTIFY_ERROR_NETWORK == 2000, "NETWORK should be 2000");
    ASSERT(SECURENOTIFY_ERROR_TIMEOUT == 2001, "TIMEOUT should be 2001");
    ASSERT(SECURENOTIFY_ERROR_CONNECTION == 2002, "CONNECTION should be 2002");
    ASSERT(SECURENOTIFY_ERROR_UNKNOWN == 9999, "UNKNOWN should be 9999");
    TEST_PASS();
}

int main(void) {
    printf("==============================================\n");
    printf("SecureNotify C SDK - Client Tests\n");
    printf("==============================================\n");

    /* Run all tests */
    test_error_codes();
    test_error_handling();
    test_priorities();
    test_version();
    test_memory_cleanup();
    test_client_lifecycle();

    /* Print summary */
    printf("\n==============================================\n");
    printf("Test Results: %d/%d passed\n", tests_passed, tests_run);
    printf("==============================================\n");

    return (tests_passed == tests_run) ? 0 : 1;
}
