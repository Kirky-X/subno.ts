#!/usr/bin/env python3
"""
Performance benchmark script for SecureNotify SDK optimizations.

Tests the performance improvements made to the SDK:
1. JSON parsing performance (orjson vs json)
2. Rate limiter performance
3. Metrics collection overhead
4. Cache performance
"""

import time
import json
import random
import string
from typing import List, Dict, Any

# Test data
SAMPLE_DATA = {
    "key_id": "test-key-123",
    "channel_id": "test-channel-456",
    "public_key": "-----BEGIN PUBLIC KEY-----\nMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAu7lSQgDWQyZrYjG8j9K8Y7\n-----END PUBLIC KEY-----",
    "algorithm": "RSA-2048",
    "created_at": "2026-01-15T00:00:00Z",
    "expires_at": "2026-01-22T00:00:00Z",
    "metadata": {"test": "data", "nested": {"key": "value"}}
}

def benchmark_json_parsing(iterations: int = 10000) -> Dict[str, float]:
    """Benchmark JSON parsing performance."""
    print(f"\n=== JSON Parsing Benchmark ({iterations} iterations) ===")
    
    # Test standard json
    json_str = json.dumps(SAMPLE_DATA)
    start = time.time()
    for _ in range(iterations):
        json.loads(json_str)
    json_time = time.time() - start
    
    print(f"Standard json: {json_time:.4f}s ({iterations/json_time:.0f} ops/sec)")
    
    # Test orjson if available
    try:
        import orjson
        start = time.time()
        for _ in range(iterations):
            orjson.loads(json_str.encode())
        orjson_time = time.time() - start
        
        speedup = json_time / orjson_time
        print(f"orjson: {orjson_time:.4f}s ({iterations/orjson_time:.0f} ops/sec)")
        print(f"Speedup: {speedup:.2f}x")
        
        return {"json": json_time, "orjson": orjson_time, "speedup": speedup}
    except ImportError:
        print("orjson not available, skipping comparison")
        return {"json": json_time, "orjson": None, "speedup": None}

def benchmark_rate_limiter(iterations: int = 10000) -> float:
    """Benchmark rate limiter performance."""
    print(f"\n=== Rate Limiter Benchmark ({iterations} iterations) ===")
    
    from securenotify.utils.rate_limiter import RateLimiter
    
    limiter = RateLimiter(max_tokens=100, refill_rate=10, refill_interval=1.0)
    
    start = time.time()
    for _ in range(iterations):
        acquired = limiter.acquire(timeout=0.1)
    limiter_time = time.time() - start
    
    print(f"Rate limiter: {limiter_time:.4f}s ({iterations/limiter_time:.0f} ops/sec)")
    print(f"Average per operation: {limiter_time/iterations*1000:.4f}ms")
    
    return limiter_time

def benchmark_metrics_collection(iterations: int = 10000) -> float:
    """Benchmark metrics collection overhead."""
    print(f"\n=== Metrics Collection Benchmark ({iterations} iterations) ===")
    
    from securenotify.utils.metrics import MetricsCollector
    
    collector = MetricsCollector(max_samples=1000)
    
    start = time.time()
    for i in range(iterations):
        collector.record(f"/api/endpoint{i}", random.uniform(1, 100), i % 10 != 0)
    metrics_time = time.time() - start
    
    print(f"Metrics collection: {metrics_time:.4f}s ({iterations/metrics_time:.0f} ops/sec)")
    print(f"Average per operation: {metrics_time/iterations*1000:.4f}ms")
    
    # Get summary
    summary = collector.get_summary()
    print(f"Total requests: {summary['total_requests']}")
    print(f"Success rate: {summary['success_rate']*100:.1f}%")
    
    return metrics_time

def benchmark_cache(iterations: int = 10000) -> float:
    """Benchmark cache performance."""
    print(f"\n=== Cache Benchmark ({iterations} iterations) ===")
    
    from securenotify.utils.cache import ResponseCache
    
    cache = ResponseCache(default_ttl=60)
    
    # Benchmark set operations
    start = time.time()
    for i in range(iterations):
        cache.set(f"key_{i}", SAMPLE_DATA, ttl=60)
    set_time = time.time() - start
    
    print(f"Cache set: {set_time:.4f}s ({iterations/set_time:.0f} ops/sec)")
    
    # Benchmark get operations (cache hits)
    start = time.time()
    for i in range(iterations):
        cache.get(f"key_{i}")
    get_time = time.time() - start
    
    print(f"Cache get (hits): {get_time:.4f}s ({iterations/get_time:.0f} ops/sec)")
    
    # Benchmark get operations (cache misses)
    start = time.time()
    for i in range(iterations):
        cache.get(f"miss_key_{i}")
    miss_time = time.time() - start
    
    print(f"Cache get (misses): {miss_time:.4f}s ({iterations/miss_time:.0f} ops/sec)")
    
    total_time = set_time + get_time + miss_time
    print(f"Total cache operations: {total_time:.4f}s")
    
    return total_time

def main():
    """Run all benchmarks."""
    print("=" * 60)
    print("SecureNotify SDK Performance Benchmark")
    print("=" * 60)
    
    iterations = 10000
    
    # Run benchmarks
    json_results = benchmark_json_parsing(iterations)
    rate_limiter_time = benchmark_rate_limiter(iterations)
    metrics_time = benchmark_metrics_collection(iterations)
    cache_time = benchmark_cache(iterations)
    
    # Summary
    print("\n" + "=" * 60)
    print("Benchmark Summary")
    print("=" * 60)
    print(f"JSON parsing (standard): {json_results['json']:.4f}s")
    if json_results['orjson']:
        print(f"JSON parsing (orjson): {json_results['orjson']:.4f}s")
        print(f"JSON parsing speedup: {json_results['speedup']:.2f}x")
    print(f"Rate limiter: {rate_limiter_time:.4f}s")
    print(f"Metrics collection: {metrics_time:.4f}s")
    print(f"Cache operations: {cache_time:.4f}s")
    
    total_overhead = rate_limiter_time + metrics_time + cache_time
    print(f"\nTotal optimization overhead: {total_overhead:.4f}s")
    print(f"Overhead per request: {total_overhead/iterations*1000:.4f}ms")
    
    print("\n" + "=" * 60)
    print("Benchmark completed successfully!")
    print("=" * 60)

if __name__ == "__main__":
    main()