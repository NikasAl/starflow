import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'ru.kreagenium.starflow',
  appName: 'Поток',
  webDir: 'dist',
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
    },
    App: {
      // Deep link scheme for returning to app after YooKassa payment
      urlScheme: 'potok',
    },
  },
};

export default config;
