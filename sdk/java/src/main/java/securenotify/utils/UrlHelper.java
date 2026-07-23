// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.utils;

import java.util.Map;
import java.util.stream.Collectors;

public class UrlHelper {

    private static final String DEFAULT_BASE_URL = "https://api.securenotify.dev";

    public static String getDefaultBaseUrl(String provided) {
        return provided != null && !provided.isEmpty() ? provided : DEFAULT_BASE_URL;
    }

    /**
     * Build a complete URL from base URL and path.
     * Handles trailing/leading slashes appropriately.
     */
    public static String buildUrl(String baseUrl, String path) {
        String base = baseUrl.endsWith("/") ? baseUrl.substring(0, baseUrl.length() - 1) : baseUrl;
        String pathStr = path.startsWith("/") ? path.substring(1) : path;
        return base + "/" + pathStr;
    }

    /**
     * @return Query string with leading '?' or empty string if no parameters
     */
    public static String buildQueryParams(Map<String, String> params) {
        if (params == null || params.isEmpty()) {
            return "";
        }

        String queryString = params.entrySet().stream()
                .map(entry -> entry.getKey() + "=" + entry.getValue())
                .collect(Collectors.joining("&"));

        return "?" + queryString;
    }

    public static String buildUrlWithParams(String baseUrl, String path, Map<String, String> params) {
        String url = buildUrl(baseUrl, path);
        String queryParams = buildQueryParams(params);
        return url + queryParams;
    }
}
