#!/usr/bin/env node
// ============================================================
// Star Flow Command — Android Post-Sync Setup
// Forces landscape orientation and copies app icon
// ============================================================

import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const androidDir = join(rootDir, 'android');

if (!existsSync(androidDir)) {
  console.log('[setup-android] No android/ directory found. Skipping Android setup.');
  console.log('[setup-android] Run "npm run cap:add:android" first.');
  process.exit(0);
}

// 1. Force landscape orientation in AndroidManifest.xml
const manifestPath = join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
if (existsSync(manifestPath)) {
  let manifest = readFileSync(manifestPath, 'utf-8');
  if (!manifest.includes('screenOrientation="landscape"')) {
    manifest = manifest.replace(
      '<application',
      '<application android:screenOrientation="landscape"'
    );
    // Also set it on the activity
    manifest = manifest.replace(
      '<activity',
      '<activity android:screenOrientation="landscape"'
    );
    writeFileSync(manifestPath, manifest, 'utf-8');
    console.log('[setup-android] Set landscape orientation in AndroidManifest.xml');
  } else {
    console.log('[setup-android] Landscape orientation already set.');
  }
} else {
  console.log(`[setup-android] AndroidManifest.xml not found at ${manifestPath}`);
}

// 2. Copy icon to Android resource directories
const iconSource = join(rootDir, 'assets', 'icon.png');
if (existsSync(iconSource)) {
  const mipmapDirs = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
  const resDir = join(androidDir, 'app', 'src', 'main', 'res');

  for (const dir of mipmapDirs) {
    const targetDir = join(resDir, dir);
    if (existsSync(targetDir)) {
      copyFileSync(iconSource, join(targetDir, 'ic_launcher.png'));
      copyFileSync(iconSource, join(targetDir, 'ic_launcher_round.png'));
      console.log(`[setup-android] Copied icon to ${dir}/`);
    }
  }
  console.log('[setup-android] App icon copied to all mipmap directories.');
} else {
  console.log(`[setup-android] Icon not found at ${iconSource}`);
}

// 3. Set fullscreen + landscape in styles.xml
const stylesPath = join(androidDir, 'app', 'src', 'main', 'res', 'values', 'styles.xml');
if (existsSync(stylesPath)) {
  let styles = readFileSync(stylesPath, 'utf-8');
  if (!styles.includes('screenOrientation')) {
    styles = styles.replace(
      '<item name="android:windowFullscreen">true</item>',
      '<item name="android:windowFullscreen">true</item>\n        <item name="android:screenOrientation">landscape</item>'
    );
    writeFileSync(stylesPath, styles, 'utf-8');
    console.log('[setup-android] Set landscape orientation in styles.xml');
  }
  // Ensure noTitleBar and fullscreen
  if (!styles.includes('windowNoTitle')) {
    styles = styles.replace(
      '<style name="AppTheme"',
      '<style name="AppTheme" parent="Theme.AppCompat.NoActionBar"'
    );
    writeFileSync(stylesPath, styles, 'utf-8');
    console.log('[setup-android] Set NoActionBar theme in styles.xml');
  }
}

// 4. Force immersive sticky mode in main activity (hide status/nav bars)
const mainActivityPath = join(androidDir, 'app', 'src', 'main', 'java', 'com', 'starflow', 'game', 'MainActivity.java');
if (existsSync(mainActivityPath)) {
  let activity = readFileSync(mainActivityPath, 'utf-8');
  if (!activity.includes('SYSTEM_UI_FLAG_IMMERSIVE_STICKY')) {
    // Add immersive mode import
    if (!activity.includes('import android.view.View;')) {
      activity = activity.replace(
        'import android.os.Bundle;',
        'import android.os.Bundle;\nimport android.view.View;'
      );
    }
    // Add immersive mode in onCreate after setContentView
    activity = activity.replace(
      'this.getWindow();',
      'this.getWindow();\n\n        // Fullscreen immersive mode — hide status bar & navigation\n        getWindow().getDecorView().setSystemUiVisibility(\n            View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY\n            | View.SYSTEM_UI_FLAG_FULLSCREEN\n            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION\n            | View.SYSTEM_UI_FLAG_LAYOUT_STABLE\n            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN\n            | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION\n        );'
    );
    writeFileSync(mainActivityPath, activity, 'utf-8');
    console.log('[setup-android] Added immersive sticky mode to MainActivity.java');
  } else {
    console.log('[setup-android] Immersive mode already set in MainActivity.java');
  }
} else {
  console.log(`[setup-android] MainActivity.java not found at ${mainActivityPath}`);
}

console.log('[setup-android] Android setup complete!');
