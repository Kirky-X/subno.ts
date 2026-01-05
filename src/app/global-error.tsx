// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

// Minimal global-error.tsx to prevent Next.js from generating a complex error page
// This is a workaround for Next.js 16 + styled-jsx + React 19 compatibility issue
"use client";

export default function GlobalError() {
  return null;
}