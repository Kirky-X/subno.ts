// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.types;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Pagination result from list queries.
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class PaginationResult {

    @JsonProperty("total")
    private int total;

    @JsonProperty("limit")
    private int limit;

    @JsonProperty("offset")
    private int offset;

    @JsonProperty("hasMore")
    private boolean hasMore;

    public PaginationResult() {
    }

    public PaginationResult(int total, int limit, int offset, boolean hasMore) {
        this.total = total;
        this.limit = limit;
        this.offset = offset;
        this.hasMore = hasMore;
    }

    public int getTotal() {
        return total;
    }

    public void setTotal(int total) {
        this.total = total;
    }

    public int getLimit() {
        return limit;
    }

    public void setLimit(int limit) {
        this.limit = limit;
    }

    public int getOffset() {
        return offset;
    }

    public void setOffset(int offset) {
        this.offset = offset;
    }

    public boolean isHasMore() {
        return hasMore;
    }

    public void setHasMore(boolean hasMore) {
        this.hasMore = hasMore;
    }
}
