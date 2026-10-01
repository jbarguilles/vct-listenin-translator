import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'VCT Listen-in Translator',
    description: 'Live translated subtitles for VCT team comms Listen-ins.',
    permissions: ['tabCapture', 'offscreen', 'storage', 'activeTab'],
    minimum_chrome_version: '116',
  },
});
