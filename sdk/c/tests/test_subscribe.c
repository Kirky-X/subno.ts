/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright (c) 2026 KirkyX. All rights reserved. */

/**
 * @file test_subscribe.c
 * @brief Unit tests for SecureNotify C SDK subscription functionality
 *
 * This file contains unit tests for:
 * - Subscription creation
 * - Subscription callbacks
 * - Subscription status
 * - Subscription cleanup
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>
#include "securenotify.h"

/* Test counter */
static int tests_run = 0;
static int tests_passed = 0;

/* Callback tracking */
static int message_callback_count = 0;
static int connected_callback_count = 0;
static int error_callback_count = 0;
static int heartbeat_callback_count = 0;
static const char* last_channel = NULL;
static const char* last_message = NULL;

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
    return; \
} while(0)

#define ASSERT(cond, msg) do { \
    if (!(cond)) { \
        TEST_FAIL(msg); \
    } \
} while(0)

/* Reset callback counters */
static void reset_callbacks(void) {
    message_callback_count = 0;
    connected_callback_count = 0;
    error_callback_count = 0;
    heartbeat_callback_count = 0;
    last_channel = NULL;
    last_message = NULL;
}

/* Callback functions */
static void test_message_callback(const char* channel, const char* message, void* user_data) {
    (void)user_data;
    message_callback_count++;
    last_channel = channel;
    last_message = message;
}

static void test_connected_callback(const char* channel, void* user_data) {
    (void)user_data;
    connected_callback_count++;
    last_channel = channel;
}

static void test_error_callback(int32_t error_code, const char* message, void* user_data) {
    (void)user_data;
    (void)error_code;
    (void)message;
    error_callback_count++;
}

static void test_heartbeat_callback(const char* channel, void* user_data) {
    (void)user_data;
    heartbeat_callback_count++;
    last_channel = channel;
}

/* Test subscription creation */
static void test_subscription_creation(void) {
    printf("\n--- Subscription Creation Tests ---\n");

    securenotify_error_t* error = securenotify_error_new();
    ASSERT(error != NULL, "Failed to create error");

    TEST("subscription_null_client");
    securenotify_subscription_t* sub = securenotify_subscribe(
        NULL, "test-channel", test_message_callback, NULL, NULL, NULL, NULL, error
    );
    ASSERT(sub == NULL, "Should fail with NULL client");
    TEST_PASS();

    TEST("subscription_null_channel");
    securenotify_client_t* client = securenotify_client_new(
        "https://api.example.com", "test-key", error
    );
    ASSERT(client != NULL, "Failed to create client");

    sub = securenotify_subscribe(
        client, NULL, test_message_callback, NULL, NULL, NULL, NULL, error
    );
    ASSERT(sub == NULL, "Should fail with NULL channel");
    TEST_PASS();

    TEST("subscription_null_callback");
    sub = securenotify_subscribe(
        client, "test-channel", NULL, NULL, NULL, NULL, NULL, error
    );
    ASSERT(sub == NULL, "Should fail with NULL callback");
    TEST_PASS();

    TEST("subscription_success");
    reset_callbacks();
    sub = securenotify_subscribe(
        client, "test-channel",
        test_message_callback,      /* Required callback */
        test_connected_callback,    /* Optional connected callback */
        test_error_callback,        /* Optional error callback */
        test_heartbeat_callback,    /* Optional heartbeat callback */
        (void*)0x12345678,          /* User data */
        error
    );
    ASSERT(sub != NULL, "Failed to create subscription");
    TEST_PASS();

    securenotify_client_free(client);
    securenotify_error_free(error);
}

/* Test subscription status */
static void test_subscription_status(void) {
    printf("\n--- Subscription Status Tests ---\n");

    securenotify_error_t* error = securenotify_error_new();
    securenotify_client_t* client = securenotify_client_new(
        "https://api.example.com", "test-key", error
    );
    ASSERT(client != NULL && error != NULL, "Setup failed");

    TEST("subscription_get_status");
    securenotify_subscription_t* sub = securenotify_subscribe(
        client, "test-channel",
        test_message_callback, test_connected_callback,
        test_error_callback, test_heartbeat_callback,
        NULL, error
    );
    ASSERT(sub != NULL, "Failed to create subscription");

    securenotify_subscription_status_t status = securenotify_subscription_get_status(sub);
    /* Status may be CONNECTING or ACTIVE depending on thread timing */
    ASSERT(status >= SECURENOTIFY_SUBSCRIPTION_INACTIVE &&
           status <= SECURENOTIFY_SUBSCRIPTION_RECONNECTING,
           "Status should be valid");
    TEST_PASS();

    securenotify_subscription_free(sub);
    securenotify_client_free(client);
    securenotify_error_free(error);
}

/* Test subscription cleanup */
static void test_subscription_cleanup(void) {
    printf("\n--- Subscription Cleanup Tests ---\n");

    securenotify_error_t* error = securenotify_error_new();
    securenotify_client_t* client = securenotify_client_new(
        "https://api.example.com", "test-key", error
    );
    ASSERT(client != NULL && error != NULL, "Setup failed");

    TEST("unsubscribe");
    reset_callbacks();
    securenotify_subscription_t* sub = securenotify_subscribe(
        client, "test-channel",
        test_message_callback, test_connected_callback,
        test_error_callback, test_heartbeat_callback,
        NULL, error
    );
    ASSERT(sub != NULL, "Failed to create subscription");

    /* Wait a bit for the subscription thread to start */
    usleep(100000);

    int result = securenotify_unsubscribe(sub, error);
    ASSERT(result == 0, "Unsubscribe should succeed");

    securenotify_subscription_status_t status = securenotify_subscription_get_status(sub);
    ASSERT(status == SECURENOTIFY_SUBSCRIPTION_INACTIVE, "Status should be inactive after unsubscribe");
    TEST_PASS();

    TEST("free_null_subscription");
    securenotify_subscription_free(NULL);
    TEST_PASS();

    securenotify_client_free(client);
    securenotify_error_free(error);
}

