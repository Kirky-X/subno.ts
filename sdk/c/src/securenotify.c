/* SPDX-License-Identifier: Apache-2.0 */
/* Copyright (c) 2026 KirkyX. All rights reserved. */

/**
 * @file securenotify.c
 * @brief SecureNotify C SDK main implementation
 *
 * This file implements all public API functions for the SecureNotify SDK
 * using libcurl for HTTP/HTTPS requests.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <curl/curl.h>
#include <pthread.h>
#include "securenotify.h"

/* SDK Version */
#define SECURENOTIFY_VERSION_MAJOR 0
#define SECURENOTIFY_VERSION_MINOR 1
#define SECURENOTIFY_VERSION_PATCH 0

/* Internal client structure */
struct securenotify_client {
    char* base_url;
    char* api_key;
    CURL* curl;
    pthread_mutex_t mutex;
    bool initialized;
};

/* Internal subscription structure */
struct securenotify_subscription {
    securenotify_client_t* client;
    char* channel;
    pthread_t thread;
    pthread_mutex_t mutex;
    pthread_cond_t cond;
    bool running;
    bool should_stop;

    /* Callbacks */
    securenotify_message_callback_t on_message;
    securenotify_connected_callback_t on_connected;
    securenotify_error_callback_t on_error;
    securenotify_heartbeat_callback_t on_heartbeat;
    void* user_data;

    securenotify_subscription_status_t status;
};

/* Response buffer for curl */
typedef struct {
    char* data;
    size_t size;
    size_t capacity;
} response_buffer_t;

/* Forward declarations */
static size_t curl_write_callback(void* contents, size_t size, size_t nmemb, void* userdata);
static int curl_initialize(void);
static void curl_cleanup(void);
static char* build_url(securenotify_client_t* client, const char* endpoint);
static char* escape_string(securenotify_client_t* client, const char* str);
static bool parse_json_string(const char* json, const char* key, char** out_value);
static bool parse_json_int64(const char* json, const char* key, int64_t* out_value);
static bool parse_json_bool(const char* json, const char* key, bool* out_value);
static int http_post(securenotify_client_t* client, const char* endpoint,
                     const char* body, char** response);
static int http_get(securenotify_client_t* client, const char* endpoint, char** response);
static int http_delete(securenotify_client_t* client, const char* endpoint);

/* Mutex for libcurl global initialization */
static pthread_mutex_t curl_mutex = PTHREAD_MUTEX_INITIALIZER;
static int curl_init_count = 0;

/* ========== Input Validation Functions ========== */

/**
 * @brief Validate a string parameter
 * @param str String to validate
 * @param max_length Maximum allowed length (0 for no limit)
 * @return true if valid, false otherwise
 */
static bool validate_string(const char* str, size_t max_length) {
    if (!str) return false;

    size_t len = strlen(str);
    if (max_length > 0 && len > max_length) return false;

    /* Check for null bytes in the middle of the string */
    for (size_t i = 0; i < len; i++) {
        if (str[i] == '\0' && i < len - 1) return false;
    }

    return true;
}

/**
 * @brief Validate a channel ID format
 * @param channel_id Channel ID to validate
 * @return true if valid, false otherwise
 */
static bool validate_channel_id(const char* channel_id) {
    if (!validate_string(channel_id, 256)) return false;

    /* Channel ID should only contain alphanumeric chars, hyphens, and underscores */
    for (size_t i = 0; channel_id[i] != '\0'; i++) {
        char c = channel_id[i];
        if (!((c >= 'a' && c <= 'z') ||
              (c >= 'A' && c <= 'Z') ||
              (c >= '0' && c <= '9') ||
              c == '-' || c == '_')) {
            return false;
        }
    }

    return true;
}

/**
 * @brief Validate a public key format
 * @param public_key Public key to validate
 * @return true if valid, false otherwise
 */
static bool validate_public_key(const char* public_key) {
    if (!validate_string(public_key, 16384)) return false;

    /* Basic check for PEM format */
    const char* pem_start = "-----BEGIN";
    const char* pem_end = "-----END";

    if (strstr(public_key, pem_start) == NULL) return false;
    if (strstr(public_key, pem_end) == NULL) return false;

    return true;
}

/**
 * @brief Validate an algorithm string
 * @param algorithm Algorithm to validate
 * @return true if valid, false otherwise
 */
static bool validate_algorithm(const char* algorithm) {
    if (!validate_string(algorithm, 64)) return false;

    const char* valid_algorithms[] = {
        "RSA-2048",
        "RSA-4096",
        "ECC-SECP256K1",
        NULL
    };

    for (int i = 0; valid_algorithms[i] != NULL; i++) {
        if (strcmp(algorithm, valid_algorithms[i]) == 0) {
            return true;
        }
    }

    return false;
}

/**
 * @brief Validate a message content
 * @param message Message to validate
 * @return true if valid, false otherwise
 */
