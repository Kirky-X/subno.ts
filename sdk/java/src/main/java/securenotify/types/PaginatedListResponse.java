// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.types;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * Generic paginated list response wrapper.
 * Used for API endpoints that return paginated lists of items.
 *
 * @param <T> The type of items in the list
 */
@Data
public class PaginatedListResponse<T> {

    @JsonProperty("items")
    private T[] items;

    @JsonProperty("pagination")
    private PaginationResult pagination;
}
