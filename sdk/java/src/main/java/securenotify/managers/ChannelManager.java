// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.managers;

import securenotify.types.ApiRequest;
import securenotify.types.ApiResponse;
import securenotify.types.ChannelInfo;
import securenotify.types.PaginationResult;
import securenotify.utils.HttpClient;
import securenotify.utils.RetryHandler;

import java.util.Map;

/**
 * Manager for channel operations.
 */
public class ChannelManager {

    private final HttpClient httpClient;
    private final RetryHandler retryHandler;

    public ChannelManager(HttpClient httpClient) {
        this(httpClient, RetryHandler.DEFAULT);
    }

    public ChannelManager(HttpClient httpClient, RetryHandler retryHandler) {
        this.httpClient = httpClient;
        this.retryHandler = retryHandler;
    }

    /**
     * @param id          Optional custom channel ID
     * @param type        Channel type (public or encrypted)
     * @param expiresIn   Optional expiration time in seconds
     */
    public ChannelInfo create(String id, String name, String description, String type,
                              String creator, Integer expiresIn, Map<String, Object> metadata) throws Exception {
        ApiRequest<?> request = ApiRequest.builder()
                .id(id)
                .name(name)
                .description(description)
                .type(type != null ? type : "encrypted")
                .creator(creator)
                .expiresIn(expiresIn)
                .metadata(metadata)
                .build();

        return retryHandler.execute(() -> {
            try {
                return httpClient.post("api/channels", request, ChannelInfo.class);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }).getData();
    }

    /**
     * @param type Channel type (public or encrypted)
     */
    public ChannelInfo create(String type) throws Exception {
        return create(null, null, null, type, null, null, null);
    }

    public ChannelInfo createEncrypted() throws Exception {
        return create(null, null, null, "encrypted", null, null, null);
    }

    public ChannelInfo createPublic() throws Exception {
        return create(null, null, null, "public", null, null, null);
    }

    public ChannelInfo get(String channelId) throws Exception {
        return retryHandler.execute(() -> {
            try {
                return httpClient.get("api/channels/" + channelId, null, ChannelInfo.class);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }).getData();
    }

    public ChannelListResponse list(Integer limit, Integer offset) throws Exception {
        ApiRequest<?> request = ApiRequest.builder()
                .limit(limit)
                .offset(offset)
                .build();

        return retryHandler.execute(() -> {
            try {
                return httpClient.post("api/channels", request, ChannelListResponse.class);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        }).getData();
    }

    public ChannelListResponse list() throws Exception {
        return list(50, 0);
    }

    public ApiResponse<?> delete(String channelId) throws Exception {
        return retryHandler.execute(() -> {
            try {
                return httpClient.delete("api/channels/" + channelId, Map.class);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }
        });
    }

    public static class ChannelListResponse {
        private ChannelInfo[] channels;
        private PaginationResult pagination;

        public ChannelInfo[] getChannels() {
            return channels;
        }

        public void setChannels(ChannelInfo[] channels) {
            this.channels = channels;
        }

        public PaginationResult getPagination() {
            return pagination;
        }

        public void setPagination(PaginationResult pagination) {
            this.pagination = pagination;
        }
    }
}
