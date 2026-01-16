// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

export {
  secureCompare,
  validateLength,
  containsInvalidCharacters,
  sanitizeErrorMessage,
  KEY_MANAGEMENT_CONFIG,
} from './secure-compare';

export { parseEnvInt, isValidUUID } from './env.utils';

export {
  generateErrorId,
  createError,
  createErrorResponse,
  handleError,
  withErrorHandling,
  ERROR_CODES,
  validationError,
  notFoundError,
  unauthorizedError,
  forbiddenError,
  rateLimitError,
  internalError,
  type AppError,
  type ErrorResponse,
  type ErrorSeverity,
} from './error.utils';
