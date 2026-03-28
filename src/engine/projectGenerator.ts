/**
 * Project generator for @jimicze-pw/ordertest-core.
 *
 * Routes each sequence to the correct execution strategy and assembles the final
 * Playwright `projects[]` array. Also provides helpers for extracting the set of
 * files claimed by ordered sequences so that the unordered passthrough project can
 * be constructed by the caller (defineOrderedConfig).
 *
 * Dependency graph position:
 *   types.ts → (serialStrategy | parallelStrategy | fullyParallelStrategy)
 *   → projectGenerator.ts → defineOrderedConfig.ts
 */

import type { FileEntry, SequenceDefinition } from '../config/types.js';
import { UNORDERED_PROJECT_NAME } from '../config/types.js';
import { type Logger, debugConsole } from '../logger/logger.js';
import { generateFullyParallelProjects } from './fullyParallelStrategy.js';
import { generateParallelProjects } from './parallelStrategy.js';
import {
  type GeneratedProject,
  generateSerialProjects,
  resolveFileEntry,
} from './serialStrategy.js';

// Re-export GeneratedProject so consumers only need to import from this module.
export type { GeneratedProject } from './serialStrategy.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Resolve a {@link FileEntry} to its file path string.
 *
 * @param entry - A string path or a {@link FileSpecification} object
 * @returns The normalized file path
 */
function entryToPath(entry: FileEntry): string {
  return resolveFileEntry(entry).file;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Collect and deduplicate all file paths referenced across all ordered sequences.
 *
 * Used by `defineOrderedConfig` to build the `testIgnore` list for the unordered
 * passthrough project, ensuring that files already covered by an ordered sequence
 * are not re-run outside of it.
 *
 * @param sequences - All ordered sequence definitions
 * @returns A deduplicated array of file path strings
 */
export function collectOrderedFiles(sequences: readonly SequenceDefinition[]): string[] {
  const seen = new Set<string>();

  for (const sequence of sequences) {
    for (const entry of sequence.files) {
      if (entry !== undefined) {
        seen.add(entryToPath(entry));
      }
    }
  }

  const files = Array.from(seen);

  debugConsole(
    `collectOrderedFiles: ${files.length} unique file(s) across ${sequences.length} sequence(s)`,
  );

  return files;
}

/**
 * Route each sequence to the correct execution strategy and assemble the combined
 * Playwright projects array.
 *
 * Strategy routing:
 * - `'serial'`       → {@link generateSerialProjects}       (workers: 1, fullyParallel: false)
 * - `'parallel'`     → {@link generateParallelProjects}     (default workers, fullyParallel: false)
 * - `'fullyParallel'`→ {@link generateFullyParallelProjects}(default workers, fullyParallel: true)
 *
 * @param sequences - Ordered sequence definitions from the plugin config or manifest
 * @param logger    - Optional pino logger for structured activity logging
 * @returns Flat array of generated Playwright project configs, in sequence declaration order
 */
export function generateProjects(
  sequences: readonly SequenceDefinition[],
  logger?: Logger,
): GeneratedProject[] {
  debugConsole(`generateProjects: routing ${sequences.length} sequence(s) to strategies`);
  logger?.debug({ sequenceCount: sequences.length }, 'generateProjects: start');

  const allProjects: GeneratedProject[] = [];

  for (const sequence of sequences) {
    debugConsole(
      `  → sequence="${sequence.name}" mode="${sequence.mode}" files=${sequence.files.length}`,
    );
    logger?.debug(
      { sequence: sequence.name, mode: sequence.mode, files: sequence.files.length },
      'Routing sequence to strategy',
    );

    let sequenceProjects: GeneratedProject[];

    switch (sequence.mode) {
      case 'serial': {
        sequenceProjects = generateSerialProjects(sequence, logger);
        break;
      }
      case 'parallel': {
        sequenceProjects = generateParallelProjects(sequence, logger);
        break;
      }
      case 'fullyParallel': {
        sequenceProjects = generateFullyParallelProjects(sequence, logger);
        break;
      }
      default: {
        // Exhaustive check — TypeScript will error here if a new mode is added to
        // ExecutionMode without a corresponding case above.
        const _exhaustive: never = sequence.mode;
        throw new Error(`[ordertest] Unknown execution mode: ${String(_exhaustive)}`);
      }
    }

    debugConsole(`  ✓ sequence="${sequence.name}" generated ${sequenceProjects.length} project(s)`);
    logger?.debug(
      { sequence: sequence.name, projectCount: sequenceProjects.length },
      'Strategy produced projects',
    );

    allProjects.push(...sequenceProjects);
  }

  debugConsole(`generateProjects: done — ${allProjects.length} total project(s)`);
  logger?.debug({ totalProjects: allProjects.length }, 'generateProjects: complete');

  return allProjects;
}

/**
 * Generate the passthrough project that captures all test files NOT claimed by any
 * ordered sequence.
 *
 * The returned project uses `testMatch: '**\/*'` (catch-all). The caller
 * (`defineOrderedConfig`) is responsible for setting `testIgnore` on the final
 * Playwright project config to exclude the files returned by {@link collectOrderedFiles}.
 *
 * The project has no `dependencies` so Playwright will schedule it freely alongside
 * (or after) the ordered chains, depending on worker availability.
 *
 * @param sequences - All ordered sequence definitions (used to derive the ignore list)
 * @param logger    - Optional pino logger for structured activity logging
 * @returns A single {@link GeneratedProject} named `ordertest:unordered`
 */
export function generateUnorderedProject(
  sequences: readonly SequenceDefinition[],
  logger?: Logger,
): GeneratedProject {
  const orderedFiles = collectOrderedFiles(sequences);

  debugConsole(
    `generateUnorderedProject: creating passthrough project (ignoring ${orderedFiles.length} ordered file(s))`,
  );
  logger?.debug(
    { orderedFileCount: orderedFiles.length, orderedFiles },
    'generateUnorderedProject: creating passthrough project',
  );

  const project: GeneratedProject = {
    name: UNORDERED_PROJECT_NAME,
    testMatch: '**/*',
  };

  debugConsole(`generateUnorderedProject: project="${UNORDERED_PROJECT_NAME}" testMatch="**/*"`);
  logger?.debug(
    { projectName: UNORDERED_PROJECT_NAME, testMatch: '**/*' },
    'generateUnorderedProject: complete',
  );

  return project;
}
