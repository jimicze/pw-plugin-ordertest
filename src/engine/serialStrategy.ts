/**
 * Serial execution strategy for @playwright-ordertest/core.
 *
 * Generates a chain of Playwright project configs where each project:
 * - Covers exactly one test file
 * - Runs with workers: 1 (strict serial execution)
 * - Depends on the previous project (enforcing order via Playwright's native scheduler)
 *
 * This strategy guarantees that test files are executed one at a time, in the
 * exact order defined in the sequence, with no parallelism at any level.
 */

import type {
  FileEntry,
  FileSpecification,
  OrderTestProjectMetadata,
  SequenceDefinition,
} from '../config/types.js';
import { PROJECT_NAME_PREFIX } from '../config/types.js';
import { type Logger, debugConsole } from '../logger/logger.js';
import { buildGrepPattern } from './testFilter.js';

// ---------------------------------------------------------------------------
// Generated Project Type
// ---------------------------------------------------------------------------

/** A generated Playwright project configuration. */
export interface GeneratedProject {
  readonly name: string;
  readonly testMatch: string | string[];
  readonly dependencies?: readonly string[];
  readonly workers?: number;
  readonly fullyParallel?: boolean;
  readonly grep?: RegExp;
  readonly retries?: number;
  readonly timeout?: number;
  readonly metadata?: OrderTestProjectMetadata;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a {@link FileEntry} to always return the object form.
 *
 * @param entry - A file entry that is either a plain string path or a {@link FileSpecification}
 * @returns An object with `file`, and optional `tests` and `tags` fields
 */
export function resolveFileEntry(entry: FileEntry): {
  file: string;
  tests?: readonly string[];
  tags?: readonly string[];
} {
  if (typeof entry === 'string') {
    return { file: entry };
  }

  const spec = entry as FileSpecification;
  return {
    file: spec.file,
    tests: spec.tests,
    tags: spec.tags,
  };
}

// ---------------------------------------------------------------------------
// Strategy
// ---------------------------------------------------------------------------

/**
 * Generate Playwright project configs for a sequence in serial execution mode.
 *
 * Each file in the sequence becomes its own project. Projects are chained with
 * `dependencies` so Playwright enforces the declared order natively. All projects
 * use `workers: 1` and `fullyParallel: false` to prevent any intra-file
 * parallelism.
 *
 * Test-level filtering (specific test names or tags) is applied via a `grep`
 * regex built by {@link buildGrepPattern}.
 *
 * @param sequence - The ordered sequence definition to generate projects for
 * @param logger - Optional pino logger for structured activity logging
 * @returns An ordered array of generated Playwright project configurations
 */
export function generateSerialProjects(
  sequence: SequenceDefinition,
  logger?: Logger,
): GeneratedProject[] {
  const totalSteps = sequence.files.length;

  debugConsole(
    `generateSerialProjects: sequence="${sequence.name}" mode=serial files=${totalSteps}`,
  );
  logger?.debug(
    { sequence: sequence.name, mode: 'serial', totalSteps },
    'Generating serial projects for sequence',
  );

  const projects: GeneratedProject[] = [];

  for (let index = 0; index < sequence.files.length; index++) {
    const entry = sequence.files[index];
    // noUncheckedIndexedAccess: entry could be undefined — guard it
    if (entry === undefined) {
      continue;
    }

    const { file, tests, tags } = resolveFileEntry(entry);
    const name = `${PROJECT_NAME_PREFIX}:${sequence.name}:${index}`;

    // Chain: project N depends on project N-1
    const dependencies: readonly string[] =
      index === 0 ? [] : [`${PROJECT_NAME_PREFIX}:${sequence.name}:${index - 1}`];

    // Merge sequence-level tags with file-level tags for grep
    const mergedTags =
      sequence.tags !== undefined || tags !== undefined
        ? [...(sequence.tags ?? []), ...(tags ?? [])]
        : undefined;

    const grep = buildGrepPattern(tests, mergedTags);

    const metadata: OrderTestProjectMetadata = {
      sequenceName: sequence.name,
      stepIndex: index,
      totalSteps,
      mode: 'serial',
      isCollapsed: false,
    };

    const project: GeneratedProject = {
      name,
      testMatch: file,
      dependencies,
      workers: 1,
      fullyParallel: false,
      ...(grep !== undefined && { grep }),
      ...(sequence.retries !== undefined && { retries: sequence.retries }),
      ...(sequence.timeout !== undefined && { timeout: sequence.timeout }),
      metadata,
    };

    debugConsole(
      `  → Step ${index}: project="${name}" file="${file}" deps=[${dependencies.join(', ')}]${grep !== undefined ? ` grep=${grep}` : ''}`,
    );
    logger?.debug(
      {
        project: name,
        file,
        dependencies,
        ...(grep !== undefined && { grep: grep.toString() }),
        stepIndex: index,
        totalSteps,
      },
      'Created serial project',
    );

    projects.push(project);
  }

  debugConsole(
    `generateSerialProjects: done, generated ${projects.length} project(s) for sequence="${sequence.name}"`,
  );
  logger?.debug(
    { sequence: sequence.name, projectCount: projects.length },
    'Serial project generation complete',
  );

  return projects;
}
