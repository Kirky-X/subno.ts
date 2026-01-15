// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

package securenotify.utils;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * Performance metrics collector for SDK operations.
 * <p>
 * Collects timing statistics for API requests, including average, min, max,
 * and percentile values (P50, P95, P99).
 */
public class MetricsCollector {
    private static final Logger logger = LoggerFactory.getLogger(MetricsCollector.class);

    private final int maxSamples;
    private final Map<String, ConcurrentLinkedQueue<MetricSample>> samples;
    private final ReentrantReadWriteLock lock;

    /**
     * Create a new metrics collector.
     *
     * @param maxSamples Maximum number of samples to keep per endpoint
     */
    public MetricsCollector(int maxSamples) {
        this.maxSamples = maxSamples;
        this.samples = new ConcurrentHashMap<>();
        this.lock = new ReentrantReadWriteLock();
    }

    /**
     * Create a metrics collector with default max samples (1000).
     */
    public MetricsCollector() {
        this(1000);
    }

    /**
     * Record a metric sample.
     *
     * @param endpoint    API endpoint
     * @param durationMs  Request duration in milliseconds
     * @param success     Whether the request was successful
     */
    public void record(String endpoint, long durationMs, boolean success) {
        lock.writeLock().lock();
        try {
            ConcurrentLinkedQueue<MetricSample> queue = samples.computeIfAbsent(
                    endpoint,
                    k -> new ConcurrentLinkedQueue<>()
            );

            queue.add(new MetricSample(System.currentTimeMillis(), durationMs, success));

            // Trim to max samples
            while (queue.size() > maxSamples) {
                queue.poll();
            }
        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Get statistics for an endpoint.
     *
     * @param endpoint API endpoint
     * @return Metric statistics
     */
    public MetricStats getStats(String endpoint) {
        lock.readLock().lock();
        try {
            ConcurrentLinkedQueue<MetricSample> queue = samples.get(endpoint);
            if (queue == null || queue.isEmpty()) {
                return new MetricStats();
            }

            List<MetricSample> sampleList = new ArrayList<>(queue);
            return calculateStats(sampleList);
        } finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Get statistics for all endpoints.
     *
     * @return Map of endpoint to statistics
     */
    public Map<String, MetricStats> getAllStats() {
        lock.readLock().lock();
        try {
            Map<String, MetricStats> result = new HashMap<>();
            for (Map.Entry<String, ConcurrentLinkedQueue<MetricSample>> entry : samples.entrySet()) {
                List<MetricSample> sampleList = new ArrayList<>(entry.getValue());
                result.put(entry.getKey(), calculateStats(sampleList));
            }
            return result;
        } finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Get a summary of all metrics.
     *
     * @return Summary statistics
     */
    public MetricsSummary getSummary() {
        lock.readLock().lock();
        try {
            Map<String, MetricStats> allStats = getAllStats();
            int totalRequests = 0;
            int totalSuccess = 0;
            int totalFailures = 0;

            for (MetricStats stats : allStats.values()) {
                totalRequests += stats.count;
                totalSuccess += stats.successCount;
                totalFailures += stats.failureCount;
            }

            return new MetricsSummary(
                    totalRequests,
                    totalSuccess,
                    totalFailures,
                    totalRequests > 0 ? (double) totalSuccess / totalRequests : 0.0,
                    allStats.size()
            );
        } finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Reset all metrics.
     */
    public void reset() {
        lock.writeLock().lock();
        try {
            samples.clear();
            logger.info("Metrics collector reset");
        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Calculate statistics from a list of samples.
     */
    private MetricStats calculateStats(List<MetricSample> sampleList) {
        if (sampleList.isEmpty()) {
            return new MetricStats();
        }

        MetricStats stats = new MetricStats();
        stats.count = sampleList.size();

        List<Long> durations = new ArrayList<>(sampleList.size());
        long totalDuration = 0;

        for (MetricSample sample : sampleList) {
            durations.add(sample.durationMs);
            totalDuration += sample.durationMs;

            if (sample.success) {
                stats.successCount++;
            } else {
                stats.failureCount++;
            }
        }

        Collections.sort(durations);

        stats.minDurationMs = durations.get(0);
        stats.maxDurationMs = durations.get(durations.size() - 1);
        stats.avgDurationMs = (double) totalDuration / stats.count;

        // Calculate percentiles
        int n = durations.size();
        stats.p50DurationMs = durations.get(n / 2);
        stats.p95DurationMs = durations.get((int) (n * 0.95));
        stats.p99DurationMs = durations.get((int) (n * 0.99));

        return stats;
    }

    /**
     * Metric sample data class.
     */
    private static class MetricSample {
        final long timestamp;
        final long durationMs;
        final boolean success;

        MetricSample(long timestamp, long durationMs, boolean success) {
            this.timestamp = timestamp;
            this.durationMs = durationMs;
            this.success = success;
        }
    }

    /**
     * Metric statistics data class.
     */
    public static class MetricStats {
        public int count;
        public int successCount;
        public int failureCount;
        public long minDurationMs;
        public long maxDurationMs;
        public double avgDurationMs;
        public long p50DurationMs;
        public long p95DurationMs;
        public long p99DurationMs;

        public MetricStats() {
            this.minDurationMs = Long.MAX_VALUE;
        }

        public double getSuccessRate() {
            return count > 0 ? (double) successCount / count : 0.0;
        }
    }

    /**
     * Metrics summary data class.
     */
    public static class MetricsSummary {
        public final int totalRequests;
        public final int totalSuccess;
        public final int totalFailures;
        public final double successRate;
        public final int endpointCount;

        public MetricsSummary(int totalRequests, int totalSuccess, int totalFailures,
                              double successRate, int endpointCount) {
            this.totalRequests = totalRequests;
            this.totalSuccess = totalSuccess;
            this.totalFailures = totalFailures;
            this.successRate = successRate;
            this.endpointCount = endpointCount;
        }
    }
}