static bool validate_message(const char* message) {
    if (!validate_string(message, 1048576)) return false; /* 1MB max */

    return true;
}

/* ========== Utility Functions ========== */

static size_t curl_write_callback(void* contents, size_t size, size_t nmemb, void* userdata) {
    size_t realsize = size * nmemb;
    response_buffer_t* buf = (response_buffer_t*)userdata;

    char* ptr = realloc(buf->data, buf->size + realsize + 1);
    if (!ptr) {
        return 0;
    }

    buf->data = ptr;
    memcpy(&(buf->data[buf->size]), contents, realsize);
    buf->size += realsize;
    buf->data[buf->size] = '\0';

    return realsize;
}

static int curl_initialize(void) {
    pthread_mutex_lock(&curl_mutex);
    if (curl_init_count == 0) {
        curl_global_init(CURL_GLOBAL_ALL);
    }
    curl_init_count++;
    pthread_mutex_unlock(&curl_mutex);
    return 0;
}

static void curl_cleanup(void) {
    pthread_mutex_lock(&curl_mutex);
    curl_init_count--;
    if (curl_init_count == 0) {
        curl_global_cleanup();
    }
    pthread_mutex_unlock(&curl_mutex);
}

static char* build_url(securenotify_client_t* client, const char* endpoint) {
    if (!client || !endpoint) return NULL;

    size_t url_len = strlen(client->base_url) + strlen(endpoint) + 2;
    char* url = malloc(url_len);
    if (!url) return NULL;

    snprintf(url, url_len, "%s/%s", client->base_url, endpoint);
    return url;
}

static bool parse_json_string(const char* json, const char* key, char** out_value) {
    if (!json || !key || !out_value) return false;

    char pattern[256];
    snprintf(pattern, sizeof(pattern), "\"%s\":", key);

    const char* pos = strstr(json, pattern);
    if (!pos) return false;

    pos += strlen(pattern);

    /* Skip whitespace */
    while (*pos == ' ' || *pos == '\t' || *pos == '\n') pos++;

    if (*pos != '"') return false;
    pos++;

    const char* end = strchr(pos, '"');
    if (!end) return false;

    size_t len = end - pos;
    *out_value = malloc(len + 1);
    if (!*out_value) return false;

    memcpy(*out_value, pos, len);
    (*out_value)[len] = '\0';

    return true;
}

static bool parse_json_int64(const char* json, const char* key, int64_t* out_value) {
    if (!json || !key || !out_value) return false;

    char pattern[256];
    snprintf(pattern, sizeof(pattern), "\"%s\":", key);

    const char* pos = strstr(json, pattern);
    if (!pos) return false;

    pos += strlen(pattern);

    /* Skip whitespace */
    while (*pos == ' ' || *pos == '\t' || *pos == '\n') pos++;

    *out_value = strtoll(pos, NULL, 10);
    return true;
}

static bool parse_json_bool(const char* json, const char* key, bool* out_value) {
    if (!json || !key || !out_value) return false;

    char pattern[256];
    snprintf(pattern, sizeof(pattern), "\"%s\":", key);

    const char* pos = strstr(json, pattern);
    if (!pos) return false;

    pos += strlen(pattern);

    /* Skip whitespace */
    while (*pos == ' ' || *pos == '\t' || *pos == '\n') pos++;

    *out_value = (strncmp(pos, "true", 4) == 0);
    return true;
}

static int http_request(
    securenotify_client_t* client,
    const char* url,
    const char* method,
    const char* body,
    char** response
) {
    if (!client || !client->curl || !url || !method) {
        return -1;
    }

    CURL* curl = client->curl;
    struct curl_slist* headers = NULL;
    response_buffer_t buf = {0};

    /* Set URL */
    curl_easy_setopt(curl, CURLOPT_URL, url);

    /* Set method */
    if (strcmp(method, "GET") == 0) {
        curl_easy_setopt(curl, CURLOPT_HTTPGET, 1L);
    } else if (strcmp(method, "POST") == 0) {
        curl_easy_setopt(curl, CURLOPT_POST, 1L);
        if (body) {
            curl_easy_setopt(curl, CURLOPT_POSTFIELDS, body);
        }
    } else if (strcmp(method, "DELETE") == 0) {
        curl_easy_setopt(curl, CURLOPT_CUSTOMREQUEST, "DELETE");
    }

    /* Set headers */
    headers = curl_slist_append(headers, "Content-Type: application/json");
    headers = curl_slist_append(headers, "Accept: application/json");
    if (client->api_key) {
        char auth_header[512];
        snprintf(auth_header, sizeof(auth_header), "Authorization: Bearer %s", client->api_key);
        headers = curl_slist_append(headers, auth_header);
    }
    curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);

    /* Set write callback */
    curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, curl_write_callback);
    curl_easy_setopt(curl, CURLOPT_WRITEDATA, &buf);

    /* Set timeout */
    curl_easy_setopt(curl, CURLOPT_TIMEOUT, 30L);
    curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 10L);

    /* Follow redirects */
    curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);

    /* Perform request */
    CURLcode res = curl_easy_perform(curl);

    /* Get response code */
    long http_code = 0;
    curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);

    /* Cleanup headers */
    curl_slist_free_all(headers);

    if (res != CURLE_OK) {
        free(buf.data);
        return -1;
    }

    if (http_code >= 200 && http_code < 300) {
        if (response) {
            *response = buf.data;
        } else {
            free(buf.data);
        }
        return (int)http_code;
    } else {
        free(buf.data);
        return (int)http_code;
    }
}

