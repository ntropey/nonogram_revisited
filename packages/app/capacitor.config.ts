import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.revisitedlabs.nonogram',
  appName: 'Nonogram Revisited',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
    iosScheme: 'https'
  }
};

export default config;
