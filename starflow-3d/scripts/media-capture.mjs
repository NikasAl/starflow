#!/usr/bin/env node

/**
 * media-capture.mjs — Утилита для скриншотов и записи видео через ADB
 *
 * Использование:
 *   node scripts/media-capture.mjs screenshot [--name my-screen] [--resize WxH]
 *   node scripts/media-capture.mjs record [--name my-video] [--duration 30] [--resize WxH]
 *   node scripts/media-capture.mjs resize --width 720 --height 1280
 *   node scripts/media-capture.mjs reset-resize
 *   node scripts/media-capture.mjs pull [--dir ./captures]
 *
 * Примеры:
 *   node scripts/media-capture.mjs screenshot --resize 2560x1440
 *   node scripts/media-capture.mjs screenshot --name start-screen
 *   node scripts/media-capture.mjs record --duration 15 --name promo
 *   node scripts/media-capture.mjs resize --width 2560 --height 1440
 *   node scripts/media-capture.mjs reset-resize
 */

import { execSync, exec } from 'child_process';
import { mkdirSync, existsSync } from 'fs';
import { resolve, join } from 'path';

// ── Конфигурация ──────────────────────────────────────────────

const DEFAULTS = {
  outputDir: 'captures',
  screenshotWidth: 2560,
  screenshotHeight: 1440,
  videoBitrate: 8000000,   // 8 Mbps
  videoDuration: 30,       // секунд
};

const DEVICE_TMP_SCREENSHOT = '/sdcard/sf_screenshot.png';
const DEVICE_TMP_VIDEO = '/sdcard/sf_recording.mp4';

// ── Helpers ────────────────────────────────────────────────────

function run(cmd, silent = false) {
  try {
    const out = execSync(cmd, { encoding: 'utf-8', stdio: silent ? 'pipe' : 'inherit' });
    return out?.trim();
  } catch (e) {
    if (!silent) {
      console.error(`\n[ERROR] Command failed: ${cmd}`);
      console.error(e.message);
      process.exit(1);
    }
    return null;
  }
}

function runQuiet(cmd) {
  return run(cmd, true);
}

function adbCmd(args) {
  return `adb ${args}`;
}