static int http_post(securenotify_client_t* client, const char* endpoint,
                     const char* body, char** response) {
    char* url = build_url(client, endpoint);
    if (!url) return -1;

    int result = http_request(client, url, "POST", body, response);
    free(url);
    return result;
}

static int http_get(securenotify_client_t* client, const char* endpoint, char** response) {
    char* url = build_url(client, endpoint);
    if (!url) return -1;

    int result = http_request(client, url, "GET", NULL, response);
    free(url);
    return result;
}

static int http_delete(securenotify_client_t* client, const char* endpoint) {
    char* url = build_url(client, endpoint);
    if (!url) return -1;

    int result = http_request(client, url, "DELETE", NULL, NULL);
    free(url);
    return result;
}

/* ========== Client Lifecycle ========== */

securenotify_client_t* securenotify_client_new(
    const char* base_url,
    const char* api_key,
    securenotify_error_t* error
) {
    (void)error; /* TODO: Implement error handling */

    if (!base_url || !api_key) {
        return NULL;
    }

    curl_initialize();

    securenotify_client_t* client = malloc(sizeof(securenotify_client_t));
    if (!client) {
        curl_cleanup();
        return NULL;
    }

    client->base_url = strdup(base_url);
    client->api_key = strdup(api_key);
    client->curl = curl_easy_init();
    client->initialized = true;
    pthread_mutex_init(&client->mutex, NULL);

    if (!client->base_url || !client->api_key || !client->curl) {
        securenotify_client_free(client);
        return NULL;
    }

    return client;
}

void securenotify_client_free(securenotify_client_t* client) {
    if (!client) return;

    pthread_mutex_lock(&client->mutex);

    if (client->base_url) {
        free(client->base_url);
        client->base_url = NULL;
    }

    if (client->api_key) {
        free(client->api_key);
        client->api_key = NULL;
    }

    if (client->curl) {
        curl_easy_cleanup(client->curl);
        client->curl = NULL;
    }

    pthread_mutex_unlock(&client->mutex);
    pthread_mutex_destroy(&client->mutex);

    free(client);
    curl_cleanup();
}

securenotify_string_t* securenotify_client_get_base_url(
    securenotify_client_t* client,
    securenotify_error_t* error
) {
    (void)error;

    if (!client) return NULL;

    securenotify_string_t* str = malloc(sizeof(securenotify_string_t));
    if (!str) return NULL;

    pthread_mutex_lock(&client->mutex);
    str->data = client->base_url ? strdup(client->base_url) : NULL;
    str->length = str->data ? strlen(str->data) : 0;
    pthread_mutex_unlock(&client->mutex);

    return str;
}

securenotify_connection_state_t securenotify_client_get_state(securenotify_client_t* client) {
    if (!client) return SECURENOTIFY_DISCONNECTED;
    return SECURENOTIFY_DISCONNECTED; /* Simple client is always disconnected */
}

/* ========== Public Key Management ========== */

