import { defineConfig } from '@playwright/test';

export default defineConfig({
  outputDir: 'test-results/art',
  testDir: './tests/art-browser',
  timeout: 45000,
  use: {
    baseURL: 'http://127.0.0.1:5180',
    browserName: 'chromium',
    launchOptions: {
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  webServer: {
    command: 'npm run art:lab',
    url: 'http://127.0.0.1:5180/tools/art/lab/',
    reuseExistingServer: !process.env.CI,
  },
});
