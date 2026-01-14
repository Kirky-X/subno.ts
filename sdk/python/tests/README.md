# SecureNotify Python SDK Tests

This directory contains unit tests for the SecureNotify Python SDK.

## Running Tests

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=securenotify --cov-report=term-missing

# Run specific test file
pytest tests/test_types.py

# Run specific test
pytest tests/test_types.py::TestApiTypes::test_register_public_key_request_valid
```

## Test Structure

- `test_types.py` - Tests for API types and error types
- `test_retry.py` - Tests for retry mechanism
- `test_http.py` - Tests for HTTP client
- `test_connection.py` - Tests for SSE connection manager
- `test_managers.py` - Tests for manager classes
- `test_client.py` - Tests for main client class

## Test Coverage

The tests aim to achieve >80% code coverage.
