// SPDX-License-Identifier: Apache-2.0 
// Copyright (c) 2026 KirkyX. All rights reserved. 

import { db } from '@/lib/db';

/**
 * Index statistics from PostgreSQL
 */
export interface IndexStats {
  indexName: string;
  tableName: string;
  columns: string[];
  sizeBytes: number;
  indexScans: number;
  tuplesRead: number;
  tuplesFetched: number;
  lastVacuum: Date | null;
  lastAutoVacuum: Date | null;
  lastAnalyze: Date | null;
}

/**
 * Table statistics from PostgreSQL
 */
export interface TableStats {
  tableName: string;
  rowCount: number;
  tableSizeBytes: number;
  indexesSizeBytes: number;
  totalSizeBytes: number;
  deadTuples: number;
  deadTupleRatio: number;
  lastVacuum: Date | null;
  lastAutoVacuum: Date | null;
  lastAnalyze: Date | null;
}

/**
 * Index health status
 */
export type IndexHealthStatus = 'healthy' | 'needs_vacuum' | 'needs_analyze' | 'bloated' | 'unused';

/**
 * Index health details
 */
export interface IndexHealth {
  indexName: string;
  tableName: string;
  status: IndexHealthStatus;
  details: string;
  recommendation: string;
}

/**
 * Table statistics with size info for health checks
 */
type TableStatWithSize = TableStats & { totalSizeBytes: number; deadTuples: number; deadTupleRatio: number };

/**
 * Database Index Monitor - Monitors and analyzes PostgreSQL index health
 */
export class IndexMonitorService {
  private readonly tableNames = [
    'public_keys',
    'channels',
    'audit_logs',
    'messages',
    'api_keys',
  ];

  /**
   * Get all index statistics for the database
   * @returns Array of index statistics
   */
  async getIndexStats(): Promise<IndexStats[]> {
    try {
      const query = `
        SELECT
          i.relname AS index_name,
          t.relname AS table_name,
          pg_get_indexdef(i.oid) AS index_definition,
          pg_relation_size(i.oid) AS index_size_bytes,
          idx_scan AS index_scans,
          idx_tup_read AS tuples_read,
          idx_tup_fetch AS tuples_fetched,
          COALESCE(last_vacuum, last_autovacuum) AS last_vacuum_analyze
        FROM pg_stat_user_indexes i
        JOIN pg_index ix ON i.indexrelid = ix.indexrelid
        JOIN pg_class t ON i.indrelid = t.oid
        JOIN pg_namespace n ON t.relnamespace = n.oid
        WHERE n.nspname = 'public'
        ORDER BY pg_relation_size(i.oid) DESC
      `;

      const result = await db.execute(query) as unknown as { rows: unknown[] };
      const rows = result.rows || [];

      return rows
        .filter((row): row is Record<string, unknown> => {
          const r = row as Record<string, unknown>;
          return typeof r.index_name === 'string' && typeof r.table_name === 'string';
        })
        .map((row) => {
          const r = row as Record<string, unknown>;
          return {
            indexName: String(r.index_name),
            tableName: String(r.table_name),
            columns: this.extractIndexColumns(String(r.index_definition)),
            sizeBytes: Number(r.index_size_bytes),
            indexScans: Number(r.index_scans),
            tuplesRead: Number(r.tuples_read),
            tuplesFetched: Number(r.tuples_fetched),
            lastVacuum: r.last_vacuum_analyze
              ? new Date(String(r.last_vacuum_analyze))
              : null,
            lastAutoVacuum: null,
            lastAnalyze: null,
          };
        });
    } catch (error) {
      console.error('Failed to get index stats:', error);
      return [];
    }
  }

