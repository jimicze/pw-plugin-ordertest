/**
 * Custom HTML Reporter for @playwright-ordertest/core.
 *
 * Collects detailed timing data during test execution and generates a
 * self-contained HTML report with Gantt timeline, summary table,
 * dependency graph, and shard distribution view.
 *
 * Usage in playwright.config.ts:
 * ```ts
 * export default defineConfig({
 *   reporter: [
 *     ['@playwright-ordertest/core/custom-reporter', { outputFile: 'report.html' }],
 *   ],
 * });
 * ```
 *
 * Playwright requires reporters to be default exports — this is the ONE exception
 * to the "no default exports" rule in this codebase.
 */

import fs from 'node:fs';
import path from 'node:path';

import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

import type { ExecutionMode, LogLevel } from '../config/types.js';
import type { Logger } from '../logger/logger.js';
import { createLogger, createSilentLogger, debugConsole } from '../logger/logger.js';
import type { HtmlTemplateOptions } from './htmlTemplate.js';
import { generateHtmlReport } from './htmlTemplate.js';
import type {
  DependencyEdge,
  ReportData,
  SequenceReportData,
  ShardReportData,
  StepReportData,
  TestReportData,
  TestStatus,
} from './reportData.js';
import { SequenceTracker } from './sequenceTracker.js';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

/**
 * Configuration options for the CustomHtmlReporter.
 */
export interface CustomHtmlReporterOptions {
  /** Output file path for the HTML report. Default: 'ordertest-report.html'. */
  readonly outputFile?: string;

  /** Show the Gantt timeline visualization. Default: true. */
  readonly showTimeline?: boolean;

  /** Show the summary table. Default: true. */
  readonly showSummary?: boolean;

  /** Show the dependency graph. Default: true. */
  readonly showDependencyGraph?: boolean;

  /** Show the shard distribution view. Default: true (auto-hidden if no shards). */
  readonly showShardDistribution?: boolean;

  /** Log level for the plugin's persistent activity logger. */
  readonly logLevel?: LogLevel;

  /** Directory for log files. Default: '.ordertest'. */
  readonly logDir?: string;
}

// ---------------------------------------------------------------------------
// Reporter class
// ---------------------------------------------------------------------------

/**
 * Custom HTML Reporter for @playwright-ordertest/core.
 *
 * Collects detailed timing data during test execution and generates a
 * self-contained HTML report with Gantt timeline, summary table,
 * dependency graph, and shard distribution view.
 *
 * Usage in playwright.config.ts:
 * ```ts
 * export default defineConfig({
 *   reporter: [
 *     ['@playwright-ordertest/core/custom-reporter', { outputFile: 'report.html' }],
 *   ],
 * });
 * ```
 *
 * Playwright requires reporters to be default exports.
 */
export default class CustomHtmlReporter implements Reporter {
  // Config
  private readonly _options: CustomHtmlReporterOptions;
  private readonly _logger: Logger;
  private readonly _tracker: SequenceTracker;

  // Collected data during the run
  private _testDataByProject: Map<string, TestReportData[]>;
  private _projectFiles: Map<string, string>; // projectName → testFile
  private _projectNames: string[];
  private _runStartTime: number;
  private _config: FullConfig | undefined;

  /**
   * Create a new CustomHtmlReporter.
   *
   * @param options - Reporter configuration options
   */
  constructor(options?: CustomHtmlReporterOptions) {
    this._options = options ?? {};

    // Init logger
    const logLevel = this._options.logLevel;
    const logDir = this._options.logDir;
    if (logLevel ?? logDir) {
      this._logger = createLogger({ logLevel, logDir });
    } else {
      this._logger = createSilentLogger();
    }

    this._tracker = new SequenceTracker(this._logger);
    this._testDataByProject = new Map();
    this._projectFiles = new Map();
    this._projectNames = [];
    this._runStartTime = Date.now();

    debugConsole('CustomHtmlReporter constructed');
  }

  // ---------------------------------------------------------------------------
  // Reporter interface
  // ---------------------------------------------------------------------------

