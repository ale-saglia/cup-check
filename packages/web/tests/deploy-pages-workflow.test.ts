import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const workflowPath = path.join(repoRoot, '.github/workflows/deploy-pages.yml');
const preparePinnedWebActionPath = path.join(
  repoRoot,
  '.github/actions/prepare-pinned-web/action.yml',
);
const releaseWebWorkflowPath = path.join(repoRoot, '.github/workflows/release-web.yml');
const releasePythonWorkflowPath = path.join(repoRoot, '.github/workflows/release-python.yml');

function loadYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

function workflowSteps() {
  const workflow = loadYaml(workflowPath);
  return workflow.jobs.deploy.steps;
}

function preparePinnedWebAction() {
  return loadYaml(preparePinnedWebActionPath);
}

function releaseDownloadCommand(runScript, pattern) {
  return runScript
    .split(/(?=gh release download)/)
    .find((command) => command.includes(`--pattern "${pattern}"`));
}

describe('deploy-pages workflow', () => {
  it('pubblica su Pages anche il bundle sigstore del manifest dataset', () => {
    const downloadStep = workflowSteps().find(
      (step) => step.name === 'Download latest dataset files',
    );
    const signatureDownload = releaseDownloadCommand(
      downloadStep.run,
      'dataset-manifest.json.sigstore.json',
    );

    expect(downloadStep).toBeDefined();
    expect(downloadStep.run).toContain('--pattern "dataset-manifest.json"');
    expect(signatureDownload).toContain('--dir "dist/pages-root/datasets/${TAG}"');
  });

  it('isola il checkout fallback del web pinnato dal workspace del caller', () => {
    const action = preparePinnedWebAction();
    const fallbackCheckout = action.runs.steps.find(
      (step) => step.uses?.startsWith('actions/checkout@') && step.if?.includes('failure'),
    );
    const buildStep = action.runs.steps.find(
      (step) => step.name === 'Build pinned web from software tag',
    );

    expect(action.inputs['source-dir'].default).toBe('.pinned-web-src');
    expect(fallbackCheckout.with.path).toBe('${{ inputs.source-dir }}');
    expect(buildStep.env.SOURCE_DIR).toBe('${{ github.workspace }}/${{ inputs.source-dir }}');
    expect(buildStep.run).toContain('cd "${SOURCE_DIR}/packages/web"');
    expect(buildStep.run).not.toContain('cd "${GITHUB_WORKSPACE}/packages/web"');
  });

  it('serializza le release software per workflow e ref', () => {
    const releaseWeb = loadYaml(releaseWebWorkflowPath);
    const releasePython = loadYaml(releasePythonWorkflowPath);

    for (const workflow of [releaseWeb, releasePython]) {
      expect(workflow.concurrency.group).toBe('release-${{ github.workflow }}-${{ github.ref }}');
      expect(workflow.concurrency['cancel-in-progress']).toBe(false);
    }
  });

  it('limita i permessi write della release web al job che pubblica', () => {
    const releaseWeb = loadYaml(releaseWebWorkflowPath);

    expect(releaseWeb.permissions.contents).toBe('read');
    expect(releaseWeb.jobs.release.permissions.contents).toBe('write');
  });
});