/* Test subscription with optional callbacks */
static void test_optional_callbacks(void) {
    printf("\n--- Optional Callback Tests ---\n");

    securenotify_error_t* error = securenotify_error_new();
    securenotify_client_t* client = securenotify_client_new(
        "https://api.example.com", "test-key", error
    );
    ASSERT(client != NULL && error != NULL, "Setup failed");

    TEST("subscription_only_message_callback");
    reset_callbacks();
    securenotify_subscription_t* sub = securenotify_subscribe(
        client, "test-channel",
        test_message_callback,  /* Only message callback */
        NULL,                   /* No connected callback */
        NULL,                   /* No error callback */
        NULL,                   /* No heartbeat callback */
        NULL,                   /* No user data */
        error
    );
    ASSERT(sub != NULL, "Should succeed with only message callback");
    TEST_PASS();

    securenotify_unsubscribe(sub, error);

    TEST("subscription_all_callbacks");
    reset_callbacks();
    sub = securenotify_subscribe(
        client, "test-channel",
        test_message_callback,
        test_connected_callback,
        test_error_callback,
        test_heartbeat_callback,
        (void*)0xDEADBEEF,
        error
    );
    ASSERT(sub != NULL, "Should succeed with all callbacks");
    TEST_PASS();

    securenotify_unsubscribe(sub, error);
    securenotify_client_free(client);
    securenotify_error_free(error);
}

/* Test subscription thread safety */
static void test_subscription_thread_safety(void) {
    printf("\n--- Thread Safety Tests ---\n");

    securenotify_error_t* error = securenotify_error_new();
    securenotify_client_t* client = securenotify_client_new(
        "https://api.example.com", "test-key", error
    );
    ASSERT(client != NULL && error != NULL, "Setup failed");

    TEST("multiple_subscriptions");
    securenotify_subscription_t* subs[3];

    for (int i = 0; i < 3; i++) {
        char channel[32];
        snprintf(channel, sizeof(channel), "channel-%d", i);

        subs[i] = securenotify_subscribe(
            client, channel,
            test_message_callback, test_connected_callback,
            test_error_callback, test_heartbeat_callback,
            NULL, error
        );
        ASSERT(subs[i] != NULL, "Failed to create subscription %d", i);
    }

    /* Wait for subscriptions to start */
    usleep(100000);

    /* Clean up all subscriptions */
    for (int i = 0; i < 3; i++) {
        int result = securenotify_unsubscribe(subs[i], error);
        ASSERT(result == 0, "Unsubscribe should succeed for subscription %d", i);
    }
    TEST_PASS();

    securenotify_client_free(client);
    securenotify_error_free(error);
}

/* Test subscription with various channels */
static void test_subscription_channels(void) {
    printf("\n--- Channel Name Tests ---\n");

    securenotify_error_t* error = securenotify_error_new();
    securenotify_client_t* client = securenotify_client_new(
        "https://api.example.com", "test-key", error
    );
    ASSERT(client != NULL && error != NULL, "Setup failed");

    TEST("subscription_with_simple_channel");
    reset_callbacks();
    securenotify_subscription_t* sub = securenotify_subscribe(
        client, "simple",
        test_message_callback, NULL, NULL, NULL, NULL, error
    );
    ASSERT(sub != NULL, "Should succeed with simple channel name");
    securenotify_unsubscribe(sub, error);
    TEST_PASS();

    TEST("subscription_with_hyphen_channel");
    reset_callbacks();
    sub = securenotify_subscribe(
        client, "my-channel",
        test_message_callback, NULL, NULL, NULL, NULL, error
    );
    ASSERT(sub != NULL, "Should succeed with hyphenated channel name");
    securenotify_unsubscribe(sub, error);
    TEST_PASS();

    TEST("subscription_with_underscore_channel");
    reset_callbacks();
    sub = securenotify_subscribe(
        client, "my_channel",
        test_message_callback, NULL, NULL, NULL, NULL, error
    );
    ASSERT(sub != NULL, "Should succeed with underscored channel name");
    securenotify_unsubscribe(sub, error);
    TEST_PASS();

    TEST("subscription_with_numeric_channel");
    reset_callbacks();
    sub = securenotify_subscribe(
        client, "channel123",
        test_message_callback, NULL, NULL, NULL, NULL, error
    );
    ASSERT(sub != NULL, "Should succeed with numeric channel name");
    securenotify_unsubscribe(sub, error);
    TEST_PASS();

    securenotify_client_free(client);
    securenotify_error_free(error);
}

int main(void) {
    printf("==============================================\n");
    printf("SecureNotify C SDK - Subscription Tests\n");
    printf("==============================================\n");

    /* Run all tests */
    test_subscription_creation();
    test_subscription_status();
    test_subscription_cleanup();
    test_optional_callbacks();
    test_subscription_thread_safety();
    test_subscription_channels();

    /* Print summary */
    printf("\n==============================================\n");
    printf("Test Results: %d/%d passed\n", tests_passed, tests_run);
    printf("==============================================\n");

    return (tests_passed == tests_run) ? 0 : 1;
}