  /**
   * Called once before any tests run. Extracts project names and builds the
   * sequence tracker from the project list.
   *
   * @param config - The full Playwright config
   * @param suite - The root test suite
   */
  onBegin(config: FullConfig, suite: Suite): void {
    this._config = config;
    this._runStartTime = Date.now();

    // Extract project names from root suite
    const projectNames = suite.suites.map((projectSuite) => projectSuite.project()?.name ?? '');
    this._projectNames = projectNames;

    this._tracker.buildFromProjectNames(projectNames);

    // Extract testMatch (file patterns) for each project from the config
    for (const project of config.projects) {
      const testMatch = project.testMatch;
      if (Array.isArray(testMatch) && testMatch.length > 0) {
        const first = testMatch[0];
        if (typeof first === 'string') {
          this._projectFiles.set(project.name, first);
        }
      } else if (typeof testMatch === 'string') {
        this._projectFiles.set(project.name, testMatch);
      }
    }

    const sequenceCount = this._tracker.getAllSequences().length;
    debugConsole(`onBegin: ${projectNames.length} projects, ${sequenceCount} sequences`);
    this._logger.info(
      { projectCount: projectNames.length, sequenceCount },
      'CustomHtmlReporter: initialized',
    );
  }

  /**
   * Called when an individual test begins.
   *
   * @param test - The test case starting
   * @param result - The (in-progress) test result
   */
  onTestBegin(test: TestCase, result: TestResult): void {
    const projectName = test.titlePath()[0] ?? '';
    this._tracker.recordTestStart(projectName);

    debugConsole(`onTestBegin: [${projectName}] ${test.title}`);

    // result is unused at this stage but required by the Reporter interface
    void result;
  }

  /**
   * Called when an individual test finishes. Collects timing and status data.
   *
   * @param test - The completed test case
   * @param result - The final test result
   */
  onTestEnd(test: TestCase, result: TestResult): void {
    const projectName = test.titlePath()[0] ?? '';

    // Collect test data
    const startTime = new Date(result.startTime).toISOString();
    const endMs = result.startTime.getTime() + result.duration;
    const endTime = new Date(endMs).toISOString();

    const testData: TestReportData = {
      title: test.title,
      titlePath: [...test.titlePath()],
      status: result.status as TestStatus,
      duration: result.duration,
      startTime,
      endTime,
      retry: result.retry,
      error:
        result.errors.length > 0
          ? result.errors.map((e) => e.message ?? String(e)).join('\n')
          : undefined,
    };

    // Group by project
    let projectTests = this._testDataByProject.get(projectName);
    if (!projectTests) {
      projectTests = [];
      this._testDataByProject.set(projectName, projectTests);
    }
    projectTests.push(testData);

    // Also extract the file path from the test's location if available
    if (test.location?.file && !this._projectFiles.has(projectName)) {
      this._projectFiles.set(projectName, test.location.file);
    }

    this._tracker.recordTestEnd(projectName, result.status);

    debugConsole(
      `onTestEnd: [${projectName}] ${test.title} → ${result.status} (${result.duration}ms)`,
    );
    this._logger.debug(
      {
        project: projectName,
        test: test.title,
        status: result.status,
        duration: result.duration,
      },
      'CustomHtmlReporter: test completed',
    );
  }

  /**
   * Called when the entire test run finishes. Builds the report data and writes
   * the self-contained HTML file to disk.
   *
   * @param result - The overall run result
   * @returns Promise that resolves when the HTML file has been written
   */
  async onEnd(result: FullResult): Promise<void> {
    const runEndTime = Date.now();
    const totalDuration = runEndTime - this._runStartTime;

    debugConsole(`onEnd: run status = ${result.status}, duration = ${totalDuration}ms`);
    this._logger.info(
      { status: result.status, totalDuration },
      'CustomHtmlReporter: run complete, generating report',
    );

    // Build the full ReportData
    const reportData = this._buildReportData(result, totalDuration);

    // Generate HTML
    const templateOptions: HtmlTemplateOptions = {
      showTimeline: this._options.showTimeline,
      showSummary: this._options.showSummary,
      showDependencyGraph: this._options.showDependencyGraph,
      showShardDistribution: this._options.showShardDistribution,
    };

    const html = generateHtmlReport(reportData, templateOptions);

    // Resolve output path
    const outputFile = this._options.outputFile ?? 'ordertest-report.html';
    const outputPath = path.isAbsolute(outputFile)
      ? outputFile
      : path.resolve(process.cwd(), outputFile);

    // Ensure parent directory exists
    const outputDir = path.dirname(outputPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, html, 'utf-8');

    debugConsole(`Report written to: ${outputPath}`);
    this._logger.info({ outputPath, htmlSize: html.length }, 'CustomHtmlReporter: report written');
  }

