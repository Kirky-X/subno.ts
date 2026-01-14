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
     * Create a new channel.
     *
     * @param id          Optional custom channel ID
     * @param name        Optional channel name
     * @param description Optional channel description
     * @param type        Channel type (public or encrypted)
     * @param creator     Optional creator identifier
     * @param expiresIn   Optional expiration time in seconds
     * @param metadata    Optional metadata
     * @return The created channel info
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

        return retryHandler.execute(() ->
                httpClient.post("api/channels", request, ChannelInfo.class)
        ).getData();
    }

    /**
     * Create a channel with minimal options.
     *
     * @param type Channel type (public or encrypted)
     * @return The created channel info
     */
    public ChannelInfo create(String type) throws Exception {
        return create(null, null, null, type, null, null, null);
    }

    /**
     * Create an encrypted channel.
     *
     * @return The created channel info
     */
    public ChannelInfo createEncrypted() throws Exception {
        return create(null, null, null, "encrypted", null, null, null);
    }

    /**
     * Create a public channel.
     *
     * @return The created channel info
     */
    public ChannelInfo createPublic() throws Exception {
        return create(null, null, null, "public", null, null, null);
    }

    /**
     * Get channel info by ID.
     *
     * @param channelId The channel ID
     * @return The channel info
     */
    public ChannelInfo get(String channelId) throws Exception {
        return retryHandler.execute(() ->
                httpClient.get("api/channels/" + channelId, null, ChannelInfo.class)
        ).getData();
    }

    /**
     * List all channels.
     *
     * @param limit  Maximum number of channels to return
     * @param offset Offset for pagination
     * @return The list response with pagination
     */
    public ChannelListResponse list(Integer limit, Integer offset) throws Exception {
        ApiRequest<?> request = ApiRequest.builder()
                .limit(limit)
                .offset(offset)
                .build();

        return retryHandler.execute(() ->
                httpClient.post("api/channels", request, ChannelListResponse.class)
        ).getData();
    }

    /**
     * List channels with default pagination.
     *
     * @return The list response with pagination
     */
    public ChannelListResponse list() throws Exception {
        return list(50, 0);
    }

    /**
     * Delete a channel.
     *
     * @param channelId The channel ID
     * @return The delete response
     */
    public ApiResponse<?> delete(String channelId) throws Exception {
        return retryHandler.execute(() ->
                httpClient.delete("api/channels/" + channelId, Map.class)
        );
    }

    /**
     * Response wrapper for channel list.
     */
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
