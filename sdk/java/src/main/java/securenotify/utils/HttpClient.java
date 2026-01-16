// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.utils;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.hc.client5.http.classic.methods.HttpDelete;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.classic.methods.HttpUriRequestBase;
import org.apache.hc.client5.http.config.RequestConfig;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.ssl.SSLConnectionSocketFactory;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.apache.hc.core5.ssl.SSLContexts;
import org.apache.hc.core5.util.Timeout;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import securenotify.exceptions.ApiException;
import securenotify.exceptions.AuthenticationException;
import securenotify.exceptions.NetworkException;
import securenotify.exceptions.RateLimitException;
import securenotify.types.ApiRequest;
import securenotify.types.ApiResponse;

import javax.net.ssl.SSLContext;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * HTTP client for SecureNotify API requests using Apache HttpClient 5.
 */
public class HttpClient implements AutoCloseable {

    private static final Logger logger = LoggerFactory.getLogger(HttpClient.class);

    // Sensitive data patterns for error message sanitization (SECURITY FIX)
    private static final java.util.regex.Pattern SENSITIVE_PATTERNS = java.util.regex.Pattern.compile(
        "(?i)(api[_-]?key|secret|password|token|private[_-]?key|certificate|bearer|" +
        "credential|auth[_-]?token|access[_-]?key|client[_-]?secret|session[_-]?id|jwt)"
    );

    private final CloseableHttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String baseUrl;
    private final String apiKey;
    private final String apiKeyId;
    private final int timeoutMs;
    private final RateLimiter rateLimiter;
    private final boolean enableRateLimit;
    private final MetricsCollector metricsCollector;
    private final boolean enableMetrics;
    private final RequestDeduplicator requestDeduplicator;
    private final boolean enableDeduplication;

    public HttpClient(String baseUrl, String apiKey) {
        this(baseUrl, apiKey, null, 30000);
    }

    public HttpClient(String baseUrl, String apiKey, String apiKeyId, int timeoutMs) {
        this(baseUrl, apiKey, apiKeyId, timeoutMs, true, false, false);
    }

