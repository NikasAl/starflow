#!/usr/bin/env node

/**
 * media-capture.mjs — Утилита для скриншотов и записи видео через ADB
 *
 * Использование:
 *   node scripts/media-capture.mjs screenshot [--name my-screen] [--resize WxH] [--crop 16:9]
 *   node scripts/media-capture.mjs record [--name my-video] [--duration 30] [--resize WxH] [--audio]
 *   node scripts/media-capture.mjs merge --video video.mp4 --audio sound.ogg
 *   node scripts/media-capture.mjs resize --width 720 --height 1280
 *   node scripts/media-capture.mjs reset-resize
 *   node scripts/media-capture.mjs info
 *
 * Примеры:
 *   node scripts/media-capture.mjs screenshot --crop 16:9
 *   node scripts/media-capture.mjs screenshot --name start-screen --crop 2560x1440
 *   node scripts/media-capture.mjs record --duration 15 --name promo
 *   node scripts/media-capture.mjs record --audio --duration 15 --name promo
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

// ── Ориентация ──────────────────────────────────────────────────

// Сохранить текущую ориентацию и принудительно включить landscape
function forceLandscape() {
  const currentRotation = runQuiet(adbCmd('shell settings get system user_rotation'));
  if (currentRotation && currentRotation !== 'null') {
    process._savedRotation = currentRotation;
  }

  // 1. Отключить автоповорот
  runQuiet(adbCmd('shell settings put global accelerometer_rotation 0'));

  // 2. Попробовать wm orientation (надёжнее на Android 12+)
  const wmOrientResult = runQuiet(adbCmd('shell wm orientation 1'));

  // 3. Также через settings (надёжнее на Samsung и др. OEM)
  runQuiet(adbCmd('shell settings put system user_rotation 1'));

  // 4. Подождать пока система применит
  run('sleep 1');

  // 5. Проверить результат
  const check = runQuiet(adbCmd('shell settings get system user_rotation'));
  if (check === '1') {
    console.log('[INFO] Ориентация: landscape (принудительно)');
  } else {
    console.log('[WARN] Ориентация может не быть landscape (user_rotation=' + check + ')');
  }
}

// Вернуть ориентацию
function restoreOrientation() {
  if (process._savedRotation !== undefined && process._savedRotation !== 'null') {
    runQuiet(adbCmd(`shell settings put system user_rotation ${process._savedRotation}`));
    console.log('[INFO] Ориентация: восстановлена');
  }
  // НЕ включаем обратно автоповорот — по умолчанию автоповорот выключен
}

// Установить разрешение с принудительным landscape
function setResolutionWithLandscape(w, h) {
  console.log(`[INFO] Установка разрешения: ${w}x${h} (landscape)`);
  // Сначала фиксируем ориентацию, потом меняем разрешение
  forceLandscape();
  runQuiet(adbCmd(`shell wm size ${w}x${h}`));
  // wm size сбрасывает ориентацию — сразу восстанавливаем
  runQuiet(adbCmd('shell settings put system user_rotation 1'));
  try { runQuiet(adbCmd('shell wm orientation 1')); } catch {}
  // Ждём пересоздание Surface + перерисовку
  run('sleep 2');
  // Финальная проверка
  const res = getDeviceResolution();
  if (res && (res.width !== w || res.height !== h)) {
    const phys = getPhysicalResolution();
    console.log(`[WARN] Разрешение ${w}x${h} не применилось. Текущее: ${res.width}x${res.height}`);
    if (phys) {
      console.log(`[INFO] Физическое разрешение: ${phys.width}x${phys.height}`);
      console.log('[INFO] Устройство может не поддерживать это разрешение.');
      console.log('[HINT] Попробуйте разрешение с таким же соотношением сторон.');
    }
  }
}

function checkScrcpy() {
  try {
    const ver = runQuiet('scrcpy --version');
    if (ver) return true;
  } catch {}
  return false;
}

function checkFfmpeg() {
  try {
    const ver = runQuiet('ffmpeg -version 2>&1 | head -1');
    if (ver) return true;
  } catch {}
  return false;
}

// ── Команды ────────────────────────────────────────────────────

function cmdScreenshot(args) {
  const name = args.name || `screenshot_${getTimestamp()}`;
  const resize = args.resize ? parseResolution(args.resize) : null;
  const crop = args.crop || null; // формат: '16:9' или '2560x1440'

  console.log('\n📸 Скриншот устройства');
  console.log('─'.repeat(40));

  // Установить разрешение + landscape если нужно
  if (resize) {
    setResolutionWithLandscape(resize.width, resize.height);
  }

  // Снять скриншот
  console.log('[INFO] Снимаем скриншот...');
  run(adbCmd(`shell screencap -p ${DEVICE_TMP_SCREENSHOT}`));

  const outDir = resolve(DEFAULTS.outputDir);
  ensureDir(outDir);

  let filename = `${name}.png`;
  let localPath = join(outDir, filename);

  console.log(`[INFO] Копируем: ${filename}`);
  run(adbCmd(`pull ${DEVICE_TMP_SCREENSHOT} "${localPath}"`));

  // Удалить временный файл с устройства
  runQuiet(adbCmd(`shell rm ${DEVICE_TMP_SCREENSHOT}`));

  // Обрезать до нужного соотношения если --crop
  if (crop) {
    const cropPath = localPath.replace(/\.png$/i, '_cropped.png');
    const cropResult = cropImage(localPath, cropPath, crop);
    if (cropResult) {
      localPath = cropPath;
      filename = `${name}_cropped.png`;
    }
  }

  console.log(`\n✅ Сохранено: ${localPath}`);

  // Вернуть разрешение + ориентацию если меняли
  if (resize) {
    console.log('[INFO] Возвращаем исходное разрешение и ориентацию...');
    resetResolution();
  }
}

// Обрезать изображение до нужного соотношения сторон (landscape)
function cropImage(inputPath, outputPath, crop) {
  if (!checkFfmpeg()) {
    console.log('[WARN] ffmpeg не найден — обрезка пропущена');
    return false;
  }

  // Определяем целевое соотношение
  let targetW, targetH;
  if (crop.match(/^\d+:\d+$/)) {
    const [rw, rh] = crop.split(':').map(Number);
    targetW = rw;
    targetH = rh;
  } else if (crop.match(/^\d+x\d+$/)) {
    const parsed = parseResolution(crop);
    targetW = parsed.width;
    targetH = parsed.height;
  } else {
    console.log(`[WARN] Неверный формат --crop: "${crop}". Используйте 16:9 или 2560x1440`);
    return false;
  }

  console.log(`[INFO] Обрезка до ${targetW}:${targetH}...`);

  // ffmpeg: scale to fit, then crop center
  // 1. scale=w*h*targetW/targetH:h — масштабируем так чтобы ширина совпала
  // 2. crop=targetW/targetH*ih:ih — обрезаем по центру
  const vf = `scale=trunc(iw*${targetH}/${targetW}/2)*2:trunc(ih/2)*2,crop=trunc(ih*${targetW}/${targetH}/2)*2:ih`;

  try {
    run(`ffmpeg -y -i "${inputPath}" -vf "${vf}" -q:v 2 "${outputPath}"`);
    console.log(`[INFO] Обрезано: ${outputPath}`);
    return true;
  } catch (e) {
    console.log(`[WARN] Обрезка не удалась: ${e.message}`);
    return false;
  }
}

// Пережать видео в целевое разрешение с letterbox (чёрные полосы по бокам/сверху-снизу)
function resizeVideo(inputPath, outputPath, targetW, targetH) {
  const vf = `scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2:black`;
  const cmd = `ffmpeg -y -i "${inputPath}" -vf "${vf}" -c:v libx264 -preset fast -crf 23 -c:a copy "${outputPath}"`;
  const result = runQuiet(cmd);
  if (result !== null) {
    console.log(`[INFO] Конвертация завершена: ${outputPath}`);
    return true;
  }
  console.log('[WARN] Конвертация не удалась (ffmpeg error)');
  return false;
}

function cmdRecord(args) {
  const name = args.name || `recording_${getTimestamp()}`;
  const duration = parseInt(args.duration) || DEFAULTS.videoDuration;
  const bitrate = parseInt(args.bitrate) || DEFAULTS.videoBitrate;
  const resize = args.resize ? parseResolution(args.resize) : null;
  const withAudio = args.audio === true || args.audio === 'true';

  // Если запрошен звук — используем scrcpy (есть звук) вместо screenrecord
  if (withAudio) {
    cmdRecordScrcpy(args);
    return;
  }

  if (resize) {
    console.log(`\n🎥 Запись видео (${duration} сек, ${Math.round(bitrate / 1000000)} Mbps)`);
    console.log(`   Целевое разрешение: ${resize.width}x${resize.height} (ffmpeg post-process)`);
  } else {
    console.log(`\n🎥 Запись видео (${duration} сек, ${Math.round(bitrate / 1000000)} Mbps)`);
  }
  console.log('─'.repeat(40));
  console.log('⚠️  screenrecord НЕ записывает звук (ограничение Android).');
  console.log('   Для записи со звуком: --audio (требуется scrcpy)');
  console.log();

  // Записываем в нативном разрешении устройства (не меняем wm size)
  const current = getDeviceResolution();
  if (current) {
    console.log(`[INFO] Запись в нативном разрешении: ${current.width}x${current.height}`);
  }

  // Разбудить экран если выключен (screenrecord не работает с выключенным экраном)
  runQuiet(adbCmd('shell input keyevent WAKEUP'));
  runQuiet(adbCmd('shell input keyevent 82'));
  run('sleep 1');

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

    // Проверяем что файл существует и имеет размер
    const check = runQuiet(adbCmd(`shell ls -la ${DEVICE_TMP_VIDEO}`));
    if (!check) {
      console.log('[INFO] Видео не записалось.');
      return;
    }

    // Проверяем минимальный размер (corrupt файл если запись оборвалась)
    const sizeMatch = check.match(/\d+/);
    const fileSize = sizeMatch ? parseInt(sizeMatch[0]) : 0;
    if (fileSize < 1000) {
      console.log(`[WARN] Файл слишком маленький (${fileSize} байт), запись скорее всего не удалась.`);
      runQuiet(adbCmd(`shell rm ${DEVICE_TMP_VIDEO}`));
      return;
    }

    const outDir = resolve(DEFAULTS.outputDir);
    ensureDir(outDir);

    const rawFile = `${name}_raw.mp4`;
    const rawPath = join(outDir, rawFile);

    console.log(`[INFO] Копируем: ${rawFile}`);
    run(adbCmd(`pull ${DEVICE_TMP_VIDEO} "${rawPath}"`));

    // Удалить временный файл с устройства
    runQuiet(adbCmd(`shell rm ${DEVICE_TMP_VIDEO}`));

    // Пост-обработка через ffmpeg если задан --resize
    if (resize) {
      if (!checkFfmpeg()) {
        console.log('[WARN] ffmpeg не найден — сохранено без изменения размера');
        console.log(`\n✅ Сохранено: ${rawPath} (без звука)`);
        return;
      }
      const finalFile = `${name}.mp4`;
      const finalPath = join(outDir, finalFile);
      console.log(`[INFO] Конвертация в ${resize.width}x${resize.height} (letterbox)...`);
      const ok = resizeVideo(rawPath, finalPath, resize.width, resize.height);
      if (ok) {
        // Удаляем исходник
        try { require('fs').unlinkSync(rawPath); } catch {}
        console.log(`\n✅ Сохранено: ${finalPath} (${resize.width}x${resize.height}, без звука)`);
      } else {
        console.log(`\n✅ Сохранено: ${rawPath} (без обработки, без звука)`);
      }
    } else {
      console.log(`\n✅ Сохранено: ${rawPath} (без звука)`);
    }
  });

  // Graceful shutdown — если нажали Ctrl+C
  process.on('SIGINT', () => {
    console.log('\n[INFO] Останавливаем запись...');
    recordProcess.kill('SIGINT');
  });

  // Graceful shutdown на SIGTERM
  process.on('SIGTERM', () => {
    process.exit(0);
  });
}

function cmdRecordScrcpy(args) {
  const name = args.name || `recording_${getTimestamp()}`;
  const duration = parseInt(args.duration) || DEFAULTS.videoDuration;
  const resize = args.resize ? parseResolution(args.resize) : null;
  const maxDuration = Math.min(duration, 180); // scrcpy max 180s

  if (!checkScrcpy()) {
    console.error('\n❌ scrcpy не найден!');
    console.error('   Установите: https://github.com/Genymobile/scrcpy/releases');
    console.error('   Или запишите без --audio (только видео через screenrecord)');
    process.exit(1);
  }

  const outDir = resolve(DEFAULTS.outputDir);
  ensureDir(outDir);
  const rawPath = join(outDir, `${name}_raw.mp4`);

  if (resize) {
    console.log(`\n🎥 Запись видео со звуком (scrcpy, ${maxDuration} сек)`);
    console.log(`   Целевое разрешение: ${resize.width}x${resize.height} (ffmpeg post-process)`);
  } else {
    console.log(`\n🎥 Запись видео со звуком (scrcpy, ${maxDuration} сек)`);
  }
  console.log('─'.repeat(40));

  // Записываем в нативном разрешении устройства
  const current = getDeviceResolution();
  if (current) {
    console.log(`[INFO] Запись в нативном разрешении: ${current.width}x${current.height}`);
  }

  // Разбудить экран если выключен
  runQuiet(adbCmd('shell input keyevent WAKEUP'));
  runQuiet(adbCmd('shell input keyevent 82'));
  run('sleep 1');

  console.log('[INFO] Начинаем запись (scrcpy --no-display --record)...');
  console.log(`[INFO] Для остановки нажмите Ctrl+C (или подождите ${maxDuration} сек)`);

  // scrcpy записывает прямо на хост (не на устройство) — без ADB pull
  const scrcpyArgs = [
    'scrcpy',
    '--no-display',
    '--no-window',
    '--record', rawPath,
    '--record-format', 'mp4',
    '--max-size', '0',          // original resolution
    '--max-fps', '60',
    '--video-codec', 'h264',
    '--audio-source', 'output', // internal audio (Android 11+)
    '--audio-codec', 'aac',
    '-K',                      // turn screen off during recording
  ];

  const recordProcess = exec(scrcpyArgs.join(' '), { stdio: 'inherit' });

  recordProcess.on('close', (code) => {
    console.log();
    if (!existsSync(rawPath)) {
      console.log('❌ Файл не создан. Возможные причины:');
      console.log('   - Android < 11 (нужен Android 11+ для записи звука)');
      console.log('   - scrcpy версия < 2.0');
      console.log('   - Устройство не поддерживает захват аудио');
      return;
    }

    // Пост-обработка через ffmpeg если задан --resize
    if (resize) {
      if (!checkFfmpeg()) {
        console.log('[WARN] ffmpeg не найден — сохранено без изменения размера');
        const finalPath = rawPath.replace(/_raw\.mp4$/i, '.mp4');
        try { require('fs').renameSync(rawPath, finalPath); } catch {}
        console.log(`✅ Сохранено: ${finalPath} (со звуком)`);
        return;
      }
      const finalPath = join(outDir, `${name}.mp4`);
      console.log(`[INFO] Конвертация в ${resize.width}x${resize.height} (letterbox)...`);
      const ok = resizeVideo(rawPath, finalPath, resize.width, resize.height);
      if (ok) {
        try { require('fs').unlinkSync(rawPath); } catch {}
        console.log(`✅ Сохранено: ${finalPath} (${resize.width}x${resize.height}, со звуком)`);
      } else {
        const fallback = rawPath.replace(/_raw\.mp4$/i, '.mp4');
        try { require('fs').renameSync(rawPath, fallback); } catch {}
        console.log(`✅ Сохранено: ${fallback} (со звуком, без изменения размера)`);
      }
    } else {
      const finalPath = rawPath.replace(/_raw\.mp4$/i, '.mp4');
      try { require('fs').renameSync(rawPath, finalPath); } catch {}
      console.log(`✅ Сохранено: ${finalPath} (со звуком)`);
    }
  });

  process.on('SIGINT', () => {
    console.log('\n[INFO] Останавливаем запись...');
    recordProcess.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    process.exit(0);
  });
}

function cmdMerge(args) {
  const video = args.video;
  const audio = args.audio;
  const output = args.output;

  if (!video || !audio) {
    console.error('\n❌ Укажите --video и --audio');
    console.error('   node scripts/media-capture.mjs merge --video video.mp4 --audio sound.ogg --output final.mp4');
    process.exit(1);
  }

  if (!checkFfmpeg()) {
    console.error('\n❌ ffmpeg не найден!');
    console.error('   Установите: sudo pacman -S ffmpeg / apt install ffmpeg / brew install ffmpeg');
    process.exit(1);
  }

  const videoPath = resolve(video);
  const audioPath = resolve(audio);
  const outPath = resolve(output || video.replace(/\.mp4$/i, '_with_audio.mp4'));

  if (!existsSync(videoPath)) { console.error(`❌ Видео не найдено: ${videoPath}`); process.exit(1); }
  if (!existsSync(audioPath)) { console.error(`❌ Аудио не найдено: ${audioPath}`); process.exit(1); }

  console.log(`\n🔀 Объединяем видео + аудио`);
  console.log('─'.repeat(40));
  console.log(`  Видео: ${videoPath}`);
  console.log(`  Аудио: ${audioPath}`);
  console.log(`  Вывод: ${outPath}`);
  console.log();

  run(`ffmpeg -y -i "${videoPath}" -i "${audioPath}" -c:v copy -c:a aac -b:a 192k -shortest "${outPath}"`);
  console.log(`\n✅ Готово: ${outPath}`);
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
  const physical = getPhysicalResolution();
  if (current) {
    console.log(`[INFO] Текущее: ${current.width}x${current.height}`);
  }
  if (physical) {
    console.log(`[INFO] Физическое: ${physical.width}x${physical.height}`);
  }

  // 1. Сначала принудительно устанавливаем landscape
  forceLandscape();

  // 2. Устанавливаем разрешение
  run(adbCmd(`shell wm size ${width}x${height}`));

  // 3. wm size сбрасывает ориентацию — сразу восстанавливаем
  runQuiet(adbCmd('shell settings put system user_rotation 1'));
  try { runQuiet(adbCmd('shell wm orientation 1')); } catch {}

  // 4. Ждём пересоздание
  run('sleep 2');

  // 5. Проверяем результат
  const updated = getDeviceResolution();
  if (updated) {
    if (updated.width === width && updated.height === height) {
      console.log(`[INFO] Установлено: ${updated.width}x${updated.height}`);
    } else {
      console.log(`[WARN] Разрешение ${width}x${height} НЕ применилось!`);
      console.log(`[INFO] Фактическое: ${updated.width}x${updated.height}`);
      console.log();
      console.log('[TIP] Ваше устройство может не поддерживать произвольные разрешения.');
      console.log('      Попробуйте скриншот с обрезкой до 16:9:');
      console.log(`      node scripts/media-capture.mjs screenshot --crop 16:9`);
    }
  }
  console.log('\n💡 Для возврата: node scripts/media-capture.mjs reset-resize');
}

function cmdResetResize() {
  console.log('\n📐 Сброс разрешения к физическому');
  console.log('─'.repeat(40));

  const physical = getPhysicalResolution();
  if (physical) {
    console.log(`[INFO] Физическое разрешение: ${physical.width}x${physical.height}`);
    runQuiet(adbCmd(`shell wm size ${physical.width}x${physical.height}`));
  } else {
    // Fallback — сброс через команду
    runQuiet(adbCmd('shell wm size reset'));
  }

  // Восстанавливаем landscape после сброса
  runQuiet(adbCmd('shell settings put system user_rotation 1'));
  try { runQuiet(adbCmd('shell wm orientation 1')); } catch {}
  run('sleep 1');

  const current = getDeviceResolution();
  console.log(`[INFO] Текущее: ${current?.width}x${current?.height}`);
  console.log('\n✅ Разрешение сброшено, ориентация: landscape');
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

  // Проверяем scrcpy (для записи со звуком)
  const scrcpy = checkScrcpy();
  console.log(`  scrcpy:         ${scrcpy ? 'доступен ✅ (запись со звуком)' : 'НЕ найден (video only)'}`);
  if (!scrcpy) {
    console.log('    Установите: https://github.com/Genymobile/scrcpy/releases');
  }

  // Проверяем ffmpeg (для merge)
  const ffmpeg = checkFfmpeg();
  console.log(`  ffmpeg:         ${ffmpeg ? 'доступен' : 'НЕ найден (для merge --video + --audio)'}`);
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
  record         Записать видео (--audio для записи со звуком)
  merge          Объединить видео + аудио (требуется ffmpeg)
  resize         Установить разрешение устройства
  reset-resize   Вернуть физическое разрешение
  pull           Скопировать временные файлы с устройства
  info           Информация об устройстве

Опции:
  --name <имя>       Имя файла (по умолчанию: timestamp)
  --resize WxH       Целевое разрешение видео (ffmpeg post-process с letterbox)
                     Для скриншотов: временная смена разрешения устройства
  --crop W:H         Обрезать скриншот до соотношения (16:9) или размера (2560x1440)
  --duration <сек>   Длительность записи видео (по умолчанию: 30)
  --bitrate <bps>    Битрейт видео (по умолчанию: 8000000 = 8 Mbps)
  --audio            Записывать со звуком (требуется scrcpy + Android 11+)
  --video <файл>     Видео файл (для merge)
  --audio <файл>     Аудио файл (для merge)
  --output <файл>    Выходной файл (для merge, по умолчанию: video_with_audio.mp4)
  --width <px>       Ширина (для resize)
  --height <px>      Высота (для resize)
  --dir <путь>       Директория для файлов (по умолчанию: ./captures)

Примеры:
  # Скриншот с обрезкой до 16:9 (без изменения разрешения устройства)
  node scripts/media-capture.mjs screenshot --crop 16:9

  # Скриншот с обрезкой до точного размера 2560x1440
  node scripts/media-capture.mjs screenshot --crop 2560x1440

  # Скриншот в 16:9 с именем для RuStore
  node scripts/media-capture.mjs screenshot --name rustore-1-start --crop 16:9

  # Скриншот через смену разрешения (если устройство поддерживает)
  node scripts/media-capture.mjs screenshot --resize 2560x1440

  # Записать промо-видео 15 секунд (только видео)
  node scripts/media-capture.mjs record --duration 15 --name promo

  # Записать видео и пережать в 1024x578 (16:9, letterbox через ffmpeg)
  node scripts/media-capture.mjs record --duration 60 --name promo --resize 1024x578

  # Записать видео со звуком (scrcpy + Android 11+)
  node scripts/media-capture.mjs record --audio --duration 15 --name promo --resize 1024x578

  # Объединить видео + аудио файл (ffmpeg)
  node scripts/media-capture.mjs merge --video captures/gameplay.mp4 --audio sound.ogg

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
  const commands = ['screenshot', 'record', 'merge', 'resize', 'reset-resize', 'pull', 'info', 'help'];

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
  case 'merge':       cmdMerge(args); break;
  case 'resize':      cmdResize(args); break;
  case 'reset-resize': cmdResetResize(); break;
  case 'pull':        cmdPull(args); break;
  case 'info':        cmdInfo(); break;
  case 'help':
  default:            printHelp(); break;
}
