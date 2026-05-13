import { createServer } from 'node:net';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import axe from 'axe-core';
import JSZip from 'jszip';
import { chromium } from 'playwright';
import { CHROME_NOT_FOUND_MESSAGE, findChromePath } from './chrome-path.mjs';

const ROW_COUNT = 10000;
const MAX_TOTAL_MS = 5000;
const XSS_PAYLOAD = '"><img src=x onerror=alert(1)>';

const port = await getFreePort();
const server = spawn(
  'npm',
  ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
  {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);

try {
  const baseUrl = `http://127.0.0.1:${port}/`;
  await waitForHttp(baseUrl);
  const xlsxPath = await writeAcceptanceWorkbook();
  const result = await runBrowserAcceptance(baseUrl, xlsxPath);

  assert(
    result.controllerAfterOnlineReload,
    'service worker non controlla la pagina dopo il reload online',
  );
  assert(result.darkMode.matches, 'prefers-color-scheme: dark non è attivo nel browser');
  assert(
    result.darkMode.rootBackground === 'rgb(13, 17, 23)',
    `background root dark inatteso: ${result.darkMode.rootBackground}`,
  );
  assert(
    result.darkMode.bodyBackground === 'rgb(13, 17, 23)',
    `background body dark inatteso: ${result.darkMode.bodyBackground}`,
  );
  assert(
    result.darkMode.textColor === 'rgb(255, 255, 255)',
    `colore testo dark inatteso: ${result.darkMode.textColor}`,
  );
  assert(
    result.xssResultsImageCount === 0,
    'payload HTML renderizzato come immagine nei risultati',
  );
  assert(
    result.xssResultsText.includes('<IMG SRC=X ONERROR=ALERT(1)>'),
    `payload HTML non presente come testo nei risultati: ${result.xssResultsText}`,
  );
  assert(result.previewImageCount === 0, 'payload HTML renderizzato come immagine in anteprima');
  assert(result.summary.includes(`${ROW_COUNT} righe`), `riepilogo inatteso: ${result.summary}`);
  assert(result.groupToggleDefault, 'il toggle raggruppa CUP uguali non è attivo di default');
  assert(
    result.ungroupedSummary.includes(`${ROW_COUNT} righe verificate`),
    `riepilogo non raggruppato inatteso: ${result.ungroupedSummary}`,
  );
  assert(result.textPanelCollapsedAfterUpload, 'il pannello testo resta aperto dopo upload file');
  assert(
    result.totalUploadToResultsMs < MAX_TOTAL_MS,
    `upload + verifica + render troppo lenti: ${result.totalUploadToResultsMs} ms`,
  );
  assert(
    result.offlineOk,
    `reload offline non riuscito: ${result.offlineError ?? 'errore sconosciuto'}`,
  );
  assert(
    result.pdfExtractedCupCount >= 3,
    `PDF extraction ha trovato meno CUP del previsto: ${result.pdfExtractedCupCount}`,
  );
  assert(result.pdfPreviewShown, 'Apri nel verificatore non ha aperto il pannello anteprima');
  assert(
    result.pdfColumnSelected === '0',
    `Colonna cup non preselezionata nell'anteprima: ${result.pdfColumnSelected}`,
  );

  console.log(JSON.stringify(result, null, 2));
} finally {
  stopServer(server);
}

async function runBrowserAcceptance(baseUrl, xlsxPath) {
  const chromePath = await findChromePath();
  if (!chromePath) {
    throw new Error(CHROME_NOT_FOUND_MESSAGE);
  }

  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({ colorScheme: 'dark' });
  const page = await context.newPage();
  const out = {};

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    out.a11y = await runA11yAudit(page);
    out.darkMode = await page.evaluate(() => ({
      matches: window.matchMedia('(prefers-color-scheme: dark)').matches,
      rootBackground: getComputedStyle(document.documentElement).backgroundColor,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      textColor: getComputedStyle(document.documentElement).color,
    }));
    await page.waitForFunction(async () => {
      if (!('serviceWorker' in navigator)) {
        return false;
      }
      const registration = await navigator.serviceWorker.ready;
      return Boolean(registration.active);
    });
    await page.reload({ waitUntil: 'networkidle' });
    out.controllerAfterOnlineReload = await page.evaluate(() =>
      Boolean(navigator.serviceWorker?.controller),
    );

    await page.locator('#cup-textarea').fill(XSS_PAYLOAD);
    await page.click('#text-check-button');
    await page.waitForSelector('#results-panel:not(.hidden)');
    out.xssResultsImageCount = await page.locator('#results-table img').count();
    out.xssResultsText = await page.locator('#results-table').textContent();
    await page.click('#clear-button');
    await page.waitForSelector('#results-panel.hidden', { state: 'attached' });

    const started = Date.now();
    await page.setInputFiles('#file-input', xlsxPath);
    await page.waitForSelector('#preview-panel:not(.hidden)');
    out.previewImageCount = await page.locator('#preview-table img').count();
    out.textPanelCollapsedAfterUpload =
      (await page
        .locator('#text')
        .evaluate((element) => element.classList.contains('collapsed'))) &&
      (await page.locator('#text-toggle').getAttribute('aria-expanded')) === 'false';
    await page.locator('#skip-missing-cup').uncheck();
    await page.click('#check-button');
    await page.waitForSelector('#results-panel:not(.hidden)');
    out.totalUploadToResultsMs = Date.now() - started;
    out.meta = await page.locator('#file-meta').textContent();
    out.selectedColumn = await page.locator('#column-select').inputValue();
    out.summary = await page.locator('#summary').textContent();
    out.groupToggleDefault = await page.locator('#group-same-cups').isChecked();
    await page.locator('#group-same-cups').uncheck();
    out.ungroupedSummary = await page.locator('#summary').textContent();

    // ── PDF-extract flow ───────────────────────────────────────────────────────
    const samplesDir = new URL('../../../samples/pdf/', import.meta.url).pathname;
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    // Open the Strumenti dropdown and navigate to #/pdf-extract
    await page.locator('details.nav-menu > summary').click();
    await page.locator('[role="menuitem"]', { hasText: 'Estrai CUP da fatture PDF' }).click();
    await page.waitForSelector('#pdf-dropzone', { timeout: 5000 });

    // Upload 2 PDFs (native-text.pdf: 1 CUP, native-multipage.pdf: 2 CUPs)
    await page.setInputFiles('#pdf-file-input', [
      join(samplesDir, 'native-text.pdf'),
      join(samplesDir, 'native-multipage.pdf'),
    ]);
    // Wait for both files to finish processing (status "done" → cup cells appear)
    await page.waitForFunction(
      () => document.querySelectorAll('.cup-cell').length >= 3,
      { timeout: 20000 },
    );
    out.pdfExtractedCupCount = await page.locator('.cup-cell').count();

    // Click "Apri nel verificatore"
    await page.locator('#pdf-send-btn').click();
    // Validator view should load with CSV auto-parsed
    await page.waitForSelector('#preview-panel:not(.hidden)', { timeout: 10000 });
    out.pdfPreviewShown = true;
    out.pdfColumnSelected = await page.locator('#column-select').inputValue();
    // ── end PDF-extract flow ───────────────────────────────────────────────────

    await context.setOffline(true);
    try {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForSelector('#title', { state: 'attached', timeout: 15000 });
      out.offlineOk = true;
      out.offlineTitle = await page.locator('#title').textContent();
      out.offlineSummary = await page
        .locator('#summary')
        .textContent()
        .catch(() => '');
    } catch (error) {
      out.offlineOk = false;
      out.offlineError = error.message;
    }

    return out;
  } finally {
    await browser.close();
  }
}