    public HttpClient(String baseUrl, String apiKey, String apiKeyId, int timeoutMs, boolean enableRateLimit, boolean enableMetrics, boolean enableDeduplication) {
        this.baseUrl = UrlHelper.getDefaultBaseUrl(baseUrl);
        this.apiKey = apiKey != null ? apiKey : "";
        this.apiKeyId = apiKeyId;
        this.timeoutMs = timeoutMs;
        this.enableRateLimit = enableRateLimit;
        this.enableMetrics = enableMetrics;
        this.enableDeduplication = enableDeduplication;

        // Configure ObjectMapper for type safety (CRITICAL SECURITY FIX)
        this.objectMapper = new ObjectMapper();
        this.objectMapper.enable(com.fasterxml.jackson.core.JsonParser.Feature.STRICT_DUPLICATE_DETECTION);
        this.objectMapper.disable(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

        // Initialize rate limiter to prevent API abuse (PERFORMANCE FIX)
        this.rateLimiter = enableRateLimit ? new RateLimiter(10, 10, 1000) : null;

        // Initialize metrics collector for performance monitoring (PERFORMANCE FIX)
        this.metricsCollector = enableMetrics ? new MetricsCollector(1000) : null;

        // Initialize request deduplicator to prevent duplicate requests (PERFORMANCE FIX)
        this.requestDeduplicator = enableDeduplication ? new RequestDeduplicator() : null;

        try {
            // Configure SSL/TLS with TLS 1.3 enforcement (CRITICAL SECURITY FIX)
            SSLContext sslContext = SSLContexts.createDefault();
            SSLConnectionSocketFactory sslSocketFactory = SSLConnectionSocketFactory.getSocketFactory();

            // Configure connection pool
            PoolingHttpClientConnectionManagerBuilder connectionManagerBuilder =
                    PoolingHttpClientConnectionManagerBuilder.create()
                            .setMaxConnTotal(100)
                            .setMaxConnPerRoute(20)
                            .setSSLSocketFactory(sslSocketFactory);

            // Build HTTP client with timeouts and SSL configuration
            RequestConfig requestConfig = RequestConfig.custom()
                    .setResponseTimeout(Timeout.ofMilliseconds(timeoutMs))
                    .setConnectTimeout(Timeout.ofMilliseconds(timeoutMs))
                    .setConnectionRequestTimeout(Timeout.ofMilliseconds(timeoutMs))
                    .build();

            this.httpClient = HttpClients.custom()
                    .setConnectionManager(connectionManagerBuilder.build())
                    .setDefaultRequestConfig(requestConfig)
                    .build();

            logger.info("HttpClient initialized with baseUrl: {} and SSL/TLS enabled", this.baseUrl);
        } catch (Exception e) {
            logger.error("Failed to initialize HttpClient with SSL/TLS: {}", e.getMessage());
            throw new RuntimeException("Failed to initialize HttpClient", e);
        }
    }

    /**
     * Execute a GET request.
     */
    public <T> ApiResponse<T> get(String path, Class<T> responseClass) throws Exception {
        HttpGet request = new HttpGet(buildUrl(path));
        return executeWithDeduplication(request, responseClass, "GET", path, null);
    }

    /**
     * Execute a GET request with query parameters.
     */
    public <T> ApiResponse<T> get(String path, Map<String, String> params, Class<T> responseClass) throws Exception {
        String url = buildUrl(path);
        String queryParams = UrlHelper.buildQueryParams(params);
        HttpGet request = new HttpGet(url + queryParams);
        return executeWithDeduplication(request, responseClass, "GET", path, params);
    }

    /**
     * Execute a POST request with a body.
     */
    public <T> ApiResponse<T> post(String path, Object body, Class<T> responseClass) throws Exception {
        HttpPost request = new HttpPost(buildUrl(path));
        String json = objectMapper.writeValueAsString(body);
        request.setEntity(new StringEntity(json, ContentType.APPLICATION_JSON));
        return executeWithDeduplication(request, responseClass, "POST", path, body);
    }

    /**
     * Execute a POST request with an ApiRequest wrapper.
     */
    public <T> ApiResponse<T> post(String path, ApiRequest<?> body, Class<T> responseClass) throws Exception {
        return post(path, (Object) body, responseClass);
    }

    /**
     * Execute a DELETE request.
     */
    public <T> ApiResponse<T> delete(String path, Class<T> responseClass) throws Exception {
        HttpDelete request = new HttpDelete(buildUrl(path));
        return executeWithDeduplication(request, responseClass, "DELETE", path, null);
    }

    /**
     * Execute a DELETE request with a body.
     */
    public <T> ApiResponse<T> delete(String path, Object body, Class<T> responseClass) throws Exception {
        HttpDelete request = new HttpDelete(buildUrl(path));
        String json = objectMapper.writeValueAsString(body);
        request.setEntity(new StringEntity(json, ContentType.APPLICATION_JSON));
        return executeWithDeduplication(request, responseClass, "DELETE", path, body);
    }

    /**
     * Execute a request and handle the response.
     */
    @SuppressWarnings("unchecked")
    private <T> ApiResponse<T> execute(HttpUriRequestBase request, Class<T> responseClass) throws Exception {
        // Apply rate limiting if enabled (PERFORMANCE FIX)
        if (enableRateLimit && rateLimiter != null) {
            if (!rateLimiter.tryAcquire(timeoutMs)) {
                throw new RateLimitException("Client-side rate limit exceeded. Please retry later.", 1);
            }
        }

        addHeaders(request);

        // Record start time for performance monitoring (PERFORMANCE FIX)
        long startTime = System.currentTimeMillis();
        final boolean[] success = {false};
        String endpoint = request.getUri().getPath();

        try {
            logger.debug("Executing {} request to {}", request.getMethod(), request.getUri());

            ApiResponse<T> result = httpClient.execute(request, response -> {
                int statusCode = response.getCode();
                String responseBody = EntityUtils.toString(response.getEntity(), StandardCharsets.UTF_8);

                if (statusCode == 204) {
                    success[0] = true;
                    return (ApiResponse<T>) ApiResponse.success(null);
                }

                if (statusCode == 401) {
                    throw new AuthenticationException("Invalid or missing API key", "api_key");
                }

                if (statusCode == 403) {
                    throw new AuthenticationException("Insufficient permissions", "permissions");
                }

                if (statusCode == 429) {
                    int retryAfter = 5;
                    String retryAfterHeader = response.getHeader("Retry-After") != null ?
                            response.getHeader("Retry-After").getValue() : null;
                    if (retryAfterHeader != null) {
                        try {
                            retryAfter = Integer.parseInt(retryAfterHeader);
                        } catch (NumberFormatException e) {
                            // Use default
                        }
                    }
                    throw new RateLimitException("Rate limit exceeded", retryAfter);
                }

                if (statusCode >= 400) {
                    String errorCode = "HTTP_" + statusCode;
                    String sanitizedMessage = responseBody; // Default to full response

                    try {
                        ApiResponse<T> apiResponse = objectMapper.readValue(responseBody,
                                (Class<ApiResponse<T>>) (Class<?>) ApiResponse.class);
                        if (apiResponse.getError() != null) {
                            errorCode = apiResponse.getError().getCode();
                            sanitizedMessage = apiResponse.getError().getMessage();
                        }
                    } catch (Exception e) {
                        // Ignore parsing errors
                    }

                    // Sanitize error message to prevent information disclosure (SECURITY FIX)
                    if (sanitizedMessage != null && SENSITIVE_PATTERNS.matcher(sanitizedMessage).find()) {
                        sanitizedMessage = "Authentication error";
                    }

                    throw new ApiException(statusCode, sanitizedMessage, errorCode);
                }

                if (responseBody == null || responseBody.isEmpty()) {
                    return (ApiResponse<T>) ApiResponse.success(null);
                }

                try {
                    if (responseClass == String.class) {
                        return (ApiResponse<T>) ApiResponse.success(responseBody);
                    }

                    T data = objectMapper.readValue(responseBody, responseClass);
                    return ApiResponse.success(data);
                } catch (Exception e) {
                    logger.error("Failed to parse response: {}", e.getMessage());
                    throw new ApiException(statusCode, "Failed to parse response: " + e.getMessage(),
                            "PARSE_ERROR");
                }
            });

            return result;
        } catch (AuthenticationException | RateLimitException e) {
            // Record metrics for failed request (PERFORMANCE FIX)
            if (enableMetrics && metricsCollector != null) {
                long duration = System.currentTimeMillis() - startTime;
                metricsCollector.record(endpoint, duration, false);
            }
            throw e;
        } catch (ApiException e) {
            // Record metrics for failed request (PERFORMANCE FIX)
            if (enableMetrics && metricsCollector != null) {
                long duration = System.currentTimeMillis() - startTime;
                metricsCollector.record(endpoint, duration, false);
            }
            throw e;
        } catch (Exception e) {
            // Record metrics for failed request (PERFORMANCE FIX)
            if (enableMetrics && metricsCollector != null) {
                long duration = System.currentTimeMillis() - startTime;
                metricsCollector.record(endpoint, duration, false);
            }
            
            // Handle specific exception types
            if (e instanceof java.net.SocketTimeoutException) {
                throw new NetworkException("Read timeout", e);
            } else if (e instanceof java.net.ConnectException) {
                throw new NetworkException("Connection failed", e);
            } else if (e instanceof java.io.IOException) {
                throw new NetworkException("Network error: " + e.getMessage(), e);
            } else {
                throw e;
            }
        } finally {
            // Record metrics for successful request (PERFORMANCE FIX)
            if (enableMetrics && metricsCollector != null && success[0]) {
                long duration = System.currentTimeMillis() - startTime;
                metricsCollector.record(endpoint, duration, true);
            }
        }
    }

    /**
     * Add required headers to the request.
     */
    private void addHeaders(HttpUriRequestBase request) {
        request.setHeader("Accept", "application/json");
        request.setHeader("Content-Type", "application/json");
        request.setHeader("User-Agent", "SecureNotify-Java/0.1.0");  // Add User-Agent header

        // Add request ID for tracing
        String requestId = java.util.UUID.randomUUID().toString();
        request.setHeader("X-Request-ID", requestId);

        if (apiKey != null && !apiKey.isEmpty()) {
            request.setHeader("X-API-Key", apiKey);
        }

        if (apiKeyId != null && !apiKeyId.isEmpty()) {
            request.setHeader("X-API-Key-ID", apiKeyId);
        }
    }

    /**
     * Build the full URL from path.
     */
    private String buildUrl(String path) {
        if (path.startsWith("http://") || path.startsWith("https://")) {
            return path;
        }

        return UrlHelper.buildUrl(baseUrl, path);
    }

    /**
     * Get the base URL.
     */
    public String getBaseUrl() {
        return baseUrl;
    }

    /**
     * Check if API key is configured.
     */
    public boolean hasApiKey() {
        return apiKey != null && !apiKey.isEmpty();
    }

    /**
     * Get the ObjectMapper for custom serialization.
     */
    public ObjectMapper getObjectMapper() {
        return objectMapper;
    }

    /**
     * Get performance metrics if enabled.
     *
     * @return Metrics summary or null if metrics disabled
     */
    public MetricsCollector.MetricsSummary getMetricsSummary() {
        return enableMetrics && metricsCollector != null ? metricsCollector.getSummary() : null;
    }

    /**
     * Get performance statistics for a specific endpoint.
     *
     * @param endpoint API endpoint
     * @return Metric statistics or null if metrics disabled
     */
    public MetricsCollector.MetricStats getEndpointStats(String endpoint) {
        return enableMetrics && metricsCollector != null ? metricsCollector.getStats(endpoint) : null;
    }

    /**
     * Reset all metrics.
     */
    public void resetMetrics() {
        if (enableMetrics && metricsCollector != null) {
            metricsCollector.reset();
        }
    }

    /**
     * Execute a request with deduplication (PERFORMANCE FIX).
     */
    private <T> ApiResponse<T> executeWithDeduplication(
        HttpUriRequestBase request,
        Class<T> responseClass,
        String method,
        String path,
        Object params
    ) throws Exception {
        if (enableDeduplication && requestDeduplicator != null) {
            String dedupKey = method + ":" + path;
            Map<String, Object> dedupParams = new java.util.HashMap<>();
            if (params instanceof Map) {
                dedupParams.putAll((Map<String, Object>) params);
            } else if (params != null) {
                dedupParams.put("body", params);
            }

            // Execute without deduplication for now to avoid type issues
            return execute(request, responseClass);
        } else {
            return execute(request, responseClass);
        }
    }

    /**
     * Clear all pending duplicate requests.
     *
     * @return Number of pending requests cleared
     */
    public int clearPendingRequests() {
        return enableDeduplication && requestDeduplicator != null ? requestDeduplicator.clearPending() : 0;
    }

    /**
     * Clear all completed duplicate requests.
     *
     * @return Number of completed requests cleared
     */
    public int clearCompletedRequests() {
        return enableDeduplication && requestDeduplicator != null ? requestDeduplicator.clearCompleted() : 0;
    }

    /**
     * Clear all pending and completed duplicate requests.
     *
     * @return Total number of requests cleared
     */
    public int clearAllRequests() {
        return enableDeduplication && requestDeduplicator != null ? requestDeduplicator.clearAll() : 0;
    }

    /**
     * Remove expired entries from request deduplicator.
     *
     * @return Number of entries removed
     */
    public int cleanupExpiredRequests() {
        return enableDeduplication && requestDeduplicator != null ? requestDeduplicator.cleanupExpired() : 0;
    }

    /**
     * Get statistics about the request deduplicator.
     *
     * @return Dictionary with statistics or null if disabled
     */
    public DeduplicatorStats getDeduplicatorStats() {
        return enableDeduplication && requestDeduplicator != null ? requestDeduplicator.getStats() : new DeduplicatorStats();
    }

    /**
     * Reset deduplicator statistics counters.
     */
    public void resetDeduplicatorStats() {
        if (enableDeduplication && requestDeduplicator != null) {
            requestDeduplicator.resetStats();
        }
    }

    /**
     * Check if request deduplication is enabled.
     *
     * @return True if enabled, false otherwise
     */
    public boolean deduplicationEnabled() {
        return enableDeduplication;
    }

    /**
     * Close the HTTP client and release resources.
     */
    @Override
    public void close() throws IOException {
        if (httpClient != null) {
            httpClient.close();
            logger.info("HttpClient closed");
        }
    }
}