securenotify_public_key_t* securenotify_keys_register(
    securenotify_client_t* client,
    const char* public_key,
    const char* algorithm,
    int32_t expires_in_seconds,
    securenotify_error_t* error
) {
    /* Validate client */
    if (!client) {
        if (error) securenotify_error_set(error, SECURENOTIFY_ERROR_VALIDATION,
                                          "Client is NULL", 0);
        return NULL;
    }

    /* Validate public key */
    if (!validate_public_key(public_key)) {
        if (error) securenotify_error_set(error, SECURENOTIFY_ERROR_VALIDATION,
                                          "Invalid public key format or length", 0);
        return NULL;
    }

    /* Validate algorithm */
    if (!validate_algorithm(algorithm)) {
        if (error) securenotify_error_set(error, SECURENOTIFY_ERROR_VALIDATION,
                                          "Invalid algorithm. Must be RSA-2048, RSA-4096, or ECC-SECP256K1", 0);
        return NULL;
    }

    /* Validate expires_in_seconds */
    if (expires_in_seconds < 0) {
        if (error) securenotify_error_set(error, SECURENOTIFY_ERROR_VALIDATION,
                                          "expires_in_seconds must be non-negative", 0);
        return NULL;
    }

    /* Build request body */
    char body[8192];
    if (expires_in_seconds > 0) {
        snprintf(body, sizeof(body),
                 "{\"publicKey\":\"%s\",\"algorithm\":\"%s\",\"expiresIn\":%d}",
                 public_key, algorithm, expires_in_seconds);
    } else {
        snprintf(body, sizeof(body),
                 "{\"publicKey\":\"%s\",\"algorithm\":\"%s\"}",
                 public_key, algorithm);
    }

    char* response = NULL;
    int status = http_post(client, "api/register", body, &response);

    if (status < 0) {
        if (error) securenotify_error_set(error, SECURENOTIFY_ERROR_NETWORK,
                                          "Failed to connect to server", 0);
        return NULL;
    }

    if (status != 200) {
        if (error) {
            char* msg = NULL;
            parse_json_string(response, "message", &msg);
            securenotify_error_set(error, SECURENOTIFY_ERROR_API,
                                   msg ? msg : "API error", status);
            if (msg) free(msg);
        }
        free(response);
        return NULL;
    }

    /* Parse response */
    securenotify_public_key_t* key = malloc(sizeof(securenotify_public_key_t));
    if (!key) {
        free(response);
        return NULL;
    }

    memset(key, 0, sizeof(securenotify_public_key_t));

    char* channel_id = NULL;
    char* created_at = NULL;
    char* expires_at = NULL;

    if (parse_json_string(response, "channelId", &channel_id)) {
        key->channel_id = channel_id;
    }

    /* Extract channel ID from register response format */
    if (!key->channel_id && parse_json_string(response, "channel_id", &channel_id)) {
        key->channel_id = channel_id;
    }

    if (parse_json_string(response, "createdAt", &created_at)) {
        key->created_at = strtoll(created_at, NULL, 10);
        free(created_at);
    }

    if (parse_json_string(response, "expiresAt", &expires_at) && expires_at) {
        key->expires_at = strtoll(expires_at, NULL, 10);
        free(expires_at);
    } else {
        key->expires_at = 0;
    }

    key->id = key->channel_id ? strdup(key->channel_id) : NULL;
    key->public_key = strdup(public_key);
    key->algorithm = strdup(algorithm);
    key->is_expired = (key->expires_at > 0 &&
                       (int64_t)time(NULL) * 1000 > key->expires_at);

    free(response);
    return key;
}

securenotify_public_key_t* securenotify_keys_get(
    securenotify_client_t* client,
    const char* channel_id,
    securenotify_error_t* error
) {
    (void)error;

    if (!client || !channel_id) return NULL;

    char endpoint[256];
    snprintf(endpoint, sizeof(endpoint), "api/register/%s", channel_id);

    char* response = NULL;
    int status = http_get(client, endpoint, &response);

    if (status != 200) {
        free(response);
        return NULL;
    }

    securenotify_public_key_t* key = malloc(sizeof(securenotify_public_key_t));
    if (!key) {
        free(response);
        return NULL;
    }

    memset(key, 0, sizeof(securenotify_public_key_t));

    parse_json_string(response, "channelId", &key->channel_id);
    parse_json_string(response, "publicKey", &key->public_key);
    parse_json_string(response, "algorithm", &key->algorithm);

    char* created_at = NULL;
    if (parse_json_string(response, "createdAt", &created_at)) {
        key->created_at = strtoll(created_at, NULL, 10);
        free(created_at);
    }

    char* expires_at = NULL;
    if (parse_json_string(response, "expiresAt", &expires_at)) {
        key->expires_at = strtoll(expires_at, NULL, 10);
        free(expires_at);
    }

    key->id = key->channel_id ? strdup(key->channel_id) : NULL;
    key->is_expired = (key->expires_at > 0 &&
                       (int64_t)time(NULL) * 1000 > key->expires_at);

    free(response);
    return key;
}

securenotify_public_key_list_t* securenotify_keys_list(
    securenotify_client_t* client,
    uint32_t limit,
    uint32_t offset,
    securenotify_error_t* error
) {
    (void)error;

    if (!client) return NULL;

    char endpoint[256];
    if (limit > 0 || offset > 0) {
        snprintf(endpoint, sizeof(endpoint), "api/register?limit=%u&offset=%u",
                 limit, offset);
    } else {
        snprintf(endpoint, sizeof(endpoint), "api/register");
    }

    char* response = NULL;
    int status = http_get(client, endpoint, &response);

    if (status != 200) {
        free(response);
        return NULL;
    }

    securenotify_public_key_list_t* list = malloc(sizeof(securenotify_public_key_list_t));
    if (!list) {
        free(response);
        return NULL;
    }

    list->keys = NULL;
    list->count = 0;

    /* TODO: Parse array response - for now return empty list */
    (void)response; /* Suppress unused warning */

    return list;
}

bool securenotify_keys_revoke(
    securenotify_client_t* client,
    const char* channel_id,
    securenotify_error_t* error
) {
    (void)error;

    if (!client || !channel_id) return false;

    char endpoint[256];
    snprintf(endpoint, sizeof(endpoint), "api/keys/%s/revoke", channel_id);

    int status = http_delete(client, endpoint);
    return (status == 200 || status == 204);
}

