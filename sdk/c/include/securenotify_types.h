/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright (c) 2026 KirkyX. All rights reserved. */

/**
 * @file securenotify_types.h
 * @brief Type definitions for SecureNotify C SDK
 *
 * This header defines all opaque handles and data structures used by the
 * SecureNotify C SDK. All types are designed to be ABI-stable and compatible
 * with the Rust UniFFI FFI layer.
 */

#ifndef SECURENOTIFY_TYPES_H
#define SECURENOTIFY_TYPES_H

#include <stdint.h>
#include <stdbool.h>

/**
 * @defgroup types Type Definitions
 * @brief Opaque handles and data structures for SecureNotify SDK
 * @{
 */

/** Opaque client handle */
typedef struct securenotify_client securenotify_client_t;

/** Opaque subscription handle */
typedef struct securenotify_subscription securenotify_subscription_t;

/** Opaque error handle */
typedef struct securenotify_error securenotify_error_t;

/**
 * @brief String container for C interoperability
 *
 * Wraps dynamically allocated strings to ensure proper memory management.
 * Always use securenotify_string_free() to release.
 */
typedef struct securenotify_string {
    /** Pointer to UTF-8 encoded string data (null-terminated) */
    char* data;
    /** Length of the string in bytes (excluding null terminator) */
    size_t length;
} securenotify_string_t;

/**
 * @brief Public key information structure
 */
typedef struct securenotify_public_key {
    /** Unique identifier for the public key */
    char* id;
    /** Associated channel ID */
    char* channel_id;
    /** Public key in PEM format */
    char* public_key;
    /** Encryption algorithm (e.g., "RSA-4096", "ECC-SECP256K1") */
    char* algorithm;
    /** Creation timestamp (Unix epoch milliseconds) */
    int64_t created_at;
    /** Expiration timestamp (Unix epoch milliseconds, 0 if never expires) */
    int64_t expires_at;
    /** Whether the key has expired */
    bool is_expired;
} securenotify_public_key_t;

/**
 * @brief List of public keys
 */
typedef struct securenotify_public_key_list {
    /** Array of public key pointers */
    securenotify_public_key_t** keys;
    /** Number of keys in the list */
    size_t count;
} securenotify_public_key_list_t;

/**
 * @brief Channel information structure
 */
typedef struct securenotify_channel {
    /** Unique channel identifier */
    char* id;
    /** Human-readable channel name */
    char* name;
    /** Channel description */
    char* description;
    /** Channel type ("public", "encrypted", "temporary") */
    char* type;
    /** Channel creator identifier */
    char* creator;
    /** Creation timestamp (Unix epoch milliseconds) */
    int64_t created_at;
    /** Expiration timestamp (Unix epoch milliseconds, 0 if never expires) */
    int64_t expires_at;
    /** Whether the channel is active */
    bool is_active;
} securenotify_channel_t;

/**
 * @brief List of channels
 */
typedef struct securenotify_channel_list {
    /** Array of channel pointers */
    securenotify_channel_t** channels;
    /** Number of channels in the list */
    size_t count;
} securenotify_channel_list_t;

/**
 * @brief Message result from publish operation
 */
typedef struct securenotify_message_result {
    /** Unique message identifier */
    char* message_id;
    /** Target channel ID */
    char* channel;
    /** Publication timestamp (Unix epoch milliseconds) */
    int64_t published_at;
    /** Whether the channel was auto-created */
    bool auto_created;
} securenotify_message_result_t;

/**
 * @brief Message information structure
 */
typedef struct securenotify_message {
    /** Unique message identifier */
    char* id;
    /** Channel ID */
    char* channel;
    /** Message content */
    char* message;
    /** Whether message is encrypted */
    bool encrypted;
    /** Creation timestamp (Unix epoch milliseconds) */
    int64_t created_at;
    /** Sender identifier */
    char* sender;
    /** Message priority (0-100) */
    uint8_t priority;
} securenotify_message_t;

/**
 * @brief List of messages
 */
typedef struct securenotify_message_list {
    /** Array of message pointers */
    securenotify_message_t** messages;
    /** Number of messages in the list */
    size_t count;
} securenotify_message_list_t;

/**
 * @brief API key information structure
 */
typedef struct securenotify_api_key {
    /** Unique key identifier */
    char* id;
    /** Key prefix (for identification, last 8 chars visible) */
    char* key_prefix;
    /** Key name */
    char* name;
    /** Array of permission strings */
    char** permissions;
    /** Number of permissions */
    size_t permissions_count;
    /** Whether the key is active */
    bool is_active;
    /** Creation timestamp (Unix epoch milliseconds) */
    int64_t created_at;
    /** Last used timestamp (Unix epoch milliseconds, 0 if never used) */
    int64_t last_used_at;
    /** Expiration timestamp (Unix epoch milliseconds, 0 if never expires) */
    int64_t expires_at;
} securenotify_api_key_t;

/**
 * @brief List of API keys
 */
typedef struct securenotify_api_key_list {
    /** Array of API key pointers */
    securenotify_api_key_t** keys;
    /** Number of keys in the list */
    size_t count;
} securenotify_api_key_list_t;

/**
 * @brief Message priority levels
 */
typedef enum securenotify_priority {
    /** Critical priority (100) - highest priority for urgent messages */
    SECURENOTIFY_PRIORITY_CRITICAL = 100,
    /** High priority (75) */
    SECURENOTIFY_PRIORITY_HIGH = 75,
    /** Normal priority (50) - default */
    SECURENOTIFY_PRIORITY_NORMAL = 50,
    /** Low priority (25) */
    SECURENOTIFY_PRIORITY_LOW = 25,
    /** Bulk priority (0) - lowest priority for batch messages */
    SECURENOTIFY_PRIORITY_BULK = 0,
} securenotify_priority_t;

/**
 * @brief Channel types
 */
typedef enum securenotify_channel_type {
    /** Public channel - open for anyone to subscribe */
    SECURENOTIFY_CHANNEL_PUBLIC = 0,
    /** Encrypted channel - requires encryption */
    SECURENOTIFY_CHANNEL_ENCRYPTED = 1,
    /** Temporary channel - auto-expires after TTL */
    SECURENOTIFY_CHANNEL_TEMPORARY = 2,
} securenotify_channel_type_t;

/**
 * @brief Subscription status
 */
typedef enum securenotify_subscription_status {
    /** Subscription is inactive/closed */
    SECURENOTIFY_SUBSCRIPTION_INACTIVE = 0,
    /** Subscription is connecting */
    SECURENOTIFY_SUBSCRIPTION_CONNECTING = 1,
    /** Subscription is active and receiving events */
    SECURENOTIFY_SUBSCRIPTION_ACTIVE = 2,
    /** Subscription is reconnecting after a disconnect */
    SECURENOTIFY_SUBSCRIPTION_RECONNECTING = 3,
} securenotify_subscription_status_t;

/**
 * @brief Connection state for client
 */
typedef enum securenotify_connection_state {
    /** Client is disconnected */
    SECURENOTIFY_DISCONNECTED = 0,
    /** Client is connecting */
    SECURENOTIFY_CONNECTING = 1,
    /** Client is connected */
    SECURENOTIFY_CONNECTED = 2,
    /** Client is reconnecting */
    SECURENOTIFY_RECONNECTING = 3,
} securenotify_connection_state_t;

/** @} */ // end of types

#endif /* SECURENOTIFY_TYPES_H */
