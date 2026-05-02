#!/usr/bin/env node
// ============================================================
// Поток — Android Release Build Configuration
// Patches build.gradle with signing config, ProGuard, and
// version info from package.json
// ============================================================

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const androidDir = join(rootDir, 'android');
const appBuildGradle = join(androidDir, 'app', 'build.gradle');

if (!existsSync(appBuildGradle)) {
  console.log('[setup-release-gradle] build.gradle not found. Skipping release config.');
  console.log('[setup-release-gradle] Run "npm run cap:add:android" and "npm run cap:sync" first.');
  process.exit(0);
}

let gradle = readFileSync(appBuildGradle, 'utf-8');

// ---- Read version from package.json ----
let version = '1.0.0';
let versionCode = 1;
try {
  const pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf-8'));
  version = pkg.version || '1.0.0';
  // Generate version code from version string: 1.2.3 -> 10203
  const parts = version.split('.').map(Number);
  versionCode = (parts[0] || 0) * 10000 + (parts[1] || 0) * 100 + (parts[2] || 0);
} catch {
  console.log('[setup-release-gradle] Warning: Could not read version from package.json');
}

// ---- Add signing config ----
const signingConfig = `
def signingPropertiesFile = rootProject.file("../signing.properties")
def releaseSigningConfig
if (signingPropertiesFile.exists()) {
    def props = new Properties()
    props.load(new FileInputStream(signingPropertiesFile))
    releaseSigningConfig = signingConfigs.create("release") {
        storeFile file(props['storeFile'])
        storePassword props['storePassword']
        keyAlias props['keyAlias']
        keyPassword props['keyPassword']
    }
    println "[starflow] Release signing configured from signing.properties"
} else {
    println "[starflow] WARNING: signing.properties not found. Release builds will NOT be signed."
    println "[starflow] Create signing.properties with: storeFile, storePassword, keyAlias, keyPassword"
}
`;

if (!gradle.includes('signing.properties')) {
  // Insert after the 'android {' block opening
  gradle = gradle.replace(
    /android\s*\{/,
    'android {\n' + signingConfig
  );
}

// ---- Add release build type with optimizations ----
const releaseBuildType = `
        release {
            minifyEnabled true
            proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
            if (releaseSigningConfig) {
                signingConfig releaseSigningConfig
            }
        }
`;

if (!gradle.includes('minifyEnabled true')) {
  // Replace existing release block or add one
  if (gradle.includes('release {')) {
    gradle = gradle.replace(
      /release\s*\{[^}]*\}/,
      releaseBuildType.trim()
    );
  } else if (gradle.includes('buildTypes')) {
    gradle = gradle.replace(
      'buildTypes {',
      'buildTypes {\n' + releaseBuildType
    );
  } else {
    // Add after android { block
    gradle = gradle.replace(
      /android\s*\{/,
      'android {\n    buildTypes {\n' + releaseBuildType + '    }\n'
    );
  }
}

// ---- Set versionCode and versionName ----
gradle = gradle.replace(
  /versionCode\s+\d+/,
  `versionCode ${versionCode}`
);
gradle = gradle.replace(
  /versionName\s+"[^"]*"/,
  `versionName "${version}"`
);

writeFileSync(appBuildGradle, gradle, 'utf-8');
console.log(`[setup-release-gradle] Configured release build (version ${version}, code ${versionCode})`);

// ---- Add productFlavors for different stores ----
// Default flavor (rustore): applicationId = ru.kreagenium.starflow
// GPlay flavor:             applicationId = ru.kreagenium.starflow.gp
// Java source package stays ru.kreagenium.starflow for both.
const productFlavorsBlock = `
    flavorDimensions "store"
    productFlavors {
        rustore {
            dimension "store"
            // Default applicationId from capacitor.config.ts
        }
        gplay {
            dimension "store"
            applicationIdSuffix ".gp"
        }
    }
`;

if (!gradle.includes('productFlavors')) {
  // Insert after defaultConfig block
  if (gradle.includes('defaultConfig {')) {
    gradle = gradle.replace(
      /(defaultConfig\s*\{[^}]*\})/,
      `$1${productFlavorsBlock}`
    );
  } else {
    // Fallback: insert after 'android {'
    gradle = gradle.replace(
      /android\s*\{/,
      `android {\n${productFlavorsBlock}`
    );
  }
  writeFileSync(appBuildGradle, gradle, 'utf-8');
  console.log('[setup-release-gradle] Added productFlavors: rustore, gplay');
  console.log('  rustore: ru.kreagenium.starflow (default)');
  console.log('  gplay:   ru.kreagenium.starflow.gp');
} else {
  console.log('[setup-release-gradle] productFlavors already configured.');
}

// ---- Ensure proguard-rules.pro exists ----
const proguardPath = join(androidDir, 'app', 'proguard-rules.pro');
if (!existsSync(proguardPath)) {
  // Create with Three.js friendly rules
  writeFileSync(proguardPath, `# Поток — ProGuard Rules

# Keep Three.js — it's already minified
-keep class com.unity3d.** { *; }
-keep class org.chromium.** { *; }

# Keep Capacitor bridge
-keep class com.getcapacitor.** { *; }

# Remove logging in release
-assumenosideeffects class android.util.Log {
    public static *** d(...);
    public static *** v(...);
    public static *** i(...);
}
`, 'utf-8');
  console.log('[setup-release-gradle] Created proguard-rules.pro');
}

console.log('[setup-release-gradle] Release configuration complete!');