void securenotify_public_key_free(securenotify_public_key_t* key) {
    if (!key) return;

    if (key->id) free(key->id);
    if (key->channel_id) free(key->channel_id);
    if (key->public_key) free(key->public_key);
    if (key->algorithm) free(key->algorithm);

    free(key);
}

void securenotify_public_key_list_free(securenotify_public_key_list_t* list) {
    if (!list) return;

    if (list->keys) {
        for (size_t i = 0; i < list->count; i++) {
            if (list->keys[i]) {
                securenotify_public_key_free(list->keys[i]);
            }
        }
        free(list->keys);
    }

    free(list);
}

/* ========== Channel Management ========== */

securenotify_channel_t* securenotify_channels_create(
    securenotify_client_t* client,
    const char* channel_id,
    const char* name,
    const char* type,
    const char* description,
    securenotify_error_t* error
) {
    (void)error;

    if (!client || !name || !type) return NULL;

    char body[1024];
    if (channel_id && description) {
        snprintf(body, sizeof(body),
                 "{\"name\":\"%s\",\"type\":\"%s\",\"description\":\"%s\"}",
                 name, type, description);
    } else if (channel_id) {
        snprintf(body, sizeof(body),
                 "{\"name\":\"%s\",\"type\":\"%s\"}", name, type);
    } else if (description) {
        snprintf(body, sizeof(body),
                 "{\"name\":\"%s\",\"type\":\"%s\",\"description\":\"%s\"}",
                 name, type, description);
    } else {
        snprintf(body, sizeof(body),
                 "{\"name\":\"%s\",\"type\":\"%s\"}", name, type);
    }

    char* response = NULL;
    int status = http_post(client, "api/channels", body, &response);

    if (status != 200 && status != 201) {
        free(response);
        return NULL;
    }

    securenotify_channel_t* channel = malloc(sizeof(securenotify_channel_t));
    if (!channel) {
        free(response);
        return NULL;
    }

    memset(channel, 0, sizeof(securenotify_channel_t));

    parse_json_string(response, "id", &channel->id);
    parse_json_string(response, "name", &channel->name);
    parse_json_string(response, "description", &channel->description);
    parse_json_string(response, "type", &channel->type);
    parse_json_string(response, "creator", &channel->creator);

    char* created_at = NULL;
    if (parse_json_string(response, "createdAt", &created_at)) {
        channel->created_at = strtoll(created_at, NULL, 10);
        free(created_at);
    }

    char* expires_at = NULL;
    if (parse_json_string(response, "expiresAt", &expires_at)) {
        channel->expires_at = strtoll(expires_at, NULL, 10);
        free(expires_at);
    }

    parse_json_bool(response, "isActive", &channel->is_active);

    free(response);
    return channel;
}

securenotify_channel_t* securenotify_channels_get(
    securenotify_client_t* client,
    const char* channel_id,
    securenotify_error_t* error
) {
    (void)error;

    if (!client || !channel_id) return NULL;

    char endpoint[256];
    snprintf(endpoint, sizeof(endpoint), "api/channels/%s", channel_id);

    char* response = NULL;
    int status = http_get(client, endpoint, &response);

    if (status != 200) {
        free(response);
        return NULL;
    }

    securenotify_channel_t* channel = malloc(sizeof(securenotify_channel_t));
    if (!channel) {
        free(response);
        return NULL;
    }

    memset(channel, 0, sizeof(securenotify_channel_t));

    parse_json_string(response, "id", &channel->id);
    parse_json_string(response, "name", &channel->name);
    parse_json_string(response, "description", &channel->description);
    parse_json_string(response, "type", &channel->type);
    parse_json_string(response, "creator", &channel->creator);

    char* created_at = NULL;
    if (parse_json_string(response, "createdAt", &created_at)) {
        channel->created_at = strtoll(created_at, NULL, 10);
        free(created_at);
    }

    char* expires_at = NULL;
    if (parse_json_string(response, "expiresAt", &expires_at)) {
        channel->expires_at = strtoll(expires_at, NULL, 10);
        free(expires_at);
    }

    parse_json_bool(response, "isActive", &channel->is_active);

    free(response);
    return channel;
}

securenotify_channel_list_t* securenotify_channels_list(
    securenotify_client_t* client,
    const char* type,
    uint32_t limit,
    uint32_t offset,
    securenotify_error_t* error
) {
    (void)error;

    if (!client) return NULL;

    char endpoint[256];
    if (type || limit > 0 || offset > 0) {
        snprintf(endpoint, sizeof(endpoint), "api/channels?type=%s&limit=%u&offset=%u",
                 type ? type : "", limit, offset);
    } else {
        snprintf(endpoint, sizeof(endpoint), "api/channels");
    }

    char* response = NULL;
    int status = http_get(client, endpoint, &response);

    if (status != 200) {
        free(response);
        return NULL;
    }

    securenotify_channel_list_t* list = malloc(sizeof(securenotify_channel_list_t));
    if (!list) {
        free(response);
        return NULL;
    }

    list->channels = NULL;
    list->count = 0;

    free(response);
    return list;
}

