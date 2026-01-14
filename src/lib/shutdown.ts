// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 KirkyX. All rights reserved.

/**
 * Graceful shutdown handler
 * Ensures database connections are properly closed on process termination
 */

import { closeDatabase } from '../db';

type ShutdownSignal = 'SIGTERM' | 'SIGINT' | 'SIGUSR2' | 'uncaughtException' | 'unhandledRejection';

let isShuttingDown = false;

/**
 * Setup graceful shutdown handlers for the process
 * This ensures database connections are properly closed when the process terminates
 */
export function setupGracefulShutdown(): void {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  const shutdown = async (signal: ShutdownSignal) => {
    console.log(`Received ${signal}, starting graceful shutdown...`);
    
    try {
      // Close database connections
      console.log('Closing database connections...');
      await closeDatabase();
      console.log('Database connections closed successfully');
      
      // Give some time for cleanup to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  };

  // Register shutdown handlers
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', async (error) => {
    console.error('Uncaught exception:', error);
    await shutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', async (reason) => {
    console.error('Unhandled rejection:', reason);
    await shutdown('unhandledRejection');
  });
}

/**
 * Check if the server is currently shutting down
 */
export function isShuttingDownProcess(): boolean {
  return isShuttingDown;
}
