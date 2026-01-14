// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.utils;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.hc.client5.http.classic.methods.HttpDelete;
import org.apache.hc.client5.http.classic.methods.HttpGet;
import org.apache.hc.client5.http.classic.methods.HttpPost;
import org.apache.hc.client5.http.classic.methods.HttpRequestBase;
import org.apache.hc.client5.http.impl.classic.CloseableHttpClient;
import org.apache.hc.client5.http.impl.classic.HttpClients;
import org.apache.hc.client5.http.impl.io.PoolingHttpClientConnectionManagerBuilder;
import org.apache.hc.client5.http.impl.timeout.ConnectTimeoutBuilder;
import org.apache.hc.client5.http.impl.timeout.RequestTimeoutBuilder;
import org.apache.hc.core5.http.ContentType;
import org.apache.hc.core5.http.io.entity.EntityUtils;
import org.apache.hc.core5.http.io.entity.StringEntity;
import org.apache.hc.core5.util.Timeout;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import securenotify.exceptions.ApiException;
import securenotify.exceptions.AuthenticationException;
import securenotify.exceptions.NetworkException;
import securenotify.exceptions.RateLimitException;
import securenotify.types.ApiRequest;
import securenotify.types.ApiResponse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * HTTP client for SecureNotify API requests using Apache HttpClient 5.
 */
public class HttpClient implements AutoCloseable {

    private static final Logger logger = LoggerFactory.getLogger(HttpClient.class);

    private final CloseableHttpClient httpClient;
    private final ObjectMapper objectMapper;
    private final String baseUrl;
    private final String apiKey;
    private final String apiKeyId;
    private final int timeoutMs;

    public HttpClient(String baseUrl, String apiKey) {
        this(baseUrl, apiKey, null, 30000);
    }

    public HttpClient(String baseUrl, String apiKey, String apiKeyId, int timeoutMs) {
        this.baseUrl = baseUrl != null && !baseUrl.isEmpty() ? baseUrl : "https://api.securenotify.dev";
        this.apiKey = apiKey != null ? apiKey : "";
        this.apiKeyId = apiKeyId;
        this.timeoutMs = timeoutMs;
        this.objectMapper = new ObjectMapper();

        // Configure connection pool
        PoolingHttpClientConnectionManagerBuilder connectionManagerBuilder =
                PoolingHttpClientConnectionManagerBuilder.create()
                        .setMaxConnTotal(100)
                        .setMaxConnPerRoute(20);

        // Build HTTP client with timeouts
        this.httpClient = HttpClients.custom()
                .setConnectionManager(connectionManagerBuilder.build())
                .setDefaultRequestConfig(
                        org.apache.hc.client5.http.config.RequestConfig.custom()
                                .setResponseTimeout(Timeout.ofMilliseconds(timeoutMs))
                                .setConnectTimeout(ConnectTimeoutBuilder.create()
                                        .setTimeout(Timeout.ofMilliseconds(timeoutMs))
                                        .build())
                                .setConnectionRequestTimeout(RequestTimeoutBuilder.create()
                                        .setTimeout(Timeout.ofMilliseconds(timeoutMs))
                                        .build())
                                .build())
                .build();

        logger.info("HttpClient initialized with baseUrl: {}", this.baseUrl);
    }

    /**
     * Execute a GET request.
     */
    public <T> ApiResponse<T> get(String path, Class<T> responseClass) throws Exception {
        HttpGet request = new HttpGet(buildUrl(path));
        return execute(request, responseClass);
    }

    /**
     * Execute a GET request with query parameters.
     */
    public <T> ApiResponse<T> get(String path, Map<String, String> params, Class<T> responseClass) throws Exception {
        String url = buildUrl(path);
        if (params != null && !params.isEmpty()) {
            String query = params.entrySet().stream()
                    .map(e -> e.getKey() + "=" + e.getValue())
                    .reduce((a, b) -> a + "&" + b)
                    .orElse("");
            url += "?" + query;
        }
        HttpGet request = new HttpGet(url);
        return execute(request, responseClass);
    }

    /**
     * Execute a POST request with a body.
     */
    public <T> ApiResponse<T> post(String path, Object body, Class<T> responseClass) throws Exception {
        HttpPost request = new HttpPost(buildUrl(path));
        String json = objectMapper.writeValueAsString(body);
        request.setEntity(new StringEntity(json, ContentType.APPLICATION_JSON));
        return execute(request, responseClass);
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
        return execute(request, responseClass);
    }

    /**
     * Execute a DELETE request with a body.
     */
    public <T> ApiResponse<T> delete(String path, Object body, Class<T> responseClass) throws Exception {
        HttpDelete request = new HttpDelete(buildUrl(path));
        String json = objectMapper.writeValueAsString(body);
        request.setEntity(new StringEntity(json, ContentType.APPLICATION_JSON));
        return execute(request, responseClass);
    }

    /**
     * Execute a request and handle the response.
     */
    @SuppressWarnings("unchecked")
    private <T> ApiResponse<T> execute(HttpRequestBase request, Class<T> responseClass) throws Exception {
        addHeaders(request);

        try {
            logger.debug("Executing {} request to {}", request.getMethod(), request.getUri());

            return httpClient.execute(request, response -> {
                int statusCode = response.getCode();
                String responseBody = EntityUtils.toString(response.getEntity(), StandardCharsets.UTF_8);

                if (statusCode == 204) {
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
                    try {
                        ApiResponse<T> apiResponse = objectMapper.readValue(responseBody,
                                (Class<ApiResponse<T>>) (Class<?>) ApiResponse.class);
                        if (apiResponse.getError() != null) {
                            errorCode = apiResponse.getError().getCode();
                        }
                    } catch (Exception e) {
                        // Ignore parsing errors
                    }
                    throw new ApiException(statusCode, responseBody, errorCode);
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

        } catch (AuthenticationException | RateLimitException e) {
            throw e;
        } catch (ApiException e) {
            throw e;
        } catch (org.apache.hc.client5.http.conn.ConnectionPoolTimeoutException e) {
            throw new NetworkException("Connection pool timeout", e);
        } catch (org.apache.hc.client5.http.conn.ConnectTimeoutException e) {
            throw new NetworkException("Connection timeout", e);
        } catch (java.net.SocketTimeoutException e) {
            throw new NetworkException("Read timeout", e);
        } catch (java.net.ConnectException e) {
            throw new NetworkException("Connection refused: " + e.getMessage(), e);
        } catch (IOException e) {
            throw new NetworkException("Network error: " + e.getMessage(), e);
        }
    }

    /**
     * Add required headers to the request.
     */
    private void addHeaders(HttpRequestBase request) {
        request.setHeader("Accept", "application/json");
        request.setHeader("Content-Type", "application/json");

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

        String base = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        String pathStr = path.startsWith("/") ? path.substring(1) : path;

        return base + "/" + pathStr;
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
