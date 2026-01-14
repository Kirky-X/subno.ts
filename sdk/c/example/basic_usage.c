/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright (c) 2026 KirkyX. All rights reserved. */

/**
 * @file basic_usage.c
 * @brief Basic usage example for SecureNotify C SDK
 *
 * This example demonstrates the basic operations of the SecureNotify SDK:
 * 1. Creating a client
 * 2. Registering a public key
 * 3. Creating a channel
 * 4. Publishing a message
 * 5. Cleaning up resources
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "securenotify.h"

/* Example configuration - replace with your actual values */
#define EXAMPLE_BASE_URL "https://api.securenotify.dev"
#define EXAMPLE_API_KEY "your-api-key-here"

/* Example RSA public key (truncated for brevity) */
#define EXAMPLE_PUBLIC_KEY "-----BEGIN PUBLIC KEY-----\n" \
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...\n" \
    "-----END PUBLIC KEY-----"

static void print_error(securenotify_error_t* error) {
    if (error) {
        fprintf(stderr, "Error [%d]: %s\n",
                securenotify_error_code(error),
                securenotify_error_message(error));
    }
}

int main(void) {
    printf("SecureNotify C SDK - Basic Usage Example\n");
    printf("========================================\n\n");

    /* Create error structure for handling errors */
    securenotify_error_t* error = securenotify_error_new();
    if (!error) {
        fprintf(stderr, "Failed to create error structure\n");
        return 1;
    }

    /* Create a client */
    printf("1. Creating client...\n");
    securenotify_client_t* client = securenotify_client_new(
        EXAMPLE_BASE_URL,
        EXAMPLE_API_KEY,
        error
    );

    if (!client) {
        fprintf(stderr, "Failed to create client: ");
        print_error(error);
        securenotify_error_free(error);
        return 1;
    }

    printf("   Client created successfully!\n");
    printf("   Base URL: %s\n", securenotify_client_get_base_url(client, error)->data);

    /* Register a public key */
    printf("\n2. Registering public key...\n");
    securenotify_public_key_t* public_key = securenotify_keys_register(
        client,
        EXAMPLE_PUBLIC_KEY,
        "RSA-4096",
        604800, /* 7 days expiry */
        error
    );

    if (public_key) {
        printf("   Public key registered successfully!\n");
        printf("   Channel ID: %s\n", public_key->channel_id);
        printf("   Algorithm: %s\n", public_key->algorithm);

        /* Create a channel using the same ID as the public key */
        printf("\n3. Creating channel...\n");
        securenotify_channel_t* channel = securenotify_channels_create(
            client,
            public_key->channel_id,
            "My Secure Channel",
            "encrypted",
            "A secure channel for encrypted messaging",
            error
        );

        if (channel) {
            printf("   Channel created successfully!\n");
            printf("   Channel ID: %s\n", channel->id);
            printf("   Channel Type: %s\n", channel->type);

            /* Publish a message */
            printf("\n4. Publishing message...\n");
            securenotify_message_result_t* result = securenotify_publish_send(
                client,
                channel->id,
                "Hello, SecureNotify!",
                SECURENOTIFY_PRIORITY_NORMAL,
                "example-sender",
                false,
                error
            );

            if (result) {
                printf("   Message published successfully!\n");
                printf("   Message ID: %s\n", result->message_id);
                printf("   Channel: %s\n", result->channel);

                securenotify_message_result_free(result);
            } else {
                fprintf(stderr, "   Failed to publish message: ");
                print_error(error);
            }

            securenotify_channel_free(channel);
        } else {
            fprintf(stderr, "   Failed to create channel: ");
            print_error(error);
        }

        securenotify_public_key_free(public_key);
    } else {
        fprintf(stderr, "Failed to register public key: ");
        print_error(error);
    }

    /* List channels */
    printf("\n5. Listing channels...\n");
    securenotify_channel_list_t* channels = securenotify_channels_list(
        client,
        NULL, /* no type filter */
        10,   /* limit to 10 */
        0,    /* offset 0 */
        error
    );

    if (channels) {
        printf("   Found %zu channels\n", channels->count);
        securenotify_channel_list_free(channels);
    } else {
        fprintf(stderr, "   Failed to list channels: ");
        print_error(error);
    }

    /* Clean up */
    printf("\n6. Cleaning up...\n");
    securenotify_client_free(client);
    securenotify_error_free(error);

    printf("   Done!\n\n");
    printf("SDK Version: %s\n", securenotify_version());
    printf("Build Info: %s\n", securenotify_build_info());

    return 0;
}
