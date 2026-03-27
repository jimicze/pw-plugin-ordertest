/**
 * Data types for the Custom HTML Reporter.
 *
 * These types define the data structures used to collect, aggregate, and render
 * the custom HTML report with Gantt timeline, summary table, dependency graph,
 * and shard distribution view.
 */

import type { ExecutionMode } from '../config/types.js';

// ---------------------------------------------------------------------------
// Test-level data
// ---------------------------------------------------------------------------

/** Status of a completed test. */
export type TestStatus = 'passed' | 'failed' | 'skipped' | 'timedOut' | 'interrupted';

/** Data collected for a single test execution. */
export interface TestReportData {
  /** Test title (from test.title). */
  readonly title: string;

  /** Full title path (from test.titlePath()). */
  readonly titlePath: readonly string[];

  /** Final test status. */
  readonly status: TestStatus;

  /** Duration in milliseconds. */
  readonly duration: number;

  /** Timestamp when the test started (ISO 8601). */
  readonly startTime: string;

  /** Timestamp when the test ended (ISO 8601). */
  readonly endTime: string;

  /** Number of retry attempt (0 = first run). */
  readonly retry: number;

  /** Error message if the test failed. */
  readonly error?: string;
}

// ---------------------------------------------------------------------------
// Step-level data (one step = one project = one file in the sequence)
// ---------------------------------------------------------------------------

/** Data for a single step (file/project) within a sequence. */
export interface StepReportData {
  /** Project name (e.g., 'ordertest:checkout-flow:0'). */
  readonly projectName: string;

  /** Step index within the sequence (0-based). */
  readonly stepIndex: number;

  /** The test file path matched by this step. */
  readonly testFile: string;

  /** All test results collected for this step. */
  readonly tests: readonly TestReportData[];

  /** Earliest test start time in this step (ISO 8601). */
  readonly startTime: string;

  /** Latest test end time in this step (ISO 8601). */
  readonly endTime: string;

  /** Total duration of this step in milliseconds. */
  readonly duration: number;

  /** Number of passed tests. */
  readonly passedCount: number;

  /** Number of failed tests. */
  readonly failedCount: number;

  /** Number of skipped tests. */
  readonly skippedCount: number;
}

// ---------------------------------------------------------------------------
// Sequence-level data
// ---------------------------------------------------------------------------

/** Aggregated data for a single ordered sequence. */
export interface SequenceReportData {
  /** Sequence name. */
  readonly name: string;

  /** Execution mode. */
  readonly mode: ExecutionMode;

  /** Whether the sequence was collapsed for shard safety. */
  readonly isCollapsed: boolean;

  /** Ordered steps (files) in this sequence. */
  readonly steps: readonly StepReportData[];

  /** Total duration of the sequence (first test start to last test end). */
  readonly duration: number;

  /** Earliest test start time across all steps (ISO 8601). */
  readonly startTime: string;

  /** Latest test end time across all steps (ISO 8601). */
  readonly endTime: string;

  /** Overall status: 'passed' if all tests passed, 'failed' otherwise. */
  readonly status: 'passed' | 'failed' | 'mixed';

  /** Total number of tests across all steps. */
  readonly totalTests: number;

  /** Total passed tests across all steps. */
  readonly passedTests: number;

  /** Total failed tests across all steps. */
  readonly failedTests: number;

  /** Total skipped tests across all steps. */
  readonly skippedTests: number;
}

// ---------------------------------------------------------------------------
// Dependency graph
// ---------------------------------------------------------------------------

/** An edge in the dependency graph. */
export interface DependencyEdge {
  /** Source project name (dependency). */
  readonly from: string;

  /** Target project name (depends on `from`). */
  readonly to: string;

  /** Sequence this edge belongs to. */
  readonly sequenceName: string;
}

// ---------------------------------------------------------------------------
// Shard distribution
// ---------------------------------------------------------------------------

/** Data about how sequences were distributed across shards. */
export interface ShardReportData {
  /** Current shard number (1-indexed). */
  readonly current: number;

  /** Total number of shards. */
  readonly total: number;

  /** Sequences that ran on this shard. */
  readonly sequences: readonly string[];

  /** Whether any sequences were collapsed on this shard. */
  readonly hasCollapsed: boolean;
}

// ---------------------------------------------------------------------------
// Top-level report data
// ---------------------------------------------------------------------------

/** Complete data for the custom HTML report. */
export interface ReportData {
  /** Plugin version. */
  readonly version: string;

  /** Timestamp when the report was generated (ISO 8601). */
  readonly generatedAt: string;

  /** Total duration of the entire test run in milliseconds. */
  readonly totalDuration: number;

  /** Overall run status. */
  readonly runStatus: 'passed' | 'failed' | 'timedout' | 'interrupted';

  /** All ordered sequences with their data. */
  readonly sequences: readonly SequenceReportData[];

  /** Dependency edges for the graph visualization. */
  readonly dependencies: readonly DependencyEdge[];

  /** Shard information (undefined if not sharded). */
  readonly shard?: ShardReportData;

  /** Total tests across all sequences. */
  readonly totalTests: number;

  /** Total passed tests. */
  readonly totalPassed: number;

  /** Total failed tests. */
  readonly totalFailed: number;

  /** Total skipped tests. */
  readonly totalSkipped: number;
}
