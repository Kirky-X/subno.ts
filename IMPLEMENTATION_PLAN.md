# Implementation Plan - Vercel Deployment Fixes

## Goal
Fix Vercel deployment access issues and standardize project structure.

## Status
- [x] Refactor project structure (move `app` to `src/app`)
- [x] Relax Security Headers for Vercel Preview (`X-Frame-Options`)
- [ ] Verify Environment Variables on Vercel

## Details

### 1. Refactor Structure
- Moved `app` directory to `src/app` to align with `tsconfig.json` paths and `src` directory usage.
- **Status**: Complete.

### 2. Security Headers
- Changed `X-Frame-Options` from `DENY` to `SAMEORIGIN` in `next.config.ts` and `middleware.ts`.
- This allows Vercel Preview functionality (which may use iframes).
- **Status**: Complete.

### 3. Environment Variables
- Identified missing critical environment variables as a potential cause for runtime errors.
- Required variables: `ADMIN_MASTER_KEY`, `CRON_SECRET`, `DATABASE_URL`, `REDIS_URL`.
- **Status**: Pending User Action.
