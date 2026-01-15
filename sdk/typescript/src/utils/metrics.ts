// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Performance metrics collector for SDK operations.
 * Collects timing statistics for API requests.
 */

/**
 * A single metric sample.
 */
export interface MetricSample {
  timestamp: number;
  durationMs: number;
  success: boolean;
  endpoint: string;
}

/**
 * Statistics for a metric.
 */
export interface MetricStats {
  count: number;
  successCount: number;
  failureCount: number;
  minDurationMs: number;
  maxDurationMs: number;
  avgDurationMs: number;
  p50DurationMs: number;
  p95DurationMs: number;
  p99DurationMs: number;

  getSuccessRate(): number;
}

/**
 * Metrics summary.
 */
export interface MetricsSummary {
  totalRequests: number;
  totalSuccess: number;
  totalFailures: number;
  successRate: number;
  endpointCount: number;
}

/**
 * Performance metrics collector.
 */
export class MetricsCollector {
  private readonly maxSamples: number;
  private readonly samples: Map<string, MetricSample[]>;

  /**
   * Create a new metrics collector.
   *
   * @param maxSamples Maximum number of samples to keep per endpoint
   */
  constructor(maxSamples: number = 1000) {
    this.maxSamples = maxSamples;
    this.samples = new Map();
  }

  /**
   * Record a metric sample.
   *
   * @param endpoint API endpoint
   * @param durationMs Request duration in milliseconds
   * @param success Whether the request was successful
   */
  record(endpoint: string, durationMs: number, success: boolean): void {
    if (!this.samples.has(endpoint)) {
      this.samples.set(endpoint, []);
    }

    const queue = this.samples.get(endpoint)!;
    queue.push({
      timestamp: Date.now(),
      durationMs,
      success,
      endpoint,
    });

    // Trim to max samples
    while (queue.length > this.maxSamples) {
      queue.shift();
    }
  }

  /**
   * Get statistics for an endpoint.
   *
   * @param endpoint API endpoint
   * @returns Metric statistics
   */
  getStats(endpoint: string): MetricStats | null {
    const samples = this.samples.get(endpoint);
    if (!samples || samples.length === 0) {
      return null;
    }

    return this.calculateStats(samples);
  }

  /**
   * Get statistics for all endpoints.
   *
   * @returns Map of endpoint to statistics
   */
  getAllStats(): Map<string, MetricStats> {
    const result = new Map<string, MetricStats>();
    for (const [endpoint, samples] of this.samples.entries()) {
      if (samples.length > 0) {
        result.set(endpoint, this.calculateStats(samples));
      }
    }
    return result;
  }

  /**
   * Get a summary of all metrics.
   *
   * @returns Summary statistics
   */
  getSummary(): MetricsSummary {
    const allStats = this.getAllStats();
    let totalRequests = 0;
    let totalSuccess = 0;
    let totalFailures = 0;

    for (const stats of allStats.values()) {
      totalRequests += stats.count;
      totalSuccess += stats.successCount;
      totalFailures += stats.failureCount;
    }

    return {
      totalRequests,
      totalSuccess,
      totalFailures,
      successRate: totalRequests > 0 ? totalSuccess / totalRequests : 0,
      endpointCount: allStats.size,
    };
  }

  /**
   * Reset all metrics.
   */
  reset(): void {
    this.samples.clear();
  }

  /**
   * Calculate statistics from a list of samples.
   */
  private calculateStats(samples: MetricSample[]): MetricStats {
    if (samples.length === 0) {
      return {
        count: 0,
        successCount: 0,
        failureCount: 0,
        minDurationMs: 0,
        maxDurationMs: 0,
        avgDurationMs: 0,
        p50DurationMs: 0,
        p95DurationMs: 0,
        p99DurationMs: 0,
        getSuccessRate: () => 0,
      };
    }

    const durations = samples.map((s) => s.durationMs).sort((a, b) => a - b);
    const totalDuration = durations.reduce((sum, d) => sum + d, 0);

    let successCount = 0;
    let failureCount = 0;
    for (const sample of samples) {
      if (sample.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }

    const n = durations.length;
    return {
      count: n,
      successCount,
      failureCount,
      minDurationMs: durations[0],
      maxDurationMs: durations[n - 1],
      avgDurationMs: totalDuration / n,
      p50DurationMs: durations[Math.floor(n / 2)],
      p95DurationMs: durations[Math.floor(n * 0.95)],
      p99DurationMs: durations[Math.floor(n * 0.99)],
      getSuccessRate: () => (successCount / n),
    };
  }
}

/**
 * Context manager for measuring operation duration.
 */
export class MetricsContext {
  private readonly collector: MetricsCollector;
  private readonly endpoint: string;
  private readonly startTime: number;
  private success = false;

  /**
   * Initialize metrics context.
   *
   * @param collector Metrics collector to record to
   * @param endpoint API endpoint being measured
   */
  constructor(collector: MetricsCollector, endpoint: string) {
    this.collector = collector;
    this.endpoint = endpoint;
    this.startTime = Date.now();
  }

  /**
   * Mark the operation as successful.
   */
  markSuccess(): void {
    this.success = true;
  }

  /**
   * Record the metric.
   */
  record(): void {
    const durationMs = Date.now() - this.startTime;
    this.collector.record(this.endpoint, durationMs, this.success);
  }
}