import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { FullResult, Reporter, TestCase, TestResult } from '@playwright/test/reporter';

interface Attempt {
  retry: number;
  status: TestResult['status'];
  startedAt: string;
  durationMs: number;
  error?: string;
}

interface CaseResult {
  title: string;
  project: string;
  expectedStatus: TestCase['expectedStatus'];
  attempts: Attempt[];
  skipReason?: string;
}

/**
 * Live authentication may place credentials, codes or tokens in Playwright's
 * normal error logs, worker output and attachments. This reporter records only
 * authored test names and execution metadata. Keep test/project titles static.
 */
export default class SafeLiveReporter implements Reporter {
  private readonly cases = new Map<string, CaseResult>();
  private fatalErrors = 0;

  printsToStdio() { return true; }

  // Intentionally discard worker output, including browser/HTTP diagnostics.
  onStdOut() {}
  onStdErr() {}

  onError() {
    this.fatalErrors++;
    process.stdout.write('LIVE fatal error: execution could not complete. Details omitted to protect credentials.\n');
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const title = test.titlePath().filter(Boolean).join(' > ');
    const project = test.parent.project()?.name ?? 'live';
    const key = `${project}\u0000${title}`;
    const entry = this.cases.get(key) ?? { title, project, expectedStatus: test.expectedStatus, attempts: [] };
    entry.expectedStatus = test.expectedStatus;
    if (result.status === 'skipped') {
      entry.skipReason = test.title === 'enforces the restricted account permissions in the real API and workspace'
        ? 'Secondary QA identity not configured; authorization between roles was not verified.'
        : 'This check was not executed and is not verified.';
    }
    entry.attempts.push({
      retry: result.retry,
      status: result.status,
      startedAt: result.startTime.toISOString(),
      durationMs: result.duration,
      ...(result.errors.length ? { error: 'Test failed. Diagnostic details omitted to protect credentials.' } : {}),
    });
    this.cases.set(key, entry);
    process.stdout.write(`LIVE ${result.status}: ${title}\n`);
  }

  async onEnd(result: FullResult) {
    const cases = [...this.cases.values()];
    const counts = { total: cases.length, passed: 0, skipped: 0, failed: 0, timedOut: 0, interrupted: 0, retried: 0, flaky: 0 };
    for (const entry of cases) {
      const last = entry.attempts.at(-1)!;
      counts[last.status]++;
      if (entry.attempts.some(attempt => attempt.retry > 0)) counts.retried++;
      if (last.status === 'passed' && entry.attempts.some(attempt => !['passed', 'skipped'].includes(attempt.status))) counts.flaky++;
    }
    const directory = resolve('test-results', 'live');
    const report = {
      kind: 'live-authentication',
      startedAt: result.startTime.toISOString(),
      finishedAt: new Date().toISOString(),
      durationMs: result.duration,
      status: result.status,
      coverageStatus: result.status !== 'passed' ? 'incomplete' : counts.skipped ? 'partial' : 'complete',
      counts,
      fatalErrors: this.fatalErrors,
      ...(this.fatalErrors ? { fatalError: 'Execution error. Diagnostic details omitted to protect credentials.' } : {}),
      cases,
      privacy: 'No credentials, URLs, request/response payloads, headers, storage, worker output, attachments, step arguments or exception details are recorded.',
    };
    try {
      await mkdir(directory, { recursive: true });
      await writeFile(resolve(directory, 'live-results.json'), `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    } catch {
      process.stdout.write('LIVE report could not be saved. Diagnostic details omitted to protect credentials.\n');
      return { status: 'failed' as const };
    }
    process.stdout.write(`LIVE summary: ${counts.passed} passed, ${counts.skipped} skipped, ${counts.failed + counts.timedOut + counts.interrupted} unsuccessful.\n`);
  }
}
