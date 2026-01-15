// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.utils;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.locks.ReentrantReadWriteLock;
import java.util.function.Supplier;

/**
 * Request deduplication utility for SDK operations.
 *
 * This class provides functionality to prevent duplicate requests from being sent
 * to the server within a short time window. This is useful for:
 * - Reducing server load
 * - Improving response speed (return cached result immediately)
 * - Preventing duplicate operations (e.g., duplicate registration)
 */

/**
 * Deduplicator statistics
 */
class DeduplicatorStats {
    public long hits;
    public long misses;
    public long errors;
    public double hitRate;
    public int pendingCount;
    public int completedCount;
    public double ttlSeconds;

    public DeduplicatorStats() {
        this.hits = 0;
        this.misses = 0;
        this.errors = 0;
        this.hitRate = 0.0;
        this.pendingCount = 0;
        this.completedCount = 0;
        this.ttlSeconds = 5.0;
    }

    @Override
    public String toString() {
        return String.format(
            "DeduplicatorStats{hits=%d, misses=%d, errors=%d, hitRate=%.2f, pending=%d, completed=%d, ttl=%.1f}",
            hits, misses, errors, hitRate, pendingCount, completedCount, ttlSeconds
        );
    }
}

/**
 * Prevents duplicate requests from being sent within a short time window.
 *
 * This class tracks in-flight requests and returns the same result to all
 * concurrent requests for the same endpoint and parameters.
 *
 * Example:
 * <pre>
 * RequestDeduplicator deduplicator = new RequestDeduplicator(5.0, 1000, 10000);
 *
 * // First request
 * String result1 = deduplicator.execute(
 *   "register_public_key",
 *   params,
 *   () -&gt; apiCall(),
 *   true
 * );
 *
 * // Concurrent duplicate request (will wait for first request)
 * String result2 = deduplicator.execute(
 *   "register_public_key",
 *   params,
 *   () -&gt; apiCall(),
 *   true
 * );
 * // result1.equals(result2) (same object)
 * </pre>
 */
public class RequestDeduplicator {
    private final Map<String, CompletableFuture<String>> pending;
    private final Map<String, String> completed;
    private final double ttlSeconds;
    private final int maxPending;
    private final int maxCompleted;
    private final DeduplicatorStats stats;
    private final Object lock;

    /**
     * Create a new request deduplicator
     *
     * @param ttlSeconds Time window for deduplication (default: 5.0 seconds)
     * @param maxPending Maximum number of pending requests to track
     * @param maxCompleted Maximum number of completed requests to cache
     */
    public RequestDeduplicator(double ttlSeconds, int maxPending, int maxCompleted) {
        this.ttlSeconds = ttlSeconds;
        this.maxPending = maxPending;
        this.maxCompleted = maxCompleted;
        this.pending = new ConcurrentHashMap<>();
        this.completed = new ConcurrentHashMap<>();
        this.stats = new DeduplicatorStats();
        this.stats.ttlSeconds = ttlSeconds;
        this.lock = new ReentrantReadWriteLock();
    }

    /**
     * Create a deduplicator with default settings
     */
    public RequestDeduplicator() {
        this(5.0, 1000, 10000);
    }

