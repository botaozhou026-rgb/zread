import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromium } from '@playwright/test';

const url = new URL('./index.html', import.meta.url).href;

test('录入、校验、统计、修改、删除和重新打开', async (t) => {
  const browser = await chromium.launch({ channel: 'msedge' });
  t.after(() => browser.close());
  const context = await browser.newContext();
  let page = await context.newPage();
  await page.goto(url);

  async function fillRecord(number, name, score) {
    await page.getByRole('button', { name: '录入成绩' }).click();
    await page.getByLabel('学号').fill(number);
    await page.getByLabel('姓名').fill(name);
    await page.getByLabel('语文（满分 100）').fill(score);
    await page.getByRole('button', { name: '保存' }).click();
  }

  async function stats(expected) {
    assert.deepEqual(await page.locator('article').first().locator('dd').allTextContents(), expected);
  }

  await stats(['0', '—', '—', '—']);
  await fillRecord('001', '小林', '80');
  await fillRecord('002', '小陈', '0');
  await fillRecord('003', '小吴', '');
  await stats(['2', '40', '80', '0']);
  await fillRecord('001', '重复', '20');
  assert.match(await page.locator('#edit-error').textContent(), /学号已存在/);
  await page.getByRole('button', { name: '取消' }).click();
  await fillRecord('004', '超出满分', '101');
  assert.equal(await page.getByLabel('语文（满分 100）').evaluate((input) => input.validity.rangeOverflow), true);
  await page.getByRole('button', { name: '取消' }).click();
  assert.equal(await page.locator('tbody tr').count(), 3);

  await page.getByRole('row', { name: /小林/ }).getByRole('button', { name: '编辑' }).click();
  await page.getByLabel('语文（满分 100）').fill('');
  await page.getByRole('button', { name: '保存' }).click();
  await stats(['1', '0', '0', '0']);
  const deleteChen = () => page.getByRole('row', { name: /小陈/ }).getByRole('button', { name: '删除' }).click();
  await deleteChen();
  assert.match(await page.locator('#delete-details').textContent(), /小陈/);
  await page.getByRole('button', { name: '取消' }).click();
  await stats(['1', '0', '0', '0']);
  await deleteChen();
  await page.getByRole('button', { name: '确认删除' }).click();
  await stats(['0', '—', '—', '—']);
  await page.close();
  page = await context.newPage();
  await page.goto(url);
  assert.deepEqual(await page.locator('tbody tr td:nth-child(2)').allTextContents(), ['小林', '小吴']);
  await stats(['0', '—', '—', '—']);
});
test('Windows 桌面快捷方式指向成绩统计器的独立窗口', async (t) => {
  const { execFileSync } = await import('node:child_process');
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const directory = await mkdtemp(join(tmpdir(), 'gradebook-shortcut-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const script = fileURLToPath(new URL('./create-desktop-shortcut.ps1', import.meta.url));
  execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-ShortcutDirectory', directory]);
  const shortcut = execFileSync('powershell.exe', ['-NoProfile', '-Command', `
    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut((Get-ChildItem -LiteralPath $env:GRADEBOOK_TEST_DIRECTORY -Filter '*.lnk').FullName)
    $link.TargetPath
    $link.Arguments
  `], { encoding: 'utf8', env: { ...process.env, GRADEBOOK_TEST_DIRECTORY: directory } }).trim().split(/\r?\n/);
  assert.match(shortcut[0], /msedge\.exe$/i);
  assert.equal(shortcut[1], `--app="${url}"`);
});
