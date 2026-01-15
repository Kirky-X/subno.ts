"""Performance Metrics Utility.

Provides performance monitoring and metrics collection for SDK operations.
"""

import time
from typing import Dict, Optional, List, Union
from dataclasses import dataclass, field
from threading import Lock
from collections import deque


@dataclass
class MetricSample:
    """A single metric sample."""
    timestamp: float
    duration_ms: float
    success: bool
    endpoint: str


@dataclass
class MetricStats:
    """Statistics for a specific endpoint."""
    count: int = 0
    success_count: int = 0
    failure_count: int = 0
    min_duration_ms: float = float('inf')
    max_duration_ms: float = 0.0
    avg_duration_ms: float = 0.0
    p50_duration_ms: float = 0.0
    p95_duration_ms: float = 0.0
    p99_duration_ms: float = 0.0
    total_duration_ms: float = 0.0

    def add_sample(self, sample: MetricSample):
        """Add a sample to the statistics."""
        self.count += 1
        self.total_duration_ms += sample.duration_ms

        if sample.success:
            self.success_count += 1
        else:
            self.failure_count += 1

        if sample.duration_ms < self.min_duration_ms:
            self.min_duration_ms = sample.duration_ms
        if sample.duration_ms > self.max_duration_ms:
            self.max_duration_ms = sample.duration_ms

        self.avg_duration_ms = self.total_duration_ms / self.count

    def calculate_percentiles(self, samples: List[MetricSample]):
        """Calculate percentile values."""
        if not samples:
            return

        durations = sorted([s.duration_ms for s in samples])
        n = len(durations)

        self.p50_duration_ms = durations[n // 2]
        self.p95_duration_ms = durations[int(n * 0.95)]
        self.p99_duration_ms = durations[int(n * 0.99)]


@dataclass
class MetricsSummary:
    """Summary of all metrics."""
    total_requests: int = 0
    total_success: int = 0
    total_failures: int = 0
    success_rate: float = 0.0
    endpoint_count: int = 0


class MetricsCollector:
    """Collects and aggregates performance metrics."""

    def __init__(self, max_samples: int = 1000):
        """Initialize metrics collector.

        Args:
            max_samples: Maximum number of samples to keep per endpoint.
        """
        self._max_samples = max_samples
        self._samples: Dict[str, deque] = {}
        self._lock = Lock()

    def record(self, endpoint: str, duration_ms: float, success: bool):
        """Record a metric sample.

        Args:
            endpoint: API endpoint.
            duration_ms: Request duration in milliseconds.
            success: Whether the request was successful.
        """
        sample = MetricSample(
            timestamp=time.time(),
            duration_ms=duration_ms,
            success=success,
            endpoint=endpoint
        )

        with self._lock:
            if endpoint not in self._samples:
                self._samples[endpoint] = deque(maxlen=self._max_samples)

            self._samples[endpoint].append(sample)

    def get_stats(self, endpoint: Optional[str] = None) -> Union[MetricStats, Dict[str, MetricStats]]:
        """Get statistics for endpoints.

        Args:
            endpoint: Specific endpoint to get stats for, or None for all.

        Returns:
            If endpoint is specified, returns a single MetricStats object.
            Otherwise, returns a dictionary mapping endpoint names to statistics.
        """
        with self._lock:
            if endpoint:
                if endpoint not in self._samples:
                    return MetricStats()
                samples = list(self._samples[endpoint])
                stats = MetricStats()
                for sample in samples:
                    stats.add_sample(sample)
                stats.calculate_percentiles(samples)
                return stats
            else:
                endpoints = list(self._samples.keys())
                result = {}
                for ep in endpoints:
                    samples = list(self._samples[ep])
                    stats = MetricStats()
                    for sample in samples:
                        stats.add_sample(sample)
                    stats.calculate_percentiles(samples)
                    result[ep] = stats
                return result

    def reset(self):
        """Reset all metrics."""
        with self._lock:
            self._samples.clear()

    def get_summary(self) -> MetricsSummary:
        """Get a summary of all metrics.

        Returns:
            MetricsSummary object with summary statistics.
        """
        stats = self.get_stats()
        total_requests = sum(s.count for s in stats.values())
        total_success = sum(s.success_count for s in stats.values())
        total_failures = sum(s.failure_count for s in stats.values())

        return MetricsSummary(
            total_requests=total_requests,
            total_success=total_success,
            total_failures=total_failures,
            success_rate=total_success / total_requests if total_requests > 0 else 0.0,
            endpoint_count=len(stats),
        )


class MetricsContext:
    """Context manager for measuring operation duration."""

    def __init__(self, collector: MetricsCollector, endpoint: str):
        """Initialize metrics context.

        Args:
            collector: Metrics collector to record to.
            endpoint: API endpoint being measured.
        """
        self._collector = collector
        self._endpoint = endpoint
        self._start_time = 0.0
        self._success = False

    def __enter__(self) -> 'MetricsContext':
        """Enter context."""
        self._start_time = time.time()
        return self

    def markSuccess(self) -> None:
        """Mark the operation as successful."""
        self._success = True

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit context."""
        duration_ms = (time.time() - self._start_time) * 1000
        self._success = exc_type is None
        self._collector.record(self._endpoint, duration_ms, self._success)
        return False  # Don't suppress exceptions