function getTimestamp() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}${String(d.getSeconds()).padStart(2, '0')}`;
}

function parseResolution(str) {
  const match = str.match(/^(\d+)x(\d+)$/i);
  if (!match) {
    console.error(`[ERROR] Неверный формат разрешения: "${str}". Ожидается: WxH (например 2560x1440)`);
    process.exit(1);
  }
  return { width: parseInt(match[1]), height: parseInt(match[2]) };
}

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
    console.log(`[INFO] Создана директория: ${dir}`);
  }
}

function checkAdb() {
  const version = runQuiet(adbCmd('version'));
  if (!version) {
    console.error('[ERROR] adb не найден. Убедитесь что Android SDK установлен и adb в PATH.');
    process.exit(1);
  }
  const devices = runQuiet(adbCmd('devices'));
  if (devices && !devices.includes('\tdevice')) {
    console.error('[ERROR] Нет подключённых устройств. Подключите телефон через USB с отладкой.');
    process.exit(1);
  }
}

function getDeviceResolution() {
  const out = runQuiet(adbCmd('shell wm size'));
  if (!out) return null;
  const match = out.match(/Override:\s*(\d+)x(\d+)/) || out.match(/(\d+)x(\d+)/);
  if (match) return { width: parseInt(match[1]), height: parseInt(match[2]) };
  return null;
}

function getPhysicalResolution() {
  const out = runQuiet(adbCmd('shell wm size'));
  if (!out) return null;
  // Первая строка — физическое разрешение
  const match = out.match(/Physical size:\s*(\d+)x(\d+)/);
  if (match) return { width: parseInt(match[1]), height: parseInt(match[2]) };
  return null;
}

// ── Команды ────────────────────────────────────────────────────

function cmdScreenshot(args) {
  const name = args.name || `screenshot_${getTimestamp()}`;
  const resize = args.resize ? parseResolution(args.resize) : null;

  console.log('\n📸 Скриншот устройства');
  console.log('─'.repeat(40));

  // Установить разрешение если нужно
  if (resize) {
    console.log(`[INFO] Установка разрешения: ${resize.width}x${resize.height}`);
    run(adbCmd(`shell wm size ${resize.width}x${resize.height}`));
    // Ждём пересоздание Surface
    run('sleep 1');
  }

  // Снять скриншот
  console.log('[INFO] Снимаем скриншот...');
  run(adbCmd(`shell screencap -p ${DEVICE_TMP_SCREENSHOT}`));

  const outDir = resolve(DEFAULTS.outputDir);
  ensureDir(outDir);

  const filename = `${name}.png`;
  const localPath = join(outDir, filename);

  console.log(`[INFO] Копируем: ${filename}`);
  run(adbCmd(`pull ${DEVICE_TMP_SCREENSHOT} "${localPath}"`));

  // Удалить временный файл с устройства
  runQuiet(adbCmd(`shell rm ${DEVICE_TMP_SCREENSHOT}`));

  console.log(`\n✅ Сохранено: ${localPath}`);

  // Вернуть разрешение если меняли
  if (resize) {
    console.log('[INFO] Возвращаем исходное разрешение...');
    resetResolution();
  }
}

function cmdRecord(args) {
  const name = args.name || `recording_${getTimestamp()}`;
  const duration = parseInt(args.duration) || DEFAULTS.videoDuration;
  const bitrate = parseInt(args.bitrate) || DEFAULTS.videoBitrate;
  const resize = args.resize ? parseResolution(args.resize) : null;

  console.log(`\n🎥 Запись видео (${duration} сек, ${Math.round(bitrate / 1000000)} Mbps)`);
  console.log('─'.repeat(40));

  // Установить разрешение если нужно
  if (resize) {
    console.log(`[INFO] Установка разрешения: ${resize.width}x${resize.height}`);
    run(adbCmd(`shell wm size ${resize.width}x${resize.height}`));
    run('sleep 1');
  }

  // Удалить старый файл
  runQuiet(adbCmd(`shell rm ${DEVICE_TMP_VIDEO}`));

  // Записать видео
  console.log('[INFO] Начинаем запись...');
  console.log(`[INFO] Для остановки нажмите Ctrl+C (или подождите ${duration} сек)`);

  const recordProcess = exec(
    adbCmd(`shell screenrecord --bit-rate ${bitrate} --time-limit ${duration} ${DEVICE_TMP_VIDEO}`),
    { stdio: 'inherit' }
  );

  recordProcess.on('close', (code) => {
    if (code !== 0 && code !== null) {
      console.log('[INFO] Запись остановлена.');
    }

    // Проверяем что файл существует на устройстве
    const check = runQuiet(adbCmd(`shell ls -la ${DEVICE_TMP_VIDEO}`));
    if (!check) {
      console.log('[INFO] Видео не записалось (возможно остановлено слишком рано).');
      if (resize) resetResolution();
      return;
    }

    const outDir = resolve(DEFAULTS.outputDir);
    ensureDir(outDir);

    const filename = `${name}.mp4`;
    const localPath = join(outDir, filename);

    console.log(`[INFO] Копируем: ${filename}`);
    run(adbCmd(`pull ${DEVICE_TMP_VIDEO} "${localPath}"`));

    // Удалить временный файл
    runQuiet(adbCmd(`shell rm ${DEVICE_TMP_VIDEO}`));

    console.log(`\n✅ Сохранено: ${localPath}`);

    // Вернуть разрешение если меняли
    if (resize) {
      console.log('[INFO] Возвращаем исходное разрешение...');
      resetResolution();
    }
  });

  // Graceful shutdown — если нажали Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n[INFO] Останавливаем запись...');
    recordProcess.kill('SIGINT');
  });
}

function cmdResize(args) {
  const width = parseInt(args.width);
  const height = parseInt(args.height);

  if (!width || !height) {
    console.error('[ERROR] Укажите --width и --height');
    console.error('Пример: node scripts/media-capture.mjs resize --width 2560 --height 1440');
    process.exit(1);
  }

  console.log(`\n📐 Установка разрешения: ${width}x${height}`);
  console.log('─'.repeat(40));

  const current = getDeviceResolution();
  if (current) {
    console.log(`[INFO] Текущее: ${current.width}x${current.height}`);
  }

  run(adbCmd(`shell wm size ${width}x${height}`));

  const updated = getDeviceResolution();
  console.log(`[INFO] Установлено: ${updated?.width}x${updated?.height}`);
  console.log('\n💡 Для возврата: node scripts/media-capture.mjs reset-resize');
}

function cmdResetResize() {
  console.log('\n📐 Сброс разрешения к физическому');
  console.log('─'.repeat(40));

  const physical = getPhysicalResolution();
  if (physical) {
    console.log(`[INFO] Физическое разрешение: ${physical.width}x${physical.height}`);
    run(adbCmd(`shell wm size ${physical.width}x${physical.height}`));
  } else {
    // Fallback — сброс через команду
    run(adbCmd('shell wm size reset'));
  }

  const current = getDeviceResolution();
  console.log(`[INFO] Текущее: ${current?.width}x${current?.height}`);
  console.log('\n✅ Разрешение сброшено');
}

function resetResolution() {
  const physical = getPhysicalResolution();
  if (physical) {
    runQuiet(adbCmd(`shell wm size ${physical.width}x${physical.height}`));
  } else {
    runQuiet(adbCmd('shell wm size reset'));
  }
}

function cmdPull(args) {
  const dir = resolve(args.dir || DEFAULTS.outputDir);
  ensureDir(dir);

  console.log(`\n📥 Копирование файлов в: ${dir}`);
  console.log('─'.repeat(40));

  // Найти все скриншоты и видео на устройстве
  const files = [
    DEVICE_TMP_SCREENSHOT,
    DEVICE_TMP_VIDEO,
  ];

  for (const f of files) {
    const exists = runQuiet(adbCmd(`shell ls ${f}`));
    if (exists) {
      const filename = f.split('/').pop();
      const localPath = join(dir, filename);
      run(adbCmd(`pull ${f} "${localPath}"`));
      runQuiet(adbCmd(`shell rm ${f}`));
      console.log(`[INFO] ${filename} → ${localPath}`);
    }
  }

  console.log('\n✅ Готово');
}

function cmdInfo() {
  console.log('\n📱 Информация об устройстве');
  console.log('─'.repeat(40));

  const physical = getPhysicalResolution();
  const current = getDeviceResolution();
  const density = runQuiet(adbCmd('shell wm density'));
  const model = runQuiet(adbCmd('shell getprop ro.product.model'));
  const sdk = runQuiet(adbCmd('shell getprop ro.build.version.sdk'));
  const android = runQuiet(adbCmd('shell getprop ro.build.version.release'));

  console.log(`  Модель:        ${model || 'неизвестно'}`);
  console.log(`  Android:       ${android || 'неизвестно'} (SDK ${sdk || '?'})`);
  console.log(`  Физическое:    ${physical ? `${physical.width}x${physical.height}` : 'неизвестно'}`);
  console.log(`  Текущее:       ${current ? `${current.width}x${current.height}` : 'неизвестно'}`);
  console.log(`  Плотность:     ${density?.trim() || 'неизвестно'}`);

  if (current && physical && current.width !== physical.width) {
    console.log('\n  ⚠️  Текущее разрешение отличается от физического!');
    console.log('     Для сброса: node scripts/media-capture.mjs reset-resize');
  }

  // Проверяем aspect ratio
  if (current) {
    const ratio = current.width / current.height;
    const is16x9 = Math.abs(ratio - (16 / 9)) < 0.02;
    console.log(`  Соотношение:   ${ratio.toFixed(3)} ${is16x9 ? '✅ 16:9' : '⚠️  не 16:9'}`);
  }

  // Проверяем screenrecord
  const screenrecord = runQuiet(adbCmd('shell which screenrecord'));
  console.log(`  Screenrecord:  ${screenrecord ? 'доступен' : 'НЕ доступен'}`);
}

function printHelp() {
  console.log(`
