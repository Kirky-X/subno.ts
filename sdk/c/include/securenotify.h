/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright (c) 2026 KirkyX. All rights reserved. */

/**
 * @file securenotify.h
 * @brief Main SecureNotify C SDK API header
 *
 * This is the primary header for the SecureNotify C SDK. Include this file
 * to access all SDK functionality. For type definitions, see securenotify_types.h.
 * For error handling, see securenotify_error.h.
 *
 * All functions return NULL or false on error, with error details stored in
 * the optional error parameter. Check error after each operation.
 *
 * @code
 * securenotify_error_t* error = securenotify_error_new();
 * securenotify_client_t* client = securenotify_client_new(base_url, api_key, error);
 * if (!client) {
 *     fprintf(stderr, "Error: %s\n", securenotify_error_message(error));
 * }
 * securenotify_error_free(error);
 * @endcode
 */

#ifndef SECURENOTIFY_H
#define SECURENOTIFY_H

#include <stdint.h>
#include <stdbool.h>
#include <stddef.h>
#include "securenotify_types.h"
#include "securenotify_error.h"

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @defgroup client Client Lifecycle
 * @brief Client creation and management
 * @{
 */

/**
 * @brief Create a new SecureNotify client
 *
 * @param base_url Base URL of the SecureNotify API server
 * @param api_key API key for authentication
 * @param error Optional error structure to receive error details
 * @return New client handle, or NULL on error
 *
 * The client manages the connection to the SecureNotify API. Multiple
 * clients can be created and used concurrently from different threads.
 *
 * @note The base_url should not include trailing slashes
 * @note The API key should have appropriate permissions for intended operations
 */
securenotify_client_t* securenotify_client_new(
    const char* base_url,
    const char* api_key,
    securenotify_error_t* error
);

/**
 * @brief Free a client and release all resources
 *
 * @param client Client handle to free (can be NULL)
 *
 * This function also closes any active subscriptions associated with
 * the client. After this call, the client handle is invalid.
 */
void securenotify_client_free(securenotify_client_t* client);

/**
 * @brief Get the client's base URL
 *
 * @param client Client handle
 * @param error Optional error structure
 * @return String containing the base URL (must be freed with securenotify_string_free)
 *
 * Returns NULL on error. The caller is responsible for freeing the returned string.
 */
securenotify_string_t* securenotify_client_get_base_url(
    securenotify_client_t* client,
    securenotify_error_t* error
);

/**
 * @brief Get the client's connection state
 *
 * @param client Client handle
 * @return Current connection state
 */
securenotify_connection_state_t securenotify_client_get_state(
    securenotify_client_t* client
);

/** @} */ // end of client

/**
 * @defgroup keys Public Key Management
 * @brief Register, retrieve, and manage public keys
 * @{
 */

/**
 * @brief Register a new public key for a channel
 *
 * @param client Client handle
 * @param public_key Public key in PEM format
 * @param algorithm Encryption algorithm ("RSA-2048", "RSA-4096", "ECC-SECP256K1")
 * @param expires_in_seconds Key validity period in seconds (0 for no expiry)
 * @param error Optional error structure
 * @return New public key structure, or NULL on error
 *
 * If the channel doesn't exist, it will be auto-created with encrypted type.
 *
 * @note The caller must free the returned structure using securenotify_public_key_free()
 */
securenotify_public_key_t* securenotify_keys_register(
    securenotify_client_t* client,
    const char* public_key,
    const char* algorithm,
    int32_t expires_in_seconds,
    securenotify_error_t* error
);

/**
 * @brief Get public key information for a channel
 *
 * @param client Client handle
 * @param channel_id Channel ID to look up
 * @param error Optional error structure
 * @return Public key structure, or NULL on error
 *
 * @note The caller must free the returned structure using securenotify_public_key_free()
 */
securenotify_public_key_t* securenotify_keys_get(
    securenotify_client_t* client,
    const char* channel_id,
    securenotify_error_t* error
);

/**
 * @brief List all registered public keys
 *
 * @param client Client handle
 * @param limit Maximum number of keys to return (0 for default)
 * @param offset Offset for pagination (0 for first page)
 * @param error Optional error structure
 * @return List of public keys, or NULL on error
 *
 * @note The caller must free the returned list using securenotify_public_key_list_free()
 */
securenotify_public_key_list_t* securenotify_keys_list(
    securenotify_client_t* client,
    uint32_t limit,
    uint32_t offset,
    securenotify_error_t* error
);

/**
 * @brief Revoke a public key
 *
 * @param client Client handle
 * @param channel_id Channel ID whose key should be revoked
 * @param error Optional error structure
 * @return true on success, false on error
 */
bool securenotify_keys_revoke(
    securenotify_client_t* client,
    const char* channel_id,
    securenotify_error_t* error
);

/**
 * @brief Free a public key structure
 *
 * @param key Public key structure to free (can be NULL)
 */
void securenotify_public_key_free(securenotify_public_key_t* key);

/**
 * @brief Free a public key list
 *
 * @param list Public key list to free (can be NULL)
 *
 * Also frees all public key structures within the list.
 */
void securenotify_public_key_list_free(securenotify_public_key_list_t* list);

/** @} */ // end of keys

/**
 * @defgroup channels Channel Management
 * @brief Create and manage channels
 * @{
 */

/**
 * @brief Create a new channel
 *
 * @param client Client handle
 * @param channel_id Unique channel identifier (NULL for auto-generation)
 * @param name Human-readable channel name
 * @param type Channel type ("public", "encrypted", "temporary")
 * @param description Optional channel description
 * @param error Optional error structure
 * @return New channel structure, or NULL on error
 *
 * @note The caller must free the returned structure using securenotify_channel_free()
 */
securenotify_channel_t* securenotify_channels_create(
    securenotify_client_t* client,
    const char* channel_id,
    const char* name,
    const char* type,
    const char* description,
    securenotify_error_t* error
);

/**
 * @brief Get channel information
 *
 * @param client Client handle
 * @param channel_id Channel ID to look up
 * @param error Optional error structure
 * @return Channel structure, or NULL on error
 *
 * @note The caller must free the returned structure using securenotify_channel_free()
 */
securenotify_channel_t* securenotify_channels_get(
    securenotify_client_t* client,
    const char* channel_id,
    securenotify_error_t* error
);

/**
 * @brief List all channels
 *
 * @param client Client handle
 * @param type Optional channel type filter ("public", "encrypted", "temporary")
 * @param limit Maximum number of channels to return (0 for default)
 * @param offset Offset for pagination (0 for first page)
 * @param error Optional error structure
 * @return List of channels, or NULL on error
 *
 * @note The caller must free the returned list using securenotify_channel_list_free()
 */
securenotify_channel_list_t* securenotify_channels_list(
    securenotify_client_t* client,
    const char* type,
    uint32_t limit,
    uint32_t offset,
    securenotify_error_t* error
);

/**
 * @brief Delete a channel
 *
 * @param client Client handle
 * @param channel_id Channel ID to delete
 * @param error Optional error structure
 * @return true on success, false on error
 */
bool securenotify_channels_delete(
    securenotify_client_t* client,
    const char* channel_id,
    securenotify_error_t* error
);

/**
 * @brief Free a channel structure
 *
 * @param channel Channel structure to free (can be NULL)
 */
void securenotify_channel_free(securenotify_channel_t* channel);

/**
 * @brief Free a channel list
 *
 * @param list Channel list to free (can be NULL)
 *
 * Also frees all channel structures within the list.
 */
void securenotify_channel_list_free(securenotify_channel_list_t* list);

/** @} */ // end of channels

/**
 * @defgroup publish Message Publishing
 * @brief Publish messages to channels
 * @{
 */

/**
 * @brief Publish a message to a channel
 *
 * @param client Client handle
 * @param channel Target channel ID
 * @param message Message content
 * @param priority Message priority level
 * @param sender Optional sender identifier
 * @param encrypted Whether message should be encrypted
 * @param error Optional error structure
 * @return Message result, or NULL on error
 *
 * @note The caller must free the returned structure using securenotify_message_result_free()
 */
securenotify_message_result_t* securenotify_publish_send(
    securenotify_client_t* client,
    const char* channel,
    const char* message,
    securenotify_priority_t priority,
    const char* sender,
    bool encrypted,
    securenotify_error_t* error
);

/**
 * @brief Get message information
 *
 * @param client Client handle
 * @param channel Channel ID
 * @param message_id Message ID
 * @param error Optional error structure
 * @return Message structure, or NULL on error
 *
 * @note The caller must free the returned structure using securenotify_message_free()
 */
securenotify_message_t* securenotify_publish_get(
    securenotify_client_t* client,
    const char* channel,
    const char* message_id,
    securenotify_error_t* error
);

/**
 * @brief Get message queue status for a channel
 *
 * @param client Client handle
 * @param channel Channel ID
 * @param error Optional error structure
 * @return JSON string with queue status (must be freed with securenotify_string_free)
 */
securenotify_string_t* securenotify_publish_queue_status(
    securenotify_client_t* client,
    const char* channel,
    securenotify_error_t* error
);

/**
 * @brief Free a message result structure
 *
 * @param result Message result to free (can be NULL)
 */
void securenotify_message_result_free(securenotify_message_result_t* result);

/**
 * @brief Free a message structure
 *
 * @param message Message structure to free (can be NULL)
 */
void securenotify_message_free(securenotify_message_t* message);

/**
 * @brief Free a message list
 *
 * @param list Message list to free (can be NULL)
 *
 * Also frees all message structures within the list.
 */
void securenotify_message_list_free(securenotify_message_list_t* list);

/** @} */ // end of publish

/**
 * @defgroup subscribe Real-Time Subscriptions
 * @brief Subscribe to channels and receive real-time messages
 * @{
 */

/**
 * @brief Message received callback
 *
 * @param channel Channel ID the message was received on
 * @param message Message content (JSON string)
 * @param user_data User-provided data passed through
 */
typedef void (*securenotify_message_callback_t)(
    const char* channel,
    const char* message,
    void* user_data
);

/**
 * @brief Connection established callback
 *
 * @param channel Channel ID that was connected
 * @param user_data User-provided data passed through
 */
typedef void (*securenotify_connected_callback_t)(
    const char* channel,
    void* user_data
);

/**
 * @brief Error occurred callback
 *
 * @param error_code Error code
 * @param message Error message
 * @param user_data User-provided data passed through
 */
typedef void (*securenotify_error_callback_t)(
    int32_t error_code,
    const char* message,
    void* user_data
);

/**
 * @brief Heartbeat received callback
 *
 * @param channel Channel ID
 * @param user_data User-provided data passed through
 */
typedef void (*securenotify_heartbeat_callback_t)(
    const char* channel,
    void* user_data
);

/**
 * @brief Subscribe to a channel for real-time messages
 *
 * @param client Client handle
 * @param channel Channel ID to subscribe to
 * @param on_message Callback for received messages (required)
 * @param on_connected Callback when connection is established (optional)
 * @param on_error Callback for errors (optional)
 * @param on_heartbeat Callback for heartbeat events (optional)
 * @param user_data User data passed to callbacks
 * @param error Optional error structure
 * @return Subscription handle, or NULL on error
 *
 * The subscription runs in a background thread. Use securenotify_unsubscribe()
 * to stop receiving messages.
 *
 * @note The subscription handle must be freed using securenotify_subscription_free()
 * @warning Do not call securenotify_subscription_free() from within callbacks
 */
securenotify_subscription_t* securenotify_subscribe(
    securenotify_client_t* client,
    const char* channel,
    securenotify_message_callback_t on_message,
    securenotify_connected_callback_t on_connected,
    securenotify_error_callback_t on_error,
    securenotify_heartbeat_callback_t on_heartbeat,
    void* user_data,
    securenotify_error_t* error
);

/**
 * @brief Unsubscribe from a channel
 *
 * @param subscription Subscription handle
 * @param error Optional error structure
 * @return true on success, false on error
 *
 * This function blocks until the subscription thread has stopped.
 * After this call, the subscription handle is invalid.
 */
int securenotify_unsubscribe(securenotify_subscription_t* subscription, securenotify_error_t* error);

/**
 * @brief Get subscription status
 *
 * @param subscription Subscription handle
 * @return Current subscription status
 */
securenotify_subscription_status_t securenotify_subscription_get_status(
    securenotify_subscription_t* subscription
);

/**
 * @brief Free a subscription handle
 *
 * @param subscription Subscription handle to free (can be NULL)
 *
 * This function automatically unsubscribes if still active.
 */
void securenotify_subscription_free(securenotify_subscription_t* subscription);

/** @} */ // end of subscribe

/**
 * @defgroup api_keys API Key Management
 * @brief Create and manage API keys
 * @{
 */

/**
 * @brief Create a new API key
 *
 * @param client Client handle
 * @param name Name for the API key
 * @param permissions JSON array of permissions (e.g., ["publish", "subscribe"])
 * @param expires_in_seconds Key validity period in seconds (0 for no expiry)
 * @param error Optional error structure
 * @return New API key structure, or NULL on error
 *
 * @note The returned structure contains the full API key which is only shown once.
 * Store it securely immediately after creation.
 * @note The caller must free the returned structure using securenotify_api_key_free()
 */
securenotify_api_key_t* securenotify_api_keys_create(
    securenotify_client_t* client,
    const char* name,
    const char* permissions,
    int32_t expires_in_seconds,
    securenotify_error_t* error
);

/**
 * @brief List all API keys
 *
 * @param client Client handle
 * @param error Optional error structure
 * @return List of API keys, or NULL on error
 *
 * @note The returned API keys do not contain the full key, only the prefix.
 * @note The caller must free the returned list using securenotify_api_key_list_free()
 */
securenotify_api_key_list_t* securenotify_api_keys_list(
    securenotify_client_t* client,
    securenotify_error_t* error
);

/**
 * @brief Revoke an API key
 *
 * @param client Client handle
 * @param key_id API key ID to revoke
 * @param error Optional error structure
 * @return true on success, false on error
 */
bool securenotify_api_keys_revoke(
    securenotify_client_t* client,
    const char* key_id,
    securenotify_error_t* error
);

/**
 * @brief Free an API key structure
 *
 * @param key API key structure to free (can be NULL)
 */
void securenotify_api_key_free(securenotify_api_key_t* key);

/**
 * @brief Free an API key list
 *
 * @param list API key list to free (can be NULL)
 *
 * Also frees all API key structures within the list.
 */
void securenotify_api_key_list_free(securenotify_api_key_list_t* list);

/** @} */ // end of api_keys

/**
 * @defgroup utils Utility Functions
 * @brief String and memory utilities
 * @{
 */

/**
 * @brief Free a string structure
 *
 * @param string String structure to free (can be NULL)
 */
void securenotify_string_free(securenotify_string_t* string);

/**
 * @brief Get version information
 *
 * @return Version string (static, do not free)
 */
const char* securenotify_version(void);

/**
 * @brief Get SDK build information
 *
 * @return Build info string (static, do not free)
 */
const char* securenotify_build_info(void);

/** @} */ // end of utils

#ifdef __cplusplus
}
#endif

#endif /* SECURENOTIFY_H */
