/**
 * Parallel execution strategy for @jimicze-pw/ordertest-core.
 *
 * Files in the sequence run in the defined order, enforced via Playwright's
 * `dependencies` mechanism. Tests within each file may use multiple workers
 * (`fullyParallel` remains false — Playwright's default).
 *
 * Each file becomes its own Playwright project. Project N depends on project N-1,
 * creating a strict execution chain while allowing intra-file parallelism.
 */

import type { OrderTestProjectMetadata, SequenceDefinition } from '../config/types.js';
import { PROJECT_NAME_PREFIX } from '../config/types.js';
import { debugConsole } from '../logger/logger.js';
import type { Logger } from '../logger/logger.js';
import type { GeneratedProject } from './serialStrategy.js';
import { resolveFileEntry } from './serialStrategy.js';
import { buildGrepPattern } from './testFilter.js';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate Playwright project configs for a sequence using parallel execution mode.
 *
 * Files execute in the declared order (each project depends on the previous),
 * but tests within each file run with Playwright's default worker distribution.
 * `fullyParallel` is not set (defaults to false).
 *
 * @param sequence - The sequence definition to convert into projects
 * @param logger - Optional pino logger for structured activity logging
 * @returns An array of generated Playwright project configs, one per file
 */
export function generateParallelProjects(
  sequence: SequenceDefinition,
  logger?: Logger,
): GeneratedProject[] {
  const totalSteps = sequence.files.length;

  debugConsole(
    `generateParallelProjects: sequence="${sequence.name}" mode=parallel files=${totalSteps}${sequence.workers !== undefined ? ` workers=${sequence.workers}` : ''}`,
  );
  logger?.debug(
    { sequence: sequence.name, mode: 'parallel', totalSteps, workers: sequence.workers },
    'Generating parallel projects for sequence',
  );

  const projects: GeneratedProject[] = [];

  for (let index = 0; index < sequence.files.length; index++) {
    const fileEntry = sequence.files[index];

    // fileEntry is always defined here — noUncheckedIndexedAccess requires the guard
    if (fileEntry === undefined) {
      continue;
    }

    const resolved = resolveFileEntry(fileEntry);
    const projectName = `${PROJECT_NAME_PREFIX}:${sequence.name}:${index}`;
    const prevProjectName =
      index > 0 ? `${PROJECT_NAME_PREFIX}:${sequence.name}:${index - 1}` : undefined;

    const metadata: OrderTestProjectMetadata = {
      sequenceName: sequence.name,
      stepIndex: index,
      totalSteps,
      mode: 'parallel',
      isCollapsed: false,
    };

    // Apply grep if there are test-level or tag filters
    const grepPattern = buildGrepPattern(resolved.tests, resolved.tags ?? sequence.tags);

    const project: GeneratedProject = {
      name: projectName,
      testMatch: resolved.file,
      fullyParallel: false,
      metadata,
      ...(prevProjectName !== undefined ? { dependencies: [prevProjectName] } : {}),
      ...(sequence.workers !== undefined ? { workers: sequence.workers } : {}),
      ...(sequence.retries !== undefined ? { retries: sequence.retries } : {}),
      ...(sequence.timeout !== undefined ? { timeout: sequence.timeout } : {}),
      ...(grepPattern !== undefined ? { grep: grepPattern } : {}),
      ...(sequence.browser !== undefined ? { use: { browserName: sequence.browser } } : {}),
    };

    projects.push(project);

    debugConsole(
      `  → project[${index}] "${projectName}" file="${resolved.file}"${prevProjectName !== undefined ? ` deps=["${prevProjectName}"]` : ' deps=[]'}${sequence.workers !== undefined ? ` workers=${sequence.workers}` : ''}${grepPattern !== undefined ? ` grep=${String(grepPattern)}` : ''}${sequence.browser !== undefined ? ` browser=${sequence.browser}` : ''}`,
    );
    logger?.debug(
      {
        projectName,
        file: resolved.file,
        dependencies: prevProjectName !== undefined ? [prevProjectName] : [],
        workers: sequence.workers,
        grep: grepPattern !== undefined ? String(grepPattern) : undefined,
        browser: sequence.browser,
        stepIndex: index,
        totalSteps,
      },
      'Created parallel project',
    );
  }

  debugConsole(
    `generateParallelProjects: done — ${projects.length} project(s) for sequence="${sequence.name}"`,
  );
  logger?.debug(
    { sequence: sequence.name, projectCount: projects.length },
    'Parallel project generation complete',
  );

  return projects;
}

// ---------------------------------------------------------------------------
// Re-exports (for consumers that only import from this module)
// ---------------------------------------------------------------------------

export type { GeneratedProject } from './serialStrategy.js';
export { resolveFileEntry } from './serialStrategy.js';