bool securenotify_channels_delete(
    securenotify_client_t* client,
    const char* channel_id,
    securenotify_error_t* error
) {
    (void)error;

    if (!client || !channel_id) return false;

    char endpoint[256];
    snprintf(endpoint, sizeof(endpoint), "api/channels/%s", channel_id);

    int status = http_delete(client, endpoint);
    return (status == 200 || status == 204);
}

void securenotify_channel_free(securenotify_channel_t* channel) {
    if (!channel) return;

    if (channel->id) free(channel->id);
    if (channel->name) free(channel->name);
    if (channel->description) free(channel->description);
    if (channel->type) free(channel->type);
    if (channel->creator) free(channel->creator);

    free(channel);
}

void securenotify_channel_list_free(securenotify_channel_list_t* list) {
    if (!list) return;

    if (list->channels) {
        for (size_t i = 0; i < list->count; i++) {
            if (list->channels[i]) {
                securenotify_channel_free(list->channels[i]);
            }
        }
        free(list->channels);
    }

    free(list);
}

/* ========== Message Publishing ========== */

securenotify_message_result_t* securenotify_publish_send(
    securenotify_client_t* client,
    const char* channel,
    const char* message,
    securenotify_priority_t priority,
    const char* sender,
    bool encrypted,
    securenotify_error_t* error
) {
    (void)error;

    if (!client || !channel || !message) return NULL;

    char body[8192];
    const char* priority_str = "NORMAL";

    switch (priority) {
        case SECURENOTIFY_PRIORITY_CRITICAL: priority_str = "CRITICAL"; break;
        case SECURENOTIFY_PRIORITY_HIGH: priority_str = "HIGH"; break;
        case SECURENOTIFY_PRIORITY_NORMAL: priority_str = "NORMAL"; break;
        case SECURENOTIFY_PRIORITY_LOW: priority_str = "LOW"; break;
        case SECURENOTIFY_PRIORITY_BULK: priority_str = "BULK"; break;
    }

    if (sender) {
        snprintf(body, sizeof(body),
                 "{\"message\":\"%s\",\"priority\":\"%s\",\"sender\":\"%s\",\"encrypted\":%s}",
                 message, priority_str, sender, encrypted ? "true" : "false");
    } else {
        snprintf(body, sizeof(body),
                 "{\"message\":\"%s\",\"priority\":\"%s\",\"encrypted\":%s}",
                 message, priority_str, encrypted ? "true" : "false");
    }

    char endpoint[256];
    snprintf(endpoint, sizeof(endpoint), "api/publish/%s", channel);

    char* response = NULL;
    int status = http_post(client, endpoint, body, &response);

    if (status < 0 || status >= 300) {
        free(response);
        return NULL;
    }

    securenotify_message_result_t* result = malloc(sizeof(securenotify_message_result_t));
    if (!result) {
        free(response);
        return NULL;
    }

    memset(result, 0, sizeof(securenotify_message_result_t));

    parse_json_string(response, "messageId", &result->message_id);
    parse_json_string(response, "channel", &result->channel);

    char* timestamp = NULL;
    if (parse_json_string(response, "timestamp", &timestamp)) {
        result->published_at = strtoll(timestamp, NULL, 10);
        free(timestamp);
    }

    parse_json_bool(response, "autoCreated", &result->auto_created);

    free(response);
    return result;
}

securenotify_message_t* securenotify_publish_get(
    securenotify_client_t* client,
    const char* channel,
    const char* message_id,
    securenotify_error_t* error
) {
    (void)error;

    if (!client || !channel || !message_id) return NULL;

    char endpoint[256];
    snprintf(endpoint, sizeof(endpoint), "api/publish/%s/%s", channel, message_id);

    char* response = NULL;
    int status = http_get(client, endpoint, &response);

    if (status != 200) {
        free(response);
        return NULL;
    }

    securenotify_message_t* message = malloc(sizeof(securenotify_message_t));
    if (!message) {
        free(response);
        return NULL;
    }

    memset(message, 0, sizeof(securenotify_message_t));

    parse_json_string(response, "id", &message->id);
    parse_json_string(response, "channel", &message->channel);
    parse_json_string(response, "message", &message->message);
    parse_json_string(response, "sender", &message->sender);

    char* created_at = NULL;
    if (parse_json_string(response, "createdAt", &created_at)) {
        message->created_at = strtoll(created_at, NULL, 10);
        free(created_at);
    }

    parse_json_bool(response, "encrypted", &message->encrypted);

    free(response);
    return message;
}

