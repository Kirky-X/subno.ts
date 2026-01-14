# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 KirkyX. All rights reserved.

# SecureNotify C SDK Makefile

# Compiler settings
CC ?= gcc
CFLAGS ?= -Wall -Wextra -O2 -std=c99 -fPIC
LDFLAGS ?= -lcurl -lpthread

# Directories
INCLUDE_DIR := include
SRC_DIR := src
LIB_DIR := lib
EXAMPLE_DIR := example
TEST_DIR := tests

# Source files
SRCS := $(SRC_DIR)/securenotify.c $(SRC_DIR)/securenotify_error.c
OBJS := $(SRCS:.c=.o)

# Library name
LIBNAME := securenotify

# Example programs
EXAMPLES := basic_usage subscribe_example

# Test programs
TESTS := test_client test_subscribe

.PHONY: all clean lib examples tests install uninstall

# Default target
all: lib examples tests

# Build static library
lib: $(LIB_DIR)/lib$(LIBNAME).a

$(LIB_DIR)/lib$(LIBNAME).a: $(OBJS)
	@mkdir -p $(LIB_DIR)
	ar rcs $@ $^

# Build shared library
lib/shared: $(LIB_DIR)/lib$(LIBNAME).so

$(LIB_DIR)/lib$(LIBNAME).so: $(OBJS)
	@mkdir -p $(LIB_DIR)
	$(CC) -shared -o $@ $(OBJS) $(LDFLAGS)

# Compile source files
$(SRC_DIR)/%.o: $(SRC_DIR)/%.c
	@mkdir -p $(SRC_DIR)
	$(CC) $(CFLAGS) -I$(INCLUDE_DIR) -c $< -o $@

# Build examples
examples: $(EXAMPLES)

basic_usage: $(EXAMPLE_DIR)/basic_usage.c $(OBJS)
	$(CC) $(CFLAGS) -I$(INCLUDE_DIR) -o $@ $< $(OBJS) $(LDFLAGS)

subscribe_example: $(EXAMPLE_DIR)/subscribe_example.c $(OBJS)
	$(CC) $(CFLAGS) -I$(INCLUDE_DIR) -o $@ $< $(OBJS) $(LDFLAGS)

# Build tests
tests: $(TESTS)

test_client: $(TEST_DIR)/test_client.c $(OBJS)
	$(CC) $(CFLAGS) -I$(INCLUDE_DIR) -o $@ $< $(OBJS) $(LDFLAGS)

test_subscribe: $(TEST_DIR)/test_subscribe.c $(OBJS)
	$(CC) $(CFLAGS) -I$(INCLUDE_DIR) -o $@ $< $(OBJS) $(LDFLAGS)

# Run tests
run-tests: tests
	@echo "Running tests..."
	@./test_client && echo "test_client: PASSED" || echo "test_client: FAILED"
	@./test_subscribe && echo "test_subscribe: PASSED" || echo "test_subscribe: FAILED"

# Install
PREFIX ?= /usr/local
INSTALL_INCLUDE := $(DESTDIR)$(PREFIX)/include/securenotify
INSTALL_LIB := $(DESTDIR)$(PREFIX)/lib
INSTALL_LIBEXEC := $(DESTDIR)$(PREFIX)/bin

install:
	@echo "Installing SecureNotify C SDK..."
	@mkdir -p $(INSTALL_INCLUDE)
	@cp $(INCLUDE_DIR)/*.h $(INSTALL_INCLUDE)/
	@mkdir -p $(INSTALL_LIB)
	@cp $(LIB_DIR)/lib$(LIBNAME).a $(INSTALL_LIB)/
	@cp $(LIB_DIR)/lib$(LIBNAME).so* $(INSTALL_LIB)/ 2>/dev/null || true
	@mkdir -p $(INSTALL_LIBEXEC)
	@cp $(EXAMPLES) $(INSTALL_LIBEXEC)/ 2>/dev/null || true
	@echo "Installation complete!"

uninstall:
	@echo "Uninstalling SecureNotify C SDK..."
	@rm -rf $(INSTALL_INCLUDE)
	@rm -f $(INSTALL_LIB)/lib$(LIBNAME).a
	@rm -f $(INSTALL_LIB)/lib$(LIBNAME).so*
	@rm -f $(INSTALL_LIBEXEC)/basic_usage
	@rm -f $(INSTALL_LIBEXEC)/subscribe_example
	@echo "Uninstallation complete!"

# Clean
clean:
	rm -f $(OBJS)
	rm -f $(EXAMPLES)
	rm -f $(TESTS)
	rm -rf $(LIB_DIR)
	rm -f *.o

# Help
help:
	@echo "SecureNotify C SDK Build System"
	@echo ""
	@echo "Targets:"
	@echo "  all         - Build library, examples, and tests (default)"
	@echo "  lib         - Build static library only"
	@echo "  lib/shared  - Build shared library only"
	@echo "  examples    - Build example programs"
	@echo "  tests       - Build test programs"
	@echo "  run-tests   - Build and run tests"
	@echo "  install     - Install the library and headers"
	@echo "  uninstall   - Uninstall the library and headers"
	@echo "  clean       - Remove all build artifacts"
	@echo "  help        - Show this help message"
	@echo ""
	@echo "Options:"
	@echo "  CC          - C compiler (default: gcc)"
	@echo "  CFLAGS      - Compiler flags (default: -Wall -Wextra -O2 -std=c99)"
	@echo "  LDFLAGS     - Linker flags (default: -lcurl -lpthread)"
	@echo "  PREFIX      - Installation prefix (default: /usr/local)"