  /**
   * Indicates whether this reporter writes to stdio.
   * Returns false — all output goes to the HTML file.
   *
   * @returns false
   */
  printsToStdio(): boolean {
    return false;
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Assemble the top-level `ReportData` from all collected information.
   *
   * @param result - The overall run result
   * @param totalDuration - Total elapsed time in ms
   * @returns Complete report data object
   */
  private _buildReportData(result: FullResult, totalDuration: number): ReportData {
    const sequences = this._buildSequenceData();
    const dependencies = this._buildDependencyEdges();
    const shard = this._buildShardData();

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    for (const seq of sequences) {
      totalTests += seq.totalTests;
      totalPassed += seq.passedTests;
      totalFailed += seq.failedTests;
      totalSkipped += seq.skippedTests;
    }

    return {
      version: '0.0.0',
      generatedAt: new Date().toISOString(),
      totalDuration,
      runStatus: result.status,
      sequences,
      dependencies,
      shard,
      totalTests,
      totalPassed,
      totalFailed,
      totalSkipped,
    };
  }

  /**
   * Build per-sequence report data by aggregating step and test information.
   *
   * @returns Array of sequence report data objects
   */
  private _buildSequenceData(): SequenceReportData[] {
    const sequenceNames = this._tracker.getAllSequences();
    const result: SequenceReportData[] = [];

    for (const seqName of sequenceNames) {
      const steps = this._buildStepsForSequence(seqName);

      // Aggregate across all steps
      let totalTests = 0;
      let passedTests = 0;
      let failedTests = 0;
      let skippedTests = 0;
      let earliestStart = Number.POSITIVE_INFINITY;
      let latestEnd = Number.NEGATIVE_INFINITY;

      for (const step of steps) {
        totalTests += step.tests.length;
        passedTests += step.passedCount;
        failedTests += step.failedCount;
        skippedTests += step.skippedCount;

        const stepStart = new Date(step.startTime).getTime();
        const stepEnd = new Date(step.endTime).getTime();
        if (stepStart < earliestStart) earliestStart = stepStart;
        if (stepEnd > latestEnd) latestEnd = stepEnd;
      }

      const duration =
        Number.isFinite(earliestStart) && Number.isFinite(latestEnd)
          ? latestEnd - earliestStart
          : 0;

      const startTime = Number.isFinite(earliestStart)
        ? new Date(earliestStart).toISOString()
        : new Date().toISOString();
      const endTime = Number.isFinite(latestEnd)
        ? new Date(latestEnd).toISOString()
        : new Date().toISOString();

      // Determine overall status
      let status: 'passed' | 'failed' | 'mixed' = 'passed';
      if (failedTests > 0 && passedTests > 0) {
        status = 'mixed';
      } else if (failedTests > 0) {
        status = 'failed';
      }

      // Get mode/collapse metadata from the tracker
      const metadata = this._findSequenceMetadata(seqName);

      result.push({
        name: seqName,
        mode: metadata?.mode ?? 'serial',
        isCollapsed: metadata?.isCollapsed ?? false,
        steps,
        duration,
        startTime,
        endTime,
        status,
        totalTests,
        passedTests,
        failedTests,
        skippedTests,
      });
    }

    return result;
  }

  /**
   * Build the ordered list of steps for a single sequence.
   *
   * @param sequenceName - Name of the sequence to build steps for
   * @returns Array of step report data, sorted by step index
   */
  private _buildStepsForSequence(sequenceName: string): StepReportData[] {
    const steps: StepReportData[] = [];

    for (const projectName of this._projectNames) {
      const metadata = this._tracker.getSequenceMetadata(projectName);
      if (!metadata || metadata.sequenceName !== sequenceName) {
        continue;
      }

      const tests = this._testDataByProject.get(projectName) ?? [];
      const testFile = this._projectFiles.get(projectName) ?? 'unknown';

      let earliestStart = Number.POSITIVE_INFINITY;
      let latestEnd = Number.NEGATIVE_INFINITY;
      let passedCount = 0;
      let failedCount = 0;
      let skippedCount = 0;

      for (const t of tests) {
        const start = new Date(t.startTime).getTime();
        const end = new Date(t.endTime).getTime();
        if (start < earliestStart) earliestStart = start;
        if (end > latestEnd) latestEnd = end;

        if (t.status === 'passed') passedCount++;
        else if (t.status === 'failed' || t.status === 'interrupted') failedCount++;
        else if (t.status === 'skipped') skippedCount++;
      }

      const duration =
        Number.isFinite(earliestStart) && Number.isFinite(latestEnd)
          ? latestEnd - earliestStart
          : 0;

      const startTime = Number.isFinite(earliestStart)
        ? new Date(earliestStart).toISOString()
        : new Date().toISOString();
      const endTime = Number.isFinite(latestEnd)
        ? new Date(latestEnd).toISOString()
        : new Date().toISOString();

      steps.push({
        projectName,
        stepIndex: metadata.stepIndex,
        testFile,
        tests,
        startTime,
        endTime,
        duration,
        passedCount,
        failedCount,
        skippedCount,
      });
    }

    // Sort by step index so the sequence order is preserved
    steps.sort((a, b) => a.stepIndex - b.stepIndex);
    return steps;
  }

  /**
   * Build the list of directed dependency edges (step N → step N+1) for all
   * sequences, used to render the dependency graph.
   *
   * @returns Array of dependency edge objects
   */
  private _buildDependencyEdges(): DependencyEdge[] {
    const edges: DependencyEdge[] = [];

    for (const seqName of this._tracker.getAllSequences()) {
      const steps: Array<{ projectName: string; stepIndex: number }> = [];

      for (const projectName of this._projectNames) {
        const metadata = this._tracker.getSequenceMetadata(projectName);
        if (metadata && metadata.sequenceName === seqName) {
          steps.push({ projectName, stepIndex: metadata.stepIndex });
        }
      }

      steps.sort((a, b) => a.stepIndex - b.stepIndex);

      for (let i = 0; i < steps.length - 1; i++) {
        const current = steps[i];
        const next = steps[i + 1];
        if (current && next) {
          edges.push({
            from: current.projectName,
            to: next.projectName,
            sequenceName: seqName,
          });
        }
      }
    }

    return edges;
  }

  /**
   * Extract shard information from the Playwright config, if the run was sharded.
   *
   * @returns Shard report data, or undefined if not sharded
   */
  private _buildShardData(): ShardReportData | undefined {
    if (!this._config) return undefined;

    // Playwright exposes shard config as config.shard
    const shard = (this._config as unknown as Record<string, unknown>).shard as
      | { current: number; total: number }
      | undefined;

    if (!shard) return undefined;

    const sequenceNames = [...this._tracker.getAllSequences()];

    return {
      current: shard.current,
      total: shard.total,
      sequences: sequenceNames,
      hasCollapsed: false, // Accurate collapse detection requires OrderTestProjectMetadata
    };
  }

  /**
   * Find mode and collapse metadata for a sequence by searching the tracker.
   *
   * @param sequenceName - The sequence to look up
   * @returns Mode and isCollapsed values, or undefined if the sequence is unknown
   */
  private _findSequenceMetadata(
    sequenceName: string,
  ): { mode: ExecutionMode; isCollapsed: boolean } | undefined {
    for (const projectName of this._projectNames) {
      const metadata = this._tracker.getSequenceMetadata(projectName);
      if (metadata && metadata.sequenceName === sequenceName) {
        return { mode: metadata.mode, isCollapsed: metadata.isCollapsed };
      }
    }
    return undefined;
  }
}