    /**
     * Generate a unique key for the request
     */
    private String generateKey(String endpoint, Map<String, Object> params) {
        // Create a deterministic string from the parameters
        StringBuilder sb = new StringBuilder();
        sb.append(endpoint);
        sb.append(":");

        if (params != null && !params.isEmpty()) {
            // Sort keys for deterministic string
            List<String> keys = new ArrayList<>(params.keySet());
            Collections.sort(keys);
            sb.append("{");
            for (int i = 0; i < keys.size(); i++) {
                if (i > 0) sb.append(",");
                sb.append(keys.get(i));
                sb.append(":");
                sb.append(params.get(keys.get(i)));
            }
            sb.append("}");
        }

        // Use SHA256 for better distribution
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(sb.toString().getBytes());
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) hexString.append('0');
                hexString.append(hex);
            }
            return "req_" + hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            // Fallback to simple hash
            return "req_" + String.valueOf(sb.toString().hashCode());
        }
    }

    /**
     * Execute a request with deduplication
     *
     * @param endpoint API endpoint
     * @param params Request parameters
     * @param func Supplier function to execute the request
     * @param useCache Whether to use completed request cache
     * @return Result from the request function
     * @throws Exception If the request function raises an exception
     */
    public <T> T execute(
        String endpoint,
        Map<String, Object> params,
        Supplier<CompletableFuture<T>> func,
        boolean useCache
    ) throws Exception {
        String key = generateKey(endpoint, params);

        // Check completed cache first
        if (useCache) {
            synchronized (lock) {
                if (completed.containsKey(key)) {
                    synchronized (stats) {
                        stats.hits++;
                        updateHitRate();
                    }
                    return (T) completed.get(key);
                }
            }
        }

        // Check pending requests
        synchronized (lock) {
            CompletableFuture<String> existingFuture = pending.get(key);
            if (existingFuture != null) {
                // Request is pending, wait for result
                synchronized (stats) {
                    stats.hits++;
                    updateHitRate();
                }
                return (T) existingFuture.get();
            }
        }

        // Execute the request
        synchronized (stats) {
            stats.misses++;
            updateHitRate();
        }

        // Create a future for this request
        CompletableFuture<T> future = new CompletableFuture<>();

        synchronized (lock) {
            if (pending.size() >= maxPending) {
                // Remove oldest pending request
                String oldestKey = pending.keySet().iterator().next();
                pending.remove(oldestKey);
            }
            pending.put(key, (CompletableFuture<String>) future);
        }

        try {
            T result = func.get().get();

            // Store result in completed cache
            if (useCache) {
                synchronized (lock) {
                    if (completed.size() >= maxCompleted) {
                        // Remove oldest entry (simple FIFO)
                        String oldestKey = completed.keySet().iterator().next();
                        completed.remove(oldestKey);
                    }
                    completed.put(key, (String) result);
                }
            }

            future.complete(result);
            return result;
        } catch (Exception e) {
            synchronized (stats) {
                stats.errors++;
            }
            future.completeExceptionally(e);
            throw e;
        } finally {
            // Remove from pending
            synchronized (lock) {
                pending.remove(key);
            }
        }
    }

    /**
     * Remove expired entries from completed cache
     *
     * @return Number of entries removed
     */
    public int cleanupExpired() {
        int removed = 0;

        // Remove oldest entries if we exceed maxCompleted
        synchronized (lock) {
            while (completed.size() > maxCompleted * 2) {
                String oldestKey = completed.keySet().iterator().next();
                completed.remove(oldestKey);
                removed++;
            }
        }

        return removed;
    }

    /**
     * Clear all pending requests
     *
     * @return Number of pending requests cleared
     */
    public int clearPending() {
        synchronized (lock) {
            int count = pending.size();
            pending.clear();
            return count;
        }
    }

    /**
     * Clear all completed requests
     *
     * @return Number of completed requests cleared
     */
    public int clearCompleted() {
        synchronized (lock) {
            int count = completed.size();
            completed.clear();
            return count;
        }
    }

    /**
     * Clear all pending and completed requests
     *
     * @return Total number of requests cleared
     */
    public int clearAll() {
        return clearPending() + clearCompleted();
    }

    /**
     * Get statistics about the deduplicator
     *
     * @return Dictionary with statistics
     */
    public DeduplicatorStats getStats() {
        synchronized (lock) {
            DeduplicatorStats copy = new DeduplicatorStats();
            copy.hits = stats.hits;
            copy.misses = stats.misses;
            copy.errors = stats.errors;
            copy.hitRate = stats.hitRate;
            copy.pendingCount = pending.size();
            copy.completedCount = completed.size();
            copy.ttlSeconds = stats.ttlSeconds;
            return copy;
        }
    }

    /**
     * Reset statistics counters
     */
    public void resetStats() {
        synchronized (stats) {
            stats.hits = 0;
            stats.misses = 0;
            stats.errors = 0;
            stats.hitRate = 0.0;
        }
    }

    /**
     * Update hit rate
     */
    private void updateHitRate() {
        long total = stats.hits + stats.misses;
        if (total > 0) {
            stats.hitRate = (double) stats.hits / total;
        }
    }
}