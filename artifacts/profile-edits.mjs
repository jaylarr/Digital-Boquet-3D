/* global process, PerformanceObserver, document, performance, requestAnimationFrame, setTimeout, window, console */
import { chromium } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
const label = process.argv[2] ?? 'after';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 } });
  await page.goto('http://127.0.0.1:5180/');
  await page.locator('[data-testid=scene][data-ready=true]').waitFor();
  await page.getByRole('button', { name: 'Pause motion' }).click();
  await page.waitForTimeout(1000);
  const result = await page.evaluate(async () => {
    const samples = [], longTasks = [];
    const observer = new PerformanceObserver(list => list.getEntries().forEach(e => longTasks.push(e.duration)));
    observer.observe({ type: 'longtask', buffered: false });
    for (let i = 0; i < 12; i++) {
      const name = i % 2 ? 'Remove one Rose' : 'Add one Rose';
      const button = document.querySelector(`button[aria-label="${name}"]`);
      const start = performance.now(); button.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      samples.push(performance.now() - start);
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    observer.disconnect();
    return { samples, longTasks, metrics: window.__petalpopMetrics() };
  });
  const sorted = [...result.samples].sort((a, b) => a - b);
  const report = { environment: 'Headless Chromium / SwiftShader software GPU; 1280×960; motion paused; warm quantity edits; latency includes React commit and two animation frames', medianMs: sorted[Math.floor(sorted.length / 2)], maxMs: Math.max(...sorted), ...result };
  await writeFile(`artifacts/edit-performance-${label}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