securenotify_string_t* securenotify_publish_queue_status(
    securenotify_client_t* client,
    const char* channel,
    securenotify_error_t* error
) {
    (void)error;

    if (!client || !channel) return NULL;

    char endpoint[256];
    snprintf(endpoint, sizeof(endpoint), "api/publish/%s?status=true", channel);

    char* response = NULL;
    int status = http_get(client, endpoint, &response);

    securenotify_string_t* str = malloc(sizeof(securenotify_string_t));
    if (!str) {
        free(response);
        return NULL;
    }

    if (status == 200 && response) {
        str->data = response;
        str->length = strlen(response);
    } else {
        str->data = strdup("{}");
        str->length = 2;
    }

    return str;
}

void securenotify_message_result_free(securenotify_message_result_t* result) {
    if (!result) return;

    if (result->message_id) free(result->message_id);
    if (result->channel) free(result->channel);

    free(result);
}

void securenotify_message_free(securenotify_message_t* message) {
    if (!message) return;

    if (message->id) free(message->id);
    if (message->channel) free(message->channel);
    if (message->message) free(message->message);
    if (message->sender) free(message->sender);

    free(message);
}

void securenotify_message_list_free(securenotify_message_list_t* list) {
    if (!list) return;

    if (list->messages) {
        for (size_t i = 0; i < list->count; i++) {
            if (list->messages[i]) {
                securenotify_message_free(list->messages[i]);
            }
        }
        free(list->messages);
    }

    free(list);
}

/* ========== Real-Time Subscriptions ========== */

static void* subscription_thread(void* arg) {
    securenotify_subscription_t* sub = (securenotify_subscription_t*)arg;
    if (!sub) return NULL;

    pthread_mutex_lock(&sub->mutex);
    sub->status = SECURENOTIFY_SUBSCRIPTION_CONNECTING;
    pthread_mutex_unlock(&sub->mutex);

    /* TODO: Implement SSE connection using libcurl
     * For now, just notify that we're connecting */
    if (sub->on_connected) {
        sub->on_connected(sub->channel, sub->user_data);
    }

    pthread_mutex_lock(&sub->mutex);
    sub->status = SECURENOTIFY_SUBSCRIPTION_ACTIVE;

    while (!sub->should_stop) {
        pthread_cond_wait(&sub->cond, &sub->mutex);
    }

    sub->status = SECURENOTIFY_SUBSCRIPTION_INACTIVE;
    pthread_mutex_unlock(&sub->mutex);

    return NULL;
}

securenotify_subscription_t* securenotify_subscribe(
    securenotify_client_t* client,
    const char* channel,
    securenotify_message_callback_t on_message,
    securenotify_connected_callback_t on_connected,
    securenotify_error_callback_t on_error,
    securenotify_heartbeat_callback_t on_heartbeat,
    void* user_data,
    securenotify_error_t* error
) {
    (void)error;

    if (!client || !channel || !on_message) return NULL;

    securenotify_subscription_t* sub = malloc(sizeof(securenotify_subscription_t));
    if (!sub) return NULL;

    memset(sub, 0, sizeof(securenotify_subscription_t));

    sub->client = client;
    sub->channel = strdup(channel);
    sub->on_message = on_message;
    sub->on_connected = on_connected;
    sub->on_error = on_error;
    sub->on_heartbeat = on_heartbeat;
    sub->user_data = user_data;
    sub->status = SECURENOTIFY_SUBSCRIPTION_INACTIVE;
    sub->running = false;
    sub->should_stop = false;

    pthread_mutex_init(&sub->mutex, NULL);
    pthread_cond_init(&sub->cond, NULL);

    /* Start subscription thread */
    pthread_mutex_lock(&sub->mutex);
    int result = pthread_create(&sub->thread, NULL, subscription_thread, sub);
    if (result == 0) {
        sub->running = true;
    }
    pthread_mutex_unlock(&sub->mutex);

    if (!sub->running) {
        if (sub->channel) free(sub->channel);
        pthread_mutex_destroy(&sub->mutex);
        pthread_cond_destroy(&sub->cond);
        free(sub);
        return NULL;
    }

    return sub;
}

int securenotify_unsubscribe(securenotify_subscription_t* subscription, securenotify_error_t* error) {
    (void)error;

    if (!subscription) return -1;

    pthread_mutex_lock(&subscription->mutex);

    if (!subscription->running) {
        pthread_mutex_unlock(&subscription->mutex);
        return 0;
    }

    subscription->should_stop = true;
    pthread_cond_signal(&subscription->cond);
    pthread_mutex_unlock(&subscription->mutex);

    pthread_join(subscription->thread, NULL);

    pthread_mutex_lock(&subscription->mutex);
    subscription->running = false;
    subscription->status = SECURENOTIFY_SUBSCRIPTION_INACTIVE;
    pthread_mutex_unlock(&subscription->mutex);

    return 0;
}

