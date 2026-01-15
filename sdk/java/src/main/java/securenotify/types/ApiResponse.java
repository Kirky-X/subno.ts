// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.types;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * Generic API response wrapper.
 *
 * @param <T> The type of the response data
 */
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    @JsonProperty("success")
    private boolean success;

    @JsonProperty("data")
    private T data;

    @JsonProperty("error")
    private ErrorDetails error;

    @JsonProperty("pagination")
    private PaginationResult pagination;

    public ApiResponse() {
    }

    public ApiResponse(boolean success, T data) {
        this.success = success;
        this.data = data;
    }

    // Getters and Setters
    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public ErrorDetails getError() {
        return error;
    }

    public void setError(ErrorDetails error) {
        this.error = error;
    }

    public PaginationResult getPagination() {
        return pagination;
    }

    public void setPagination(PaginationResult pagination) {
        this.pagination = pagination;
    }

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, data);
    }

    public static <T> ApiResponse<T> error(ErrorDetails error) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setSuccess(false);
        response.setError(error);
        return response;
    }

    public static <T> ApiResponse<T> error(String message, String code) {
        ErrorDetails error = new ErrorDetails(message, code);
        return error(error);
    }

    /**
     * Error details from API response.
     */
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class ErrorDetails {

        @JsonProperty("message")
        private String message;

        @JsonProperty("code")
        private String code;

        @JsonProperty("timestamp")
        private String timestamp;

        public ErrorDetails() {
        }

        public ErrorDetails(String message, String code) {
            this.message = message;
            this.code = code;
        }

        // Getters and Setters
        public String getMessage() {
            return message;
        }

        public void setMessage(String message) {
            this.message = message;
        }

        public String getCode() {
            return code;
        }

        public void setCode(String code) {
            this.code = code;
        }

        public String getTimestamp() {
            return timestamp;
        }

        public void setTimestamp(String timestamp) {
            this.timestamp = timestamp;
        }
    }
}
