import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.tepmex.ankidashboard',
  appName: 'Anki Dashboard',
  webDir: 'dist',
  backgroundColor: '#f8f8fc',
  android: {
    allowMixedContent: false,
  },
};

export default config;