securenotify_subscription_status_t securenotify_subscription_get_status(
    securenotify_subscription_t* subscription
) {
    if (!subscription) return SECURENOTIFY_SUBSCRIPTION_INACTIVE;

    pthread_mutex_lock(&subscription->mutex);
    securenotify_subscription_status_t status = subscription->status;
    pthread_mutex_unlock(&subscription->mutex);

    return status;
}

void securenotify_subscription_free(securenotify_subscription_t* subscription) {
    if (!subscription) return;

    securenotify_unsubscribe(subscription, NULL);

    if (subscription->channel) {
        free(subscription->channel);
    }

    pthread_mutex_destroy(&subscription->mutex);
    pthread_cond_destroy(&subscription->cond);

    free(subscription);
}

/* ========== API Key Management ========== */

securenotify_api_key_t* securenotify_api_keys_create(
    securenotify_client_t* client,
    const char* name,
    const char* permissions,
    int32_t expires_in_seconds,
    securenotify_error_t* error
) {
    (void)error;

    if (!client || !name) return NULL;

    char body[1024];
    if (expires_in_seconds > 0) {
        snprintf(body, sizeof(body),
                 "{\"name\":\"%s\",\"permissions\":%s,\"expiresIn\":%d}",
                 name, permissions ? permissions : "[]", expires_in_seconds);
    } else {
        snprintf(body, sizeof(body),
                 "{\"name\":\"%s\",\"permissions\":%s}",
                 name, permissions ? permissions : "[]");
    }

    char* response = NULL;
    int status = http_post(client, "api/keys", body, &response);

    if (status != 200 && status != 201) {
        free(response);
        return NULL;
    }

    securenotify_api_key_t* key = malloc(sizeof(securenotify_api_key_t));
    if (!key) {
        free(response);
        return NULL;
    }

    memset(key, 0, sizeof(securenotify_api_key_t));

    parse_json_string(response, "id", &key->id);
    parse_json_string(response, "keyPrefix", &key->key_prefix);
    parse_json_string(response, "name", &key->name);

    char* created_at = NULL;
    if (parse_json_string(response, "createdAt", &created_at)) {
        key->created_at = strtoll(created_at, NULL, 10);
        free(created_at);
    }

    char* expires_at = NULL;
    if (parse_json_string(response, "expiresAt", &expires_at)) {
        key->expires_at = strtoll(expires_at, NULL, 10);
        free(expires_at);
    }

    key->is_active = true;
    key->permissions_count = 0;
    key->permissions = NULL;

    free(response);
    return key;
}

securenotify_api_key_list_t* securenotify_api_keys_list(
    securenotify_client_t* client,
    securenotify_error_t* error
) {
    (void)error;

    if (!client) return NULL;

    char* response = NULL;
    int status = http_get(client, "api/keys", &response);

    if (status != 200) {
        free(response);
        return NULL;
    }

    securenotify_api_key_list_t* list = malloc(sizeof(securenotify_api_key_list_t));
    if (!list) {
        free(response);
        return NULL;
    }

    list->keys = NULL;
    list->count = 0;

    free(response);
    return list;
}

bool securenotify_api_keys_revoke(
    securenotify_client_t* client,
    const char* key_id,
    securenotify_error_t* error
) {
    (void)error;

    if (!client || !key_id) return false;

    char endpoint[256];
    snprintf(endpoint, sizeof(endpoint), "api/keys/%s", key_id);

    int status = http_delete(client, endpoint);
    return (status == 200 || status == 204);
}

void securenotify_api_key_free(securenotify_api_key_t* key) {
    if (!key) return;

    if (key->id) free(key->id);
    if (key->key_prefix) free(key->key_prefix);
    if (key->name) free(key->name);

    if (key->permissions) {
        for (size_t i = 0; i < key->permissions_count; i++) {
            if (key->permissions[i]) free(key->permissions[i]);
        }
        free(key->permissions);
    }

    free(key);
}

void securenotify_api_key_list_free(securenotify_api_key_list_t* list) {
    if (!list) return;

    if (list->keys) {
        for (size_t i = 0; i < list->count; i++) {
            if (list->keys[i]) {
                securenotify_api_key_free(list->keys[i]);
            }
        }
        free(list->keys);
    }

    free(list);
}

/* ========== Utility Functions ========== */

void securenotify_string_free(securenotify_string_t* string) {
    if (!string) return;

    if (string->data) {
        free(string->data);
    }

    free(string);
}

const char* securenotify_version(void) {
    static char version[32];
    snprintf(version, sizeof(version), "%d.%d.%d",
             SECURENOTIFY_VERSION_MAJOR,
             SECURENOTIFY_VERSION_MINOR,
             SECURENOTIFY_VERSION_PATCH);
    return version;
}

const char* securenotify_build_info(void) {
    return "SecureNotify C SDK " SECURENOTIFY_VERSION_STRING
           " (libcurl/" LIBCURL_VERSION ")";
}