  /**
   * Get all table statistics for the database
   * @returns Array of table statistics
   */
  async getTableStats(): Promise<TableStats[]> {
    try {
      const query = `
        SELECT
          relname AS table_name,
          n_live_tup AS row_count,
          pg_relation_size(relid) AS table_size_bytes,
          pg_indexes_size(relid) AS indexes_size_bytes,
          pg_total_relation_size(relid) AS total_size_bytes,
          n_dead_tup AS dead_tuples,
          CASE 
            WHEN n_live_tup > 0 
            THEN n_dead_tup::float / (n_live_tup + n_dead_tup)::float 
            ELSE 0 
          END AS dead_tuple_ratio,
          last_vacuum,
          last_autovacuum,
          last_analyze
        FROM pg_stat_user_tables
        WHERE schemaname = 'public'
        ORDER BY pg_total_relation_size(relid) DESC
      `;

      const result = await db.execute(query) as unknown as { rows: unknown[] };
      const rows = result.rows || [];

      return rows.map((row) => {
        const r = row as Record<string, unknown>;
        return {
          tableName: String(r.table_name),
          rowCount: Number(r.row_count),
          tableSizeBytes: Number(r.table_size_bytes),
          indexesSizeBytes: Number(r.indexes_size_bytes),
          totalSizeBytes: Number(r.total_size_bytes),
          deadTuples: Number(r.dead_tuples),
          deadTupleRatio: Number(r.dead_tuple_ratio),
          lastVacuum: r.last_vacuum
            ? new Date(String(r.last_vacuum))
            : null,
          lastAutoVacuum: r.last_autovacuum
            ? new Date(String(r.last_autovacuum))
            : null,
          lastAnalyze: r.last_analyze
            ? new Date(String(r.last_analyze))
            : null,
        };
      });
    } catch (error) {
      console.error('Failed to get table stats:', error);
      return [];
    }
  }

  /**
   * Check index health status
   * @returns Array of index health checks
   */
  async checkIndexHealth(): Promise<IndexHealth[]> {
    const healthChecks: IndexHealth[] = [];
    const indexStats = await this.getIndexStats();
    const tableStats = await this.getTableStats();

    for (const index of indexStats) {
      const tableStat = tableStats.find(t => t.tableName === index.tableName);
      const status = this.evaluateIndexHealth(index, tableStat);

      healthChecks.push({
        indexName: index.indexName,
        tableName: index.tableName,
        ...status,
      });
    }

    return healthChecks;
  }

  /**
   * Get unused indexes (no scans)
   * @returns Array of unused index names
   */
  async getUnusedIndexes(): Promise<Array<{ indexName: string; tableName: string; sizeBytes: number }>> {
    const indexStats = await this.getIndexStats();

    return indexStats
      .filter(index => index.indexScans === 0 && !index.indexName.startsWith('pk_'))
      .map(index => ({
        indexName: index.indexName,
        tableName: index.tableName,
        sizeBytes: index.sizeBytes,
      }));
  }

  /**
   * Get bloated indexes (more than 20% bloat)
   * @returns Array of bloated indexes
   */
  async getBloatedIndexes(): Promise<Array<{ indexName: string; tableName: string; bloatEstimate: number }>> {
    try {
      const query = `
        SELECT
          schemaname || '.' || tablename AS table_name,
          indexname,
          pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
          pg_size_pretty(pg_total_relation_size(indexrelid)) AS total_size,
          ROUND(
            CASE 
              WHEN pg_total_relation_size(indexrelid) = 0 THEN 0
              ELSE (pg_total_relation_size(indexrelid) - pg_relation_size(indexrelid))::float 
                   / pg_total_relation_size(indexrelid) * 100 
            END, 2
          ) AS bloat_percent
        FROM pg_stat_user_indexes
        WHERE schemaname = 'public'
        AND pg_relation_size(indexrelid) > 0
        ORDER BY bloat_percent DESC
      `;

      const result = await db.execute(query) as unknown as { rows: unknown[] };
      const rows = result.rows || [];

      return rows
        .filter((row): row is Record<string, unknown> => {
          const r = row as Record<string, unknown>;
          return typeof r.indexname === 'string' && typeof r.table_name === 'string';
        })
        .filter((row) => Number(row.bloat_percent) > 20)
        .map((row) => ({
          indexName: String(row.indexname),
          tableName: String(row.table_name),
          bloatEstimate: Number(row.bloat_percent),
        }));
    } catch (error) {
      console.error('Failed to get bloated indexes:', error);
      return [];
    }
  }

