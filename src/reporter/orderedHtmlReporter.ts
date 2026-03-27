/**
 * Ordered HTML Reporter — injects sequence metadata into Playwright test results.
 *
 * This reporter tracks which ordered sequence each test belongs to and attaches
 * structured sequence metadata as a test attachment (`ordertest-sequence`).
 * It is designed to be used alongside Playwright's built-in HTML reporter.
 *
 * Usage in playwright.config.ts:
 * ```ts
 * import OrderedHtmlReporter from '@playwright-ordertest/core/reporter';
 *
 * export default defineConfig({
 *   reporter: [
 *     ['html'],
 *     [OrderedHtmlReporter, { showSequenceTimeline: true }],
 *   ],
 * });
 * ```
 *
 * Playwright requires reporters to be default exports — this is the ONE exception
 * to the "no default exports" rule in this codebase.
 */

import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter';

import type { LogLevel } from '../config/types.js';
import type { Logger } from '../logger/logger.js';
import { createLogger, createSilentLogger, debugConsole } from '../logger/logger.js';
import { SequenceTracker } from './sequenceTracker.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Configuration options for the OrderedHtmlReporter.
 */
export interface OrderedHtmlReporterOptions {
  /** Output folder for the HTML report (pass-through to PW HTML reporter). */
  readonly outputFolder?: string;

  /** When to open the HTML report (pass-through to PW HTML reporter). */
  readonly open?: 'always' | 'never' | 'on-failure';

  /**
   * Whether to render a sequence timeline in the report.
   * Default: true.
   */
  readonly showSequenceTimeline?: boolean;

  /**
   * Whether to prefix test titles with their sequence name.
   * Default: true.
   */
  readonly showSequenceInTestTitle?: boolean;

  /** Log level for the plugin's persistent activity logger. */
  readonly logLevel?: LogLevel;

  /** Directory for log files (relative to project root). Default: '.ordertest'. */
  readonly logDir?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Walk up the suite hierarchy from a TestCase to determine its project name.
 *
 * Playwright's title path structure is:
 *   [projectName, fileName, ...describePath, testTitle]
 *
 * Using `test.titlePath()[0]` is the simplest reliable way to get the project name
 * without importing Playwright internals or relying on private Suite APIs.
 *
 * @param test - The TestCase whose project name to retrieve
 * @returns The project name string, or an empty string if unavailable
 */
function getProjectName(test: TestCase): string {
  const titlePath = test.titlePath();
  return titlePath[0] ?? '';
}

/**
 * Extract all project names from the root suite's direct children.
 *
 * In Playwright's suite tree, the root Suite's direct children are project-level
 * suites. Each has a `project()` method returning the project config.
 *
 * @param rootSuite - The root Suite provided in `onBegin`
 * @returns Array of project name strings (may include empty strings for unnamed projects)
 */
function extractProjectNames(rootSuite: Suite): string[] {
  return rootSuite.suites.map((projectSuite) => projectSuite.project()?.name ?? '');
}

// ---------------------------------------------------------------------------
// Reporter Class
// ---------------------------------------------------------------------------

/**
 * Ordered HTML Reporter for @playwright-ordertest/core.
 *
 * Tracks which ordered sequence each test belongs to and attaches JSON metadata
 * as a `ordertest-sequence` attachment on every test result. This enables downstream
 * tooling (custom HTML templates, CI dashboards) to render sequence-aware reports.
 *
 * Implements the Playwright `Reporter` interface. Must be used as a default export
 * per Playwright's reporter loading mechanism.
 */
export default class OrderedHtmlReporter implements Reporter {
  private readonly _tracker: SequenceTracker;
  private readonly _logger: Logger;
  private readonly _options: OrderedHtmlReporterOptions;

  /**
   * Create a new OrderedHtmlReporter instance.
   *
   * @param options - Optional configuration for the reporter
   */
  constructor(options?: OrderedHtmlReporterOptions) {
    this._options = options ?? {};

    // Initialise logger — falls back to silent if options not provided
    const logLevel = this._options.logLevel;
    const logDir = this._options.logDir;

    if (logLevel ?? logDir) {
      this._logger = createLogger({
        logLevel,
        logDir,
      });
    } else {
      this._logger = createSilentLogger();
    }

    this._tracker = new SequenceTracker(this._logger);

    debugConsole('OrderedHtmlReporter constructed');
  }

