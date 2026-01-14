/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright (c) 2026 KirkyX. All rights reserved. */

/**
 * @file subscribe_example.c
 * @brief Real-time subscription example for SecureNotify C SDK
 *
 * This example demonstrates how to subscribe to a channel and receive
 * real-time messages using callbacks.
 *
 * To run this example:
 * 1. Start another terminal and publish a message to the channel
 * 2. Run this example to receive the message
 *
 * Example terminal 1:
 *   curl -X POST https://api.securenotify.dev/api/publish/test-channel \
 *     -H "Authorization: Bearer your-api-key" \
 *     -H "Content-Type: application/json" \
 *     -d '{"message":"Hello from curl!"}'
 *
 * Example terminal 2:
 *   ./subscribe_example
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <signal.h>
#include <unistd.h>
#include "securenotify.h"

/* Example configuration */
#define EXAMPLE_BASE_URL "https://api.securenotify.dev"
#define EXAMPLE_API_KEY "your-api-key-here"
#define EXAMPLE_CHANNEL "test-channel"

/* Global flag for graceful shutdown */
static volatile sig_atomic_t g_running = 1;

/* Signal handler for graceful shutdown */
static void signal_handler(int sig) {
    (void)sig;
    g_running = 0;
}

/* Message received callback */
static void on_message(const char* channel, const char* message, void* user_data) {
    (void)user_data;

    printf("\n[ MESSAGE ]\n");
    printf("  Channel: %s\n", channel);
    printf("  Message: %s\n", message);
    printf("  Time: %ld\n", (long)time(NULL));
    printf("\n> ");
    fflush(stdout);
}

/* Connection established callback */
static void on_connected(const char* channel, void* user_data) {
    (void)user_data;

    printf("\n[ CONNECTED ]\n");
    printf("  Subscribed to channel: %s\n", channel);
    printf("\n> ");
    fflush(stdout);
}

/* Error callback */
static void on_error(int32_t error_code, const char* message, void* user_data) {
    (void)user_data;

    fprintf(stderr, "\n[ ERROR ]\n");
    fprintf(stderr, "  Code: %d\n", error_code);
    fprintf(stderr, "  Message: %s\n", message);
    fprintf(stderr, "\n> ");
    fflush(stderr);
}

/* Heartbeat callback */
static void on_heartbeat(const char* channel, void* user_data) {
    (void)user_data;

    printf("\n[ HEARTBEAT ]\n");
    printf("  Channel: %s\n", channel);
    printf("  Time: %ld\n", (long)time(NULL));
    printf("\n> ");
    fflush(stdout);
}

int main(void) {
    printf("SecureNotify C SDK - Subscription Example\n");
    printf("=========================================\n\n");
    printf("Press Ctrl+C to exit\n\n");

    /* Install signal handlers for graceful shutdown */
    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);

    /* Create error structure */
    securenotify_error_t* error = securenotify_error_new();
    if (!error) {
        fprintf(stderr, "Failed to create error structure\n");
        return 1;
    }

    /* Create a client */
    printf("Creating client...\n");
    securenotify_client_t* client = securenotify_client_new(
        EXAMPLE_BASE_URL,
        EXAMPLE_API_KEY,
        error
    );

    if (!client) {
        fprintf(stderr, "Failed to create client\n");
        securenotify_error_free(error);
        return 1;
    }

    /* Subscribe to the channel */
    printf("Subscribing to channel '%s'...\n", EXAMPLE_CHANNEL);

    securenotify_subscription_t* subscription = securenotify_subscribe(
        client,
        EXAMPLE_CHANNEL,
        on_message,        /* Message callback (required) */
        on_connected,      /* Connected callback (optional) */
        on_error,          /* Error callback (optional) */
        on_heartbeat,      /* Heartbeat callback (optional) */
        NULL,              /* User data */
        error
    );

    if (!subscription) {
        fprintf(stderr, "Failed to create subscription\n");
        securenotify_client_free(client);
        securenotify_error_free(error);
        return 1;
    }

    printf("Subscription created!\n");
    printf("Waiting for messages...\n\n");

    /* Main loop - wait for messages until interrupted */
    printf("> ");
    fflush(stdout);

    while (g_running) {
        /* Sleep for 100ms to reduce CPU usage */
        usleep(100000);
    }

    printf("\n\nShutting down...\n");

    /* Clean up subscription */
    securenotify_unsubscribe(subscription, error);

    /* Clean up client */
    securenotify_client_free(client);

    /* Clean up error */
    securenotify_error_free(error);

    printf("Done!\n");

    return 0;
}
