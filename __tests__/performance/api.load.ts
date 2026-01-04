// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import http from 'k6/http';
import { check, sleep } from 'k6';
import { RateLimiterService } from '@/lib/services/rate-limiter.service';
import { MessageService } from '@/lib/services/message.service';
import { EncryptionService } from '@/lib/services/encryption.service';

// Configuration
export const options = {
  stages: [
    { duration: '10s', target: 10 },   // Ramp up
    { duration: '30s', target: 50 },   // Sustain load
    { duration: '10s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% of requests under 500ms
    http_req_failed: ['rate<0.01'],     // Less than 1% failures
    http_req_waiting: ['p(95)<300'],    // 95% of waiting time under 300ms
  },
};

// Test scenarios
export default function () {
  const baseUrl = 'http://localhost:3000';

  // Scenario 1: Publish message
  const publishRes = http.post(`${baseUrl}/api/publish`, JSON.stringify({
    channel: 'performance_test',
    message: `Test message at ${Date.now()}`,
    priority: 'normal',
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(publishRes, {
    'publish status 200': (r) => r.status === 200,
    'publish response time < 100ms': (r) => r.timings.duration < 100,
  });

  // Scenario 2: Subscribe (SSE connection)
  const subscribeRes = http.get(`${baseUrl}/api/subscribe?channel=performance_test`, {
    headers: { 'Accept': 'text/event-stream' },
  });

  check(subscribeRes, {
    'subscribe status 200': (r) => r.status === 200,
  });

  // Scenario 3: Register key
  const encryptionService = new EncryptionService();
  const keyPair = encryptionService.generateKeyPair();

  const registerRes = http.post(`${baseUrl}/api/register`, JSON.stringify({
    publicKey: keyPair.publicKey,
    expiresIn: 3600,
    metadata: { test: 'performance' },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(registerRes, {
    'register status 201': (r) => r.status === 201,
    'register response time < 200ms': (r) => r.timings.duration < 200,
  });

  // Scenario 4: Get key
  if (registerRes.status === 201) {
    const data = JSON.parse(registerRes.body);
    const getKeyRes = http.get(`${baseUrl}/api/keys/${data.data.channelId}`);

    check(getKeyRes, {
      'get key status 200': (r) => r.status === 200,
    });
  }

  sleep(1);
}

// Custom metrics
export function handleSummary(data) {
  return {
    'performance_report.json': JSON.stringify(data, null, 2),
  };
}