  /**
   * Get index usage recommendations
   * @returns Array of recommendations
   */
  async getRecommendations(): Promise<string[]> {
    const recommendations: string[] = [];
    const unusedIndexes = await this.getUnusedIndexes();
    const bloatedIndexes = await this.getBloatedIndexes();
    const indexStats = await this.getIndexStats();

    // Check for unused indexes
    if (unusedIndexes.length > 0) {
      const totalSize = unusedIndexes.reduce((sum, idx) => sum + idx.sizeBytes, 0);
      recommendations.push(
        `Found ${unusedIndexes.length} unused indexes consuming ${this.formatBytes(totalSize)}. ` +
        `Consider removing: ${unusedIndexes.map(i => i.indexName).join(', ')}`
      );
    }

    // Check for bloated indexes
    for (const idx of bloatedIndexes) {
      recommendations.push(
        `Index ${idx.indexName} has ${idx.bloatEstimate}% bloat. ` +
        `Consider running VACUUM ANALYZE on table ${idx.tableName}`
      );
    }

    // Check for indexes with low selectivity
    for (const index of indexStats) {
      if (index.indexScans > 0 && index.tuplesRead > 0) {
        const selectivity = index.tuplesFetched / index.tuplesRead;
        if (selectivity < 0.01) {
          recommendations.push(
            `Index ${index.indexName} has low selectivity (${(selectivity * 100).toFixed(1)}%). ` +
            `Consider adding more columns to the index or using a different index type.`
          );
        }
      }
    }

    // Check for missing indexes on frequently queried columns
    const tableStats = await this.getTableStats();
    for (const table of tableStats) {
      if (table.rowCount > 10000 && !table.lastAnalyze) {
        recommendations.push(
          `Table ${table.tableName} has ${table.rowCount} rows but hasn't been analyzed. ` +
          `Run ANALYZE ${table.tableName} to update statistics.`
        );
      }
    }

    return recommendations;
  }

  /**
   * Generate a comprehensive monitoring report
   * @returns Monitoring report
   */
  async generateReport(): Promise<{
    generatedAt: Date;
    totalIndexes: number;
    totalTables: number;
    indexStats: IndexStats[];
    tableStats: TableStats[];
    health: IndexHealth[];
    unusedIndexes: Array<{ indexName: string; tableName: string; sizeBytes: number }>;
    bloatedIndexes: Array<{ indexName: string; tableName: string; bloatEstimate: number }>;
    recommendations: string[];
  }> {
    const [indexStats, tableStats, health, unusedIndexes, bloatedIndexes, recommendations] =
      await Promise.all([
        this.getIndexStats(),
        this.getTableStats(),
        this.checkIndexHealth(),
        this.getUnusedIndexes(),
        this.getBloatedIndexes(),
        this.getRecommendations(),
      ]);

    return {
      generatedAt: new Date(),
      totalIndexes: indexStats.length,
      totalTables: tableStats.length,
      indexStats,
      tableStats,
      health,
      unusedIndexes,
      bloatedIndexes,
      recommendations,
    };
  }

  /**
   * Extract column names from index definition
   */
  private extractIndexColumns(indexDefinition: string): string[] {
    const match = indexDefinition.match(/\(([^)]+)\)/);
    if (match) {
      return match[1].split(',').map(col => col.trim());
    }
    return [];
  }

  /**
   * Evaluate index health status
   */
  private evaluateIndexHealth(
    index: IndexStats,
    tableStat: TableStatWithSize | undefined
  ): { status: IndexHealthStatus; details: string; recommendation: string } {
    // Check if index is unused
    if (index.indexScans === 0 && !index.indexName.startsWith('pk_')) {
      return {
        status: 'unused',
        details: `Index has never been scanned (size: ${this.formatBytes(index.sizeBytes)})`,
        recommendation: 'Consider removing unused index to save space',
      };
    }

    // Check for bloat
    if (tableStat && tableStat.deadTupleRatio > 0.2) {
      return {
        status: 'bloated',
        details: `Table has ${(tableStat.deadTupleRatio * 100).toFixed(1)}% dead tuples`,
        recommendation: `Run VACUUM ANALYZE ${index.tableName}`,
      };
    }

    // Check if vacuum is needed
    if (!index.lastVacuum && tableStat && tableStat.deadTuples > 1000) {
      return {
        status: 'needs_vacuum',
        details: 'Index has not been vacuumed and has dead tuples',
        recommendation: `Run VACUUM ${index.indexName}`,
      };
    }

    // Check if analyze is needed
    if (!index.lastVacuum && index.indexScans > 0) {
      return {
        status: 'needs_analyze',
        details: 'Index statistics may be stale',
        recommendation: `Run ANALYZE ${index.indexName}`,
      };
    }

    return {
      status: 'healthy',
      details: 'Index is healthy',
      recommendation: 'No action needed',
    };
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// Singleton instance
let indexMonitorInstance: IndexMonitorService | null = null;

export function getIndexMonitorService(): IndexMonitorService {
  if (!indexMonitorInstance) {
    indexMonitorInstance = new IndexMonitorService();
  }
  return indexMonitorInstance;
}
