# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 KirkyX. All rights reserved.

# Example Makefile for SecureNotify C SDK

# Path to SDK installation
SDK_PATH ?= /usr/local
INCLUDE_PATH := $(SDK_PATH)/include
LIB_PATH := $(SDK_PATH)/lib

# Compiler settings
CC ?= gcc
CFLAGS := -Wall -Wextra -O2 -std=c99 -I$(INCLUDE_PATH)
LDFLAGS := -L$(LIB_PATH) -lsecurenotify -lcurl -lpthread

.PHONY: all clean run_basic run_subscribe

all: basic_usage subscribe_example

basic_usage: basic_usage.c
	$(CC) $(CFLAGS) -o $@ $< $(LDFLAGS)
	@echo ""
	@echo "Run with: LD_LIBRARY_PATH=$(LIB_PATH) ./basic_usage"
	@echo "Or install first: make install"

subscribe_example: subscribe_example.c
	$(CC) $(CFLAGS) -o $@ $< $(LDFLAGS)
	@echo ""
	@echo "Run with: LD_LIBRARY_PATH=$(LIB_PATH) ./subscribe_example"
	@echo "Or install first: make install"

run_basic: basic_usage
	LD_LIBRARY_PATH=$(LIB_PATH) ./basic_usage

run_subscribe: subscribe_example
	LD_LIBRARY_PATH=$(LIB_PATH) ./subscribe_example

clean:
	rm -f basic_usage subscribe_example

install:
	cp basic_usage $(DESTDIR)$(SDK_PATH)/bin/
	cp subscribe_example $(DESTDIR)$(SDK_PATH)/bin/