async function runA11yAudit(page) {
  await page.addScriptTag({ content: axe.source });
  const result = await page.evaluate(async () => {
    return window.axe.run(document, {
      resultTypes: ['violations'],
    });
  });

  const violations = result.violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    help: violation.help,
    nodes: violation.nodes.length,
  }));

  if (violations.length > 0) {
    console.warn(`A11y warning: axe-core ha trovato ${violations.length} violazioni.`);
    console.warn(JSON.stringify(violations, null, 2));
  }

  return {
    tool: 'axe-core',
    violations: violations.length,
  };
}

async function writeAcceptanceWorkbook() {
  const outputPath = join(tmpdir(), 'cup-check-acceptance-10k.xlsx');
  const rows = [['id', 'CUP', `descrizione ${XSS_PAYLOAD}`]];
  const validCups = ['A12B23000000001', 'Z99C00000000002', 'F11D24000000003'];
  const invalidCups = ['', '123B24000000004', 'A12B99000000005', 'A12B24000000@06', 'A12C2400007'];

  for (let index = 0; index < ROW_COUNT; index += 1) {
    const cup =
      index % 4 === 0
        ? invalidCups[Math.floor(index / 4) % invalidCups.length]
        : validCups[index % validCups.length];
    rows.push([String(index + 1), cup, index === 0 ? XSS_PAYLOAD : `Riga ${index + 1}`]);
  }

  const sheetRows = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, cellIndex) => {
          const ref = `${columnName(cellIndex + 1)}${rowIndex + 1}`;
          return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`;
        })
        .join('');
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join('');

  const zip = new JSZip();
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
  );
  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  );
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="CUP" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  );
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
  );
  zip.file(
    'xl/worksheets/sheet1.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${sheetRows}</sheetData></worksheet>`,
  );

  await writeFile(outputPath, await zip.generateAsync({ type: 'nodebuffer' }));
  return outputPath;
}

async function waitForHttp(url) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return;
      }
    } catch {
      // Vite preview is still starting.
    }
    await delay(100);
  }
  throw new Error(`preview non raggiungibile: ${url}`);
}

async function getFreePort() {
  const probe = createServer();
  probe.listen(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port: freePort } = probe.address();
  probe.close();
  await once(probe, 'close');
  return freePort;
}

function columnName(number) {
  let name = '';
  let current = number;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function stopServer(child) {
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    child.kill();
  }
}