  // -------------------------------------------------------------------------
  // Reporter interface methods
  // -------------------------------------------------------------------------

  /**
   * Called once before any tests run. Builds the sequence map from project names.
   *
   * @param config - The resolved Playwright config
   * @param suite - The root test suite containing all projects
   */
  onBegin(config: FullConfig, suite: Suite): void {
    const projectNames = extractProjectNames(suite);

    this._logger.info(
      { projectNames, totalProjects: projectNames.length },
      'OrderedHtmlReporter: building sequence map from project names',
    );

    this._tracker.buildFromProjectNames(projectNames);

    const sequenceCount = this._tracker.getAllSequences().length;
    debugConsole(
      `onBegin: ${projectNames.length} projects → ${sequenceCount} ordered sequence(s) detected`,
    );

    this._logger.debug(
      { sequenceCount, showTimeline: this._options.showSequenceTimeline ?? true },
      'OrderedHtmlReporter: sequence map built',
    );

    // Suppress unused-variable warning for config — it is part of the interface signature.
    void config;
  }

  /**
   * Called when a test starts. Records the start in the sequence tracker.
   *
   * @param test - The test case that is beginning
   * @param result - The mutable test result (not yet complete)
   */
  onTestBegin(test: TestCase, result: TestResult): void {
    const projectName = getProjectName(test);

    this._tracker.recordTestStart(projectName);

    this._logger.debug(
      { project: projectName, test: test.title },
      'OrderedHtmlReporter: test started',
    );

    debugConsole(`onTestBegin: [${projectName}] ${test.title}`);

    // Suppress unused-variable warning — result is part of the interface signature.
    void result;
  }

  /**
   * Called when a test finishes. Attaches sequence metadata to the test result.
   *
   * The metadata is serialised as JSON in an `ordertest-sequence` attachment so that
   * downstream HTML templates and CI reporters can render sequence-aware output without
   * re-running the plugin.
   *
   * @param test - The test case that completed
   * @param result - The mutable result object to which metadata is attached
   */
  onTestEnd(test: TestCase, result: TestResult): void {
    const projectName = getProjectName(test);
    const metadata = this._tracker.getSequenceMetadata(projectName);

    if (metadata !== undefined) {
      const shouldPrefixTitle = this._options.showSequenceInTestTitle ?? true;
      const positionLabel = shouldPrefixTitle ? ` [${metadata.position}]` : '';

      this._logger.info(
        {
          test: test.title,
          sequence: metadata.sequenceName,
          position: metadata.position,
          status: result.status,
        },
        `OrderedHtmlReporter: test completed${positionLabel}`,
      );

      // Attach structured metadata so downstream tools can consume it
      result.attachments.push({
        name: 'ordertest-sequence',
        contentType: 'application/json',
        body: Buffer.from(JSON.stringify(metadata)),
      });

      debugConsole(
        `onTestEnd: [${metadata.sequenceName}] ${metadata.position} — ${test.title} (${result.status})`,
      );
    } else {
      this._logger.debug(
        { project: projectName, test: test.title },
        'OrderedHtmlReporter: test not part of an ordered sequence',
      );

      debugConsole(`onTestEnd: [${projectName}] ${test.title} — not in a sequence`);
    }

    this._tracker.recordTestEnd(projectName, result.status);
  }

  /**
   * Called after all tests have finished. Logs the final sequence summary.
   *
   * @param result - The aggregate result of the entire test run
   */
  onEnd(result: FullResult): void {
    const sequenceNames = this._tracker.getAllSequences();
    const summary = sequenceNames.map((name) => this._tracker.getProgress(name));

    this._logger.info(
      { status: result.status, sequences: summary },
      'OrderedHtmlReporter: run complete — sequence summary',
    );

    debugConsole(`onEnd: run status = ${result.status}`);
    for (const entry of summary) {
      if (entry !== undefined) {
        debugConsole(
          `  sequence "${entry.sequenceName}": ${entry.passedTests} passed, ${entry.failedTests} failed, ${entry.skippedTests} skipped`,
        );
      }
    }

    this._logger.debug({ summary }, 'OrderedHtmlReporter: full sequence progress dump');
  }

  /**
   * Whether this reporter writes to stdio. Returns false — we use file logging only.
   *
   * @returns false
   */
  printsToStdio(): boolean {
    return false;
  }
}
