import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.starflow.game',
  appName: 'Star Flow Command',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
    App: {
      // Deep link scheme for returning to app after YooKassa payment
      urlScheme: 'starflow',
    },
  },
};

export default config;
