/**
 * FullyParallel execution strategy for @playwright-ordertest/core.
 *
 * Files in the sequence run in defined order (chained via project dependencies),
 * while tests *within* each file run fully in parallel — each test gets its own
 * Playwright worker. This contrasts with the parallel strategy, where tests within
 * a file share the same worker group.
 *
 * Key difference from parallelStrategy: every generated project has `fullyParallel: true`.
 */

import type { OrderTestProjectMetadata, SequenceDefinition } from '../config/types.js';
import { PROJECT_NAME_PREFIX } from '../config/types.js';
import { debugConsole } from '../logger/logger.js';
import type { Logger } from '../logger/logger.js';
import type { GeneratedProject } from './serialStrategy.js';
import { resolveFileEntry } from './serialStrategy.js';
import { buildGrepPattern } from './testFilter.js';

// Re-export GeneratedProject so consumers can import from this module if needed.
export type { GeneratedProject };

// ---------------------------------------------------------------------------
// Strategy Implementation
// ---------------------------------------------------------------------------

/**
 * Generate Playwright project configs for a sequence using the fullyParallel strategy.
 *
 * Each file in the sequence becomes its own Playwright project with:
 * - `fullyParallel: true` — every test in the file runs on its own worker
 * - A dependency on the previous project — enforcing file-level ordering
 * - Optional grep filter — when specific tests or tags are requested
 * - Optional worker/retry/timeout overrides — propagated from the sequence definition
 *
 * @param sequence - The ordered sequence definition to generate projects for
 * @param logger   - Optional pino logger for structured file logging
 * @returns Array of generated Playwright project configs, one per file
 */
export function generateFullyParallelProjects(
  sequence: SequenceDefinition,
  logger?: Logger,
): GeneratedProject[] {
  const totalSteps = sequence.files.length;

  debugConsole(
    `generateFullyParallelProjects: sequence="${sequence.name}" mode=fullyParallel` +
      ` files=${totalSteps} workers=${sequence.workers ?? 'default'}`,
  );
  logger?.debug(
    { sequenceName: sequence.name, mode: 'fullyParallel', totalSteps, workers: sequence.workers },
    'generateFullyParallelProjects: start',
  );

  const projects: GeneratedProject[] = [];

  for (let index = 0; index < sequence.files.length; index++) {
    const fileEntry = sequence.files[index];

    // fileEntry is always defined because index < sequence.files.length,
    // but noUncheckedIndexedAccess requires a guard.
    if (fileEntry === undefined) {
      continue;
    }

    const { file, tests, tags } = resolveFileEntry(fileEntry);
    const projectName = `${PROJECT_NAME_PREFIX}:${sequence.name}:${index}`;

    // Build dependency chain: project N depends on project N-1.
    const dependencies: string[] =
      index > 0 ? [`${PROJECT_NAME_PREFIX}:${sequence.name}:${index - 1}`] : [];

    // Build grep pattern when test-level or tag filtering is requested.
    let grep: RegExp | undefined;
    const effectiveTags = [...(tags ?? []), ...(sequence.tags ?? [])];
    if ((tests && tests.length > 0) || effectiveTags.length > 0) {
      grep = buildGrepPattern(tests, effectiveTags.length > 0 ? effectiveTags : undefined);
    }

    const metadata: OrderTestProjectMetadata = {
      sequenceName: sequence.name,
      stepIndex: index,
      totalSteps,
      mode: 'fullyParallel',
      isCollapsed: false,
    };

    const project: GeneratedProject = {
      name: projectName,
      testMatch: [file],
      fullyParallel: true,
      dependencies,
      metadata,
      ...(grep !== undefined && { grep }),
      ...(sequence.workers !== undefined && { workers: sequence.workers }),
      ...(sequence.retries !== undefined && { retries: sequence.retries }),
      ...(sequence.timeout !== undefined && { timeout: sequence.timeout }),
    };

    debugConsole(
      `  step ${index}/${totalSteps - 1}: project="${projectName}" file="${file}"` +
        ` fullyParallel=true deps=[${dependencies.join(', ')}]` +
        `${grep !== undefined ? ` grep=${grep.toString()}` : ''}`,
    );
    logger?.debug(
      {
        projectName,
        file,
        fullyParallel: true,
        dependencies,
        grep: grep?.toString(),
        workers: sequence.workers,
        retries: sequence.retries,
        timeout: sequence.timeout,
        stepIndex: index,
        totalSteps,
      },
      'generateFullyParallelProjects: project created',
    );

    projects.push(project);
  }

  debugConsole(
    `generateFullyParallelProjects: done sequence="${sequence.name}" projects=${projects.length}`,
  );
  logger?.debug(
    { sequenceName: sequence.name, projectCount: projects.length },
    'generateFullyParallelProjects: complete',
  );

  return projects;
}
