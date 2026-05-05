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

// ---- Require signing.properties for release builds ----
const signingPropsPath = join(rootDir, 'signing.properties');
if (!existsSync(signingPropsPath)) {
  console.error('[setup-release-gradle] ERROR: signing.properties not found!');
  console.error('[setup-release-gradle] Release builds MUST be signed with your keystore.');
  console.error('[setup-release-gradle] Copy signing.properties.example to signing.properties and fill in your values.');
  console.error('[setup-release-gradle] Generate a keystore: keytool -genkey -v -keystore keystore/release.keystore -alias starflow -keyalg RSA -keysize 2048 -validity 10000');
  process.exit(1);
}

// Validate that signing.properties has non-placeholder values
const signingPropsContent = readFileSync(signingPropsPath, 'utf-8');
const requiredKeys = ['storeFile', 'storePassword', 'keyAlias', 'keyPassword'];
for (const key of requiredKeys) {
  const match = signingPropsContent.match(new RegExp(`^${key}=.+`, 'm'));
  if (!match || match[0].includes('CHANGE_ME')) {
    console.error(`[setup-release-gradle] ERROR: signing.properties has placeholder value for "${key}"`);
    console.error('[setup-release-gradle] Fill in all values before building a release.');
    process.exit(1);
  }
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
if (!signingPropertiesFile.exists()) {
    throw new GradleException("signing.properties not found! Release builds require signing. See signing.properties.example")
}
def props = new Properties()
props.load(new FileInputStream(signingPropertiesFile))
['storeFile','storePassword','keyAlias','keyPassword'].each { key ->
    if (!props[key] || props[key] == 'CHANGE_ME') {
        throw new GradleException("signing.properties: \${key} is missing or has placeholder value")
    }
}
releaseSigningConfig = signingConfigs.create("release") {
    storeFile file(props['storeFile'])
    storePassword props['storePassword']
    keyAlias props['keyAlias']
    keyPassword props['keyPassword']
}
println "[starflow] Release signing configured from signing.properties"
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
            signingConfig releaseSigningConfig
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

// ---- Remove productFlavors (unified package ru.kreagenium.starflow for all stores) ----
// Previously used separate flavors for RuStore/GPlay. Now the same package is used
// for both stores; the only build difference is VITE_ENABLE_SHOP via Vite mode.
if (gradle.includes('productFlavors')) {
  const flavorsRegex = /\n\s*flavorDimensions\s+"store"[\s\S]*?productFlavors\s*\{[\s\S]*?\n    \}/;
  if (flavorsRegex.test(gradle)) {
    gradle = gradle.replace(flavorsRegex, '');
    writeFileSync(appBuildGradle, gradle, 'utf-8');
    console.log('[setup-release-gradle] Removed productFlavors — unified package ru.kreagenium.starflow for all stores');
  }
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
