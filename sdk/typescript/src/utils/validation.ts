// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

import { SecureNotifyError } from '../types/errors.js';
import type { HttpClient } from '../utils/http.js';

/**
 * Require that a value is defined and return it
 * @param value - The value to check
 * @param name - The name of the value for error messages
 * @returns The value if defined
 * @throws SecureNotifyError if value is undefined or null
 */
export function requireNotEmpty<T>(value: T | undefined | null, name: string): T {
  if (value === undefined || value === null) {
    throw SecureNotifyError.validation(`${name} is required`);
  }
  return value;
}

/**
 * Require that a string value is defined and not empty
 * @param value - The string value to check
 * @param name - The name of the value for error messages
 * @returns The string value if defined and not empty
 * @throws SecureNotifyError if value is undefined, null, or empty
 */
export function requireId(value: string | undefined, name: string = "id"): string {
  if (!value) {
    throw SecureNotifyError.validation(`${name} is required`);
  }
  return value;
}

/**
 * Require that an API key is configured on the HTTP client
 * @param http - The HTTP client to check
 * @throws SecureNotifyError if no API key is configured
 */
export function requireApiKey(http: HttpClient): void {
  if (!http.hasApiKey()) {
    throw SecureNotifyError.missingApiKey();
  }
}
