#!/usr/bin/env node
// ============================================================
// Star Flow Command — Android Post-Sync Setup
// Forces landscape orientation, fullscreen immersive mode,
// hides status bar / navigation bar / camera notch, copies icon
// ============================================================

import { readFileSync, writeFileSync, existsSync, copyFileSync, rmSync, readdirSync } from 'fs';
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

  // Delete adaptive icon XMLs (mipmap-anydpi-v26) so system falls back to our PNGs
  const anydpiDir = join(resDir, 'mipmap-anydpi-v26');
  if (existsSync(anydpiDir)) {
    const files = readdirSync(anydpiDir);
    for (const f of files) {
      if (f.startsWith('ic_launcher') && f.endsWith('.xml')) {
        rmSync(join(anydpiDir, f));
        console.log(`[setup-android] Removed adaptive icon XML: mipmap-anydpi-v26/${f}`);
      }
    }
    // Also remove foreground/background adaptive icon drawables
    for (const dir of mipmapDirs) {
      const td = join(resDir, dir);
      if (existsSync(td)) {
        for (const f of readdirSync(td)) {
          if (f.startsWith('ic_launcher_foreground') || f.startsWith('ic_launcher_background')) {
            rmSync(join(td, f));
            console.log(`[setup-android] Removed ${dir}/${f}`);
          }
        }
      }
    }
  }

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

// 3. Set fullscreen + landscape + NoActionBar in styles.xml
const stylesPath = join(androidDir, 'app', 'src', 'main', 'res', 'values', 'styles.xml');
if (existsSync(stylesPath)) {
  let styles = readFileSync(stylesPath, 'utf-8');
  let modified = false;

  // Ensure NoActionBar parent theme
  if (!styles.includes('Theme.AppCompat.NoActionBar') && !styles.includes('windowNoTitle')) {
    styles = styles.replace(
      '<style name="AppTheme"',
      '<style name="AppTheme" parent="Theme.AppCompat.NoActionBar"'
    );
    modified = true;
  }

  // Ensure windowFullscreen is set + black window background (fixes gray cutout/notch area)
  if (!styles.includes('windowFullscreen')) {
    styles = styles.replace(
      '</style>',
      '        <item name="android:windowFullscreen">true</item>\n        <item name="android:windowNoTitle">true</item>\n        <item name="android:screenOrientation">landscape</item>\n        <item name="android:windowBackground">#000000</item>\n    </style>'
    );
    modified = true;
  } else if (!styles.includes('windowBackground')) {
    // Already has windowFullscreen but missing windowBackground
    styles = styles.replace(
      '</style>',
      '        <item name="android:windowBackground">#000000</item>\n    </style>'
    );
    modified = true;
  }

  if (modified) {
    writeFileSync(stylesPath, styles, 'utf-8');
    console.log('[setup-android] Updated styles.xml with fullscreen + landscape + NoActionBar');
  } else {
    console.log('[setup-android] styles.xml already configured.');
  }
}

// 4. Inject fullscreen immersive mode into MainActivity.java
//    Uses modern WindowInsetsControllerCompat (not deprecated SYSTEM_UI_FLAG)
const mainActivityPath = join(androidDir, 'app', 'src', 'main', 'java', 'com', 'starflow', 'game', 'MainActivity.java');
if (existsSync(mainActivityPath)) {
  let activity = readFileSync(mainActivityPath, 'utf-8');

  // Skip if immersive mode is already properly injected
  if (activity.includes('hideSystemBars')) {
    console.log('[setup-android] Immersive mode already set in MainActivity.java');
  } else {
    // ---- Add required imports ----
    const requiredImports = [
      ['import android.os.Build;', 'import android.os.Bundle;'],
      ['import android.view.View;', 'import android.view.View;'],
      ['import androidx.core.view.WindowCompat;', 'import androidx.core.view.WindowCompat;'],
      ['import androidx.core.view.WindowInsetsCompat;', 'import androidx.core.view.WindowInsetsCompat;'],
      ['import androidx.core.view.WindowInsetsControllerCompat;', 'import androidx.core.view.WindowInsetsControllerCompat;'],
    ];
    for (const [imp, anchor] of requiredImports) {
      if (!activity.includes(imp) && activity.includes(anchor)) {
        activity = activity.replace(anchor, imp + '\n' + anchor);
      } else if (!activity.includes(imp) && activity.includes('import com.getcapacitor.BridgeActivity;')) {
        // If anchor not found, insert before BridgeActivity import
        activity = activity.replace(
          'import com.getcapacitor.BridgeActivity;',
          imp + '\nimport com.getcapacitor.BridgeActivity;'
        );
      }
    }

    // ---- Add immersive mode code after super.onCreate(savedInstanceState); ----
    const immersiveSetup = `
        // StarFlow: Edge-to-edge fullscreen immersive mode
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(0xFF000000);
        getWindow().setNavigationBarColor(0xFF000000);
        hideSystemBars();

        // Handle display cutout (camera notch / punch-hole)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            getWindow().getAttributes().layoutInDisplayCutoutMode =
                android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        }`;

    if (activity.includes('super.onCreate(savedInstanceState);')) {
      activity = activity.replace(
        'super.onCreate(savedInstanceState);',
        'super.onCreate(savedInstanceState);' + immersiveSetup
      );
    }

    // ---- Add hideSystemBars(), onWindowFocusChanged(), onResume() before class closing brace ----
    const immersiveMethods = `
    private void hideSystemBars() {
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
        if (controller != null) {
            controller.hide(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemBars();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // Re-apply immersive mode after returning from background
        hideSystemBars();
    }`;

    // Insert before the last closing brace of the file (class closing brace)
    activity = activity.replace(/(\s*})\s*$/, immersiveMethods + '\n$1');

    writeFileSync(mainActivityPath, activity, 'utf-8');
    console.log('[setup-android] Added immersive fullscreen mode to MainActivity.java');
  }
} else {
  console.log(`[setup-android] MainActivity.java not found at ${mainActivityPath}`);
}

// 5. Ensure androidx.core dependency is available for WindowInsetsControllerCompat
const variablesPath = join(androidDir, 'variables.gradle');
if (existsSync(variablesPath)) {
  let vars = readFileSync(variablesPath, 'utf-8');
  if (!vars.includes('androidxCoreVersion')) {
    vars = vars.replace(
      'ext {',
      'ext {\n    androidxCoreVersion = "1.12.0"'
    );
    writeFileSync(variablesPath, 'utf-8');
    console.log('[setup-android] Added androidxCoreVersion to variables.gradle');
  } else if (vars.includes('androidxCoreVersion = "1.6.0"') || vars.includes('androidxCoreVersion = "1.9.0"') || vars.includes('androidxCoreVersion = "1.10.0"')) {
    // Upgrade to minimum version required for WindowInsetsControllerCompat
    vars = vars.replace(
      /androidxCoreVersion\s*=\s*"[^"]*"/,
      'androidxCoreVersion = "1.12.0"'
    );
    writeFileSync(variablesPath, vars, 'utf-8');
    console.log('[setup-android] Upgraded androidxCoreVersion to 1.12.0 in variables.gradle');
  } else {
    console.log('[setup-android] variables.gradle already has suitable androidxCoreVersion.');
  }
}

console.log('[setup-android] Android setup complete!');