🛸 Star Flow — Media Capture Tool

Утилита для создания скриншотов и записи видео из приложения через ADB.
Поддерживает установку разрешения 16:9 для RuStore.

Использование:
  node scripts/media-capture.mjs <команда> [опции]

Команды:
  screenshot     Сделать скриншот
  record         Записать видео
  resize         Установить разрешение устройства
  reset-resize   Вернуть физическое разрешение
  pull           Скопировать временные файлы с устройства
  info           Информация об устройстве

Опции:
  --name <имя>       Имя файла (по умолчанию: timestamp)
  --resize WxH       Временное разрешение для скриншота/видео
  --duration <сек>   Длительность записи видео (по умолчанию: 30)
  --bitrate <bps>    Битрейт видео (по умолчанию: 8000000 = 8 Mbps)
  --width <px>       Ширина (для resize)
  --height <px>      Высота (для resize)
  --dir <путь>       Директория для файлов (по умолчанию: ./captures)

Примеры:
  # Скриншот в 16:9 (временно установит разрешение, потом вернёт)
  node scripts/media-capture.mjs screenshot --resize 2560x1440

  # Скриншот с именем для RuStore
  node scripts/media-capture.mjs screenshot --name rustore-1-start --resize 2560x1440

  # Записать промо-видео 15 секунд
  node scripts/media-capture.mjs record --duration 15 --name promo --resize 2560x1440

  # Установить разрешение 16:9 на телефоне
  node scripts/media-capture.mjs resize --width 2560 --height 1440

  # Узнать текущее разрешение
  node scripts/media-capture.mjs info

  # Вернуть физическое разрешение
  node scripts/media-capture.mjs reset-resize
`);
}

// ── CLI ────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = {};
  const commands = ['screenshot', 'record', 'resize', 'reset-resize', 'pull', 'info', 'help'];

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        i++;
      } else {
        args[key] = true;
      }
    } else if (commands.includes(arg)) {
      args._command = arg;
    }
  }

  return args;
}

const args = parseArgs(process.argv);
const command = args._command || 'help';

checkAdb();

switch (command) {
  case 'screenshot':  cmdScreenshot(args); break;
  case 'record':      cmdRecord(args); break;
  case 'resize':      cmdResize(args); break;
  case 'reset-resize': cmdResetResize(); break;
  case 'pull':        cmdPull(args); break;
  case 'info':        cmdInfo(); break;
  case 'help':
  default:            printHelp(); break;
}
