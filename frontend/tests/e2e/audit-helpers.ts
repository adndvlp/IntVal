import { type Page, type TestInfo } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Safari/macOS distingue Tab (campos) y Option-Tab (todos los enlaces).
export function navigationTab(info: TestInfo) {
  return info.project.use.browserName === 'webkit' &&
    process.platform === 'darwin'
    ? 'Alt+Tab'
    : 'Tab';
}

export async function auditPage(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
}
