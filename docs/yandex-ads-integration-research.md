# Yandex Ads SDK — Исследование интеграции для Star Flow

> Дата: 2026-04-24
> Статус: исследование
> Контекст: Star Flow — 3D космическая стратегия (Three.js + Capacitor + TypeScript), релиз на RuStore

---

## 1. Краткое резюме

**Цель:** Добавить Rewarded Video (рекламу с вознаграждением) в Star Flow для заработка внутриигровой валюты «энергия».

**Главная проблема:** Yandex Mobile Ads SDK работает только как **нативная Android-библиотека** (Java/Kotlin). WebView/HTML-интеграция **официально не поддерживается**. Capacitor оборачивает веб-приложение в WebView → нужен **нативный мост** (bridge plugin).

**Рекомендуемый подход:** Написать кастомный Capacitor Plugin на Kotlin, который:
1. Подключает Yandex Mobile Ads SDK (v7.18.5)
2. Вызывает RewardedAd из нативного кода
3. Возвращает результат (success/failure) в JavaScript через `CapacitorPlugin`

---

## 2. Текущее состояние проекта

### 2.1 Архитектура

| Компонент | Технология |
|-----------|-----------|
| Игра | Three.js + TypeScript (Vite) |
| Обёртка | Capacitor 6 (Android) |
| Пакет | `com.starflow.game` |
| Целевая платформа | RuStore (Android) |
| Текущий ad-manager | **Stub** — сразу возвращает `true` без показа рекламы |

### 2.2 Существующий код рекламы

Файл `src/ads/ad-manager.ts` — заглушка:

```typescript
class AdManager {
  async showRewardedAd(): Promise<boolean> {
    // TODO: Replace with actual Yandex Ads SDK call for RuStore
    return true; // всегда даёт награду
  }
  isReady(): boolean { return true; }
}
```

### 2.3 Android-часть

- `scripts/setup-android.mjs` — пост-настройка после `cap sync` (landscape, immersive mode, иконки)
- `MainActivity.java` — расширен для immersive fullscreen
- `variables.gradle` — содержит версии зависимостей
- Android SDK не добавлен в репозиторий (не запускали `cap add android` в текущей сессии)

---

## 3. Yandex Mobile Ads SDK — ключевые данные

### 3.1 Версии и координаты

| Параметр | Значение |
|----------|---------|
| Текущая версия SDK | **7.18.5** (апрель 2026) |
| Maven artifact | `com.yandex.android:mobileads:7.18.5` |
| Репозиторий | Google Play (maven.google.com) + Maven Central |
| Min Android SDK | API 21 (Android 5.0) |
| Android Gradle Plugin | >= 8.7.0 |
| Kotlin | 1.9+ |
| Java | 17 (для сборки) |
| Поддерживаемые форматы | Banner, Interstitial, Rewarded, Native, App Open |

### 3.2 Формат Rewarded Video

Rewarded Video — полноэкранная реклама, за просмотр которой пользователь получает награду. Это единственный подходящий формат для Star Flow:

- Пользователь нажимает кнопку «+5 энергии» в HUD
- Показывается полноэкранное видео (15–30 сек)
- После просмотра начисляется энергия
- Если закрыл до конца — награда не выдаётся

**Классы SDK для Rewarded:**
- `RewardedAdLoader` — загрузчик рекламы
- `RewardedAd` — объект рекламы
- `RewardedAdEventListener` — колбэки (onAdShown, onAdFailedToShow, onImpression, onLeftApplication, onReturnedToApplication, onReward, onAdClicked)
- `AdRequestConfiguration` — параметры запроса (location, age, gender)
- `AdError` — объект ошибки

### 3.3 Регистрация в РСЯ

Для показа рекламы через Yandex Ads нужно:

1. **Зарегистрироваться** в Рекламной сети Яндекса (РСЯ): https://ads.yandex.com/monetization
2. **Добавить приложение** — указать название, категорию, платформу (Android)
3. **Пройти модерацию** — обычно 1–3 дня
4. **Получить ad unit ID** — уникальный идентификатор блока рекламы (R-M-XXXXXX-XXXXX-XXXXX)
5. **Настроить реквизиты** — для выплат

### 3.4 Самозанятые и РСЯ — ВАЖНО!

РСЯ **поддерживает** самозанятых:

- В интерфейсе РСЯ → «Документы» → виджет «Тип сотрудничества» → выбрать «Самозанятый»
- Можно зарегистрироваться как самозанятый прямо из интерфейса РСЯ
- Яндекс сам генерирует чеки (до 10% от дохода за tax deductions)
- **Нет ИП/ООО** — подходит для текущего статуса

> В отличие от RuStore inapp (который недоступен для самозанятых), РСЯ полностью работает с самозанятыми.

### 3.5 Официальная позиция по WebView

Из FAQ Yandex Ads (https://ads.yandex.com/helpcenter/en/support/faq/sdk-integration):

> **Does the Yandex Mobile Ads SDK support integration via HTML or WebView JS code?**
> No, the SDK can be integrated with apps only as a library. Interaction with WebView is not supported.

Это означает, что нужно использовать **нативный код Android (Kotlin/Java)**, а не JavaScript внутри WebView.

---

## 4. Архитектура интеграции

### 4.1 Схема данных

```
┌─────────────────────────────────────────────────┐
│  JavaScript (WebView / Capacitor)               │
│                                                 │
│  ad-manager.ts                                  │
│  ├── showRewardedAd()                           │
│  │   └── bridge.showRewardedAd() ─────────────┐ │
│  └── onReward / onError                        │ │
│                                                 │
└─────────────────────────────────────────────────┘
                        │
                        │ Capacitor Plugin Bridge
                        │ (CapacitorPlugin @PluginMethod)
                        ▼
┌─────────────────────────────────────────────────┐
│  Kotlin (Native Android)                        │
│                                                 │
│  YandexAdsPlugin.kt                             │
│  ├── @PluginMethod showRewardedAd()             │
│  │   ├── RewardedAdLoader.loadAd()              │
│  │   ├── RewardedAd.show()                      │
│  │   └── onReward → notify() → JS resolve(true) │
│  └── init() — MobileAds.initialize()            │
│                                                 │
│  Yandex Mobile Ads SDK 7.18.5                   │
│  └── com.yandex.android:mobileads               │
└─────────────────────────────────────────────────┘
```

### 4.2 Жизненный цикл Rewarded Ad

```
App Start
  │
  ▼
MobileAds.initialize(context)  ← один раз при запуске
  │
  ▼
User clicks "+5 энергии"
  │
  ▼
JS: bridge.showRewardedAd()
  │
  ▼
Kotlin: RewardedAdLoader.loadAd(adRequestConfiguration)
  │
  ├── onAdLoaded(ad) ──→ ad.show(activity)
  │                           │
  │                     ┌─────┴──────┐
  │                     ▼            ▼
  │               onAdShown    onAdFailedToShow
  │                     │            │
  │                     ▼            ▼
  │               User watches   notify(error)
  │               video...      → JS resolve(false)
  │                     │
  │                     ▼
  │               onReward()    ← успех!
  │                     │
  │                     ▼
  │               notify(success)
  │               → JS resolve(true)
  │
  ├── onAdFailedToLoad(error) → JS resolve(false)
  │
  └── onLeftApplication → user left app during ad
```

---

## 5. Пошаговый план интеграции

### Шаг 1. Регистрация в РСЯ (без кода)

- [ ] Зайти на https://ads.yandex.com/monetization
- [ ] Зарегистрироваться как самозанятый (или привязать статус «Мой Налог»)
- [ ] Добавить приложение «Star Flow Command» (Android)
- [ ] Создать блок Rewarded Video → получить **ad unit ID** (R-M-XXXXXX...)
- [ ] Создать тестовый блок (demo) для отладки
- [ ] Пройти модерацию (1–3 дня)

### Шаг 2. Настройка Android-проекта

В `android/app/build.gradle`:

```groovy
dependencies {
    implementation 'com.yandex.android:mobileads:7.18.5'
}
```

В `android/build.gradle` (project-level):

```groovy
repositories {
    google()
    mavenCentral()
}
```

В `AndroidManifest.xml`:

```xml
<manifest>
    <uses-permission android:name="android.permission.INTERNET" />
    <!-- AGE_RATING: указать возрастной рейтинг (3+, 7+, 12+, 16+, 18+) -->
    <meta-data
        android:name="com.yandex.mobile.ads.AGE_RATING"
        android:value="age_12" />
</manifest>
```

### Шаг 3. Создание Capacitor Plugin

Структура файлов:

```
android/app/src/main/java/com/starflow/game/
├── MainActivity.java          ← уже существует
└── YandexAdsPlugin.kt         ← НОВЫЙ

src/ads/
├── ad-manager.ts              ← обновить (заменить stub)
└── definitions.ts             ← TypeScript-определения для bridge
```

**YandexAdsPlugin.kt** (основной файл):

```kotlin
package com.starflow.game

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.getcapacitor.annotation.Permission
import com.yandex.mobile.ads.common.AdRequest
import com.yandex.mobile.ads.common.InitializationListener
import com.yandex.mobile.ads.rewarded.RewardedAd
import com.yandex.mobile.ads.rewarded.RewardedAdEventListener
import com.yandex.mobile.ads.rewarded.RewardedAdLoader

@CapacitorPlugin(
    name = "YandexAds",
    permissions = [
        Permission(strings = ["android.permission.INTERNET"])
    ]
)
class YandexAdsPlugin : Plugin() {

    private var rewardedAd: RewardedAd? = null
    private var rewardedAdLoader: RewardedAdLoader? = null
    private var pendingCall: PluginCall? = null
    private var isInitialized = false

    // --- Инициализация SDK ---
    @PluginMethod
    fun initialize(call: PluginCall) {
        if (isInitialized) {
            call.resolve(JSObject().put("success", true))
            return
        }
        com.yandex.mobile.ads.MobileAds.initialize(context) {
            isInitialized = true
            call.resolve(JSObject().put("success", true))
        }
    }

    // --- Загрузка и показ Rewarded Video ---
    @PluginMethod
    fun showRewardedAd(call: PluginCall) {
        if (!isInitialized) {
            call.resolve(JSObject().put("granted", false).put("error", "not_initialized"))
            return
        }

        val adUnitId = call.getString("adUnitId", "demo-rewarded-yandex")
        pendingCall = call

        // Создать загрузчик (одноразовый, по новому для каждой загрузки)
        rewardedAdLoader = RewardedAdLoader(context)
        rewardedAdLoader?.setAdEventListener(object : RewardedAdEventListener {
            override fun onAdLoaded(ad: RewardedAd) {
                rewardedAd = ad
                // Показать сразу после загрузки
                ad.show(activity)
            }

            override fun onAdFailedToLoad(error: com.yandex.mobile.ads.common.AdError) {
                pendingCall?.resolve(
                    JSObject()
                        .put("granted", false)
                        .put("error", "load_failed: ${error.description}")
                )
                pendingCall = null
                cleanup()
            }

            override fun onAdShown() { /* можно логировать */ }

            override fun onAdFailedToShow(error: com.yandex.mobile.ads.common.AdError) {
                pendingCall?.resolve(
                    JSObject()
                        .put("granted", false)
                        .put("error", "show_failed: ${error.description}")
                )
                pendingCall = null
                cleanup()
            }

            override fun onImpression(impressionData: com.yandex.mobile.ads.common.ImpressionData?) {}

            override fun onLeftApplication() {}

            override fun onReturnedToApplication() {}

            override fun onReward() {
                pendingCall?.resolve(JSObject().put("granted", true))
                pendingCall = null
                cleanup()
            }

            override fun onAdClicked() {}

            override fun onAdDismissed() {
                // Если закрыли до награды — уже обработано в onReward или onAdFailedToShow
                // Но на всякий случай — если pendingCall не обработан
                pendingCall?.let {
                    if (it.data == null || !it.data.has("granted")) {
                        it.resolve(JSObject().put("granted", false).put("error", "dismissed"))
                    }
                }
                pendingCall = null
                cleanup()
            }
        })

        // Начать загрузку
        val adRequest = AdRequest.Builder().build()
        rewardedAdLoader?.loadAd(adUnitId, adRequest)
    }

    @PluginMethod
    fun isReady(call: PluginCall) {
        call.resolve(JSObject().put("ready", isInitialized))
    }

    private fun cleanup() {
        rewardedAd = null
        rewardedAdLoader = null
    }
}
```

**Регистрация плагина в MainActivity.java:**

```java
import com.starflow.game.YandexAdsPlugin;

// В начале onCreate():
this.init(
    new YandexAdsPlugin()  // добавить после существующих плагинов
);
```

### Шаг 4. Обновление TypeScript-части

**src/ads/definitions.ts:**

```typescript
import { registerPlugin } from '@capacitor/core';

export interface YandexAdsPlugin {
  initialize(): Promise<{ success: boolean }>;
  showRewardedAd(options?: { adUnitId?: string }): Promise<{ granted: boolean; error?: string }>;
  isReady(): Promise<{ ready: boolean }>;
}

const NativeYandexAds = registerPlugin<YandexAdsPlugin>('YandexAds');
export default NativeYandexAds;
```

**src/ads/ad-manager.ts** (обновлённый):

```typescript
import { Capacitor } from '@capacitor/core';
import YandexAds from './definitions';

class AdManager {
  private nativePlugin = Capacitor.isNativePlatform() ? YandexAds : null;

  async initialize(): Promise<void> {
    if (this.nativePlugin) {
      await this.nativePlugin.initialize();
    }
  }

  async showRewardedAd(): Promise<boolean> {
    // Веб / десктоп — заглушка (для разработки)
    if (!this.nativePlugin) {
      console.log('[AdManager] Not native platform — granting reward (dev mode)');
      return true;
    }
    const result = await this.nativePlugin.showRewardedAd();
    return result.granted;
  }

  isReady(): boolean {
    return true; // в dev mode всегда готов
  }
}

export const adManager = new AdManager();
```

### Шаг 5. Тестовые ad unit ID

Yandex предоставляет тестовые ID для отладки (показывают тестовую рекламу, клики не тарифицируются):

| Формат | Тестовый ID |
|--------|-----------|
| Rewarded | `demo-rewarded-yandex` |

Для production заменить на реальный ID из интерфейса РСЯ.

### Шаг 6. Автоматизация через setup-android.mjs

Добавить в существующий скрипт `scripts/setup-android.mjs`:

1. Автоматически добавлять зависимость `com.yandex.android:mobileads:7.18.5` в `build.gradle`
2. Добавлять `INTERNET` permission в `AndroidManifest.xml`
3. Добавлять `AGE_RATING` meta-data
4. Инжектировать регистрацию плагина в `MainActivity.java`

---

## 6. Тестовые ad unit ID

Yandex предоставляет тестовые ID для отладки (показывают тестовую рекламу, клики не тарифицируются):

| Формат | Тестовый ID |
|--------|-----------|
| Rewarded | `demo-rewarded-yandex` |

Для production заменить на реальный ID из интерфейса РСЯ.

---

## 7. Автоматизация через setup-android.mjs

Добавить в существующий скрипт `scripts/setup-android.mjs`:

1. Автоматически добавлять зависимость `com.yandex.android:mobileads:7.18.5` в `build.gradle`
2. Добавлять `INTERNET` permission в `AndroidManifest.xml`
3. Добавлять `AGE_RATING` meta-data
4. Инжектировать регистрацию плагина в `MainActivity.java`

---

## 8. Альтернативный подход — Yandex Games SDK

Yandex Games SDK (`ysdk.adv.showRewardedVideo`) — для браузерных игр на https://yandex.com/games/. Этот вариант **не подходит** для RuStore/Android-приложения.

---

## 9. Доходность и ожидания

| Метрика | Оценка |
|---------|--------|
| CPM Rewarded (Россия) | ~100–300 руб / 1000 показов |
| Средний показ в день (10 DAU) | 2–4 показа на юзера |
| Доход в день (10 DAU) | ~2–12 руб |
| Доход в месяц (10 DAU) | ~60–360 руб |
| Доход при 100 DAU | ~600–3600 руб/мес |
| Выплаты РСЯ | Ежемесячно, порог ~1000 руб |

**Для первых месяцев** ожидать минимальный доход. Основная монетизация — масштабирование аудитории.

---

## 10. Чеклист реализации

### Регистрация (без кода)
- [ ] Зарегистрироваться в РСЯ как самозанятый
- [ ] Добавить приложение Star Flow
- [ ] Создать блок Rewarded Video
- [ ] Получить production ad unit ID
- [ ] Сохранить ID в `.env` или конфиге

### Разработка
- [ ] Создать `android/app/src/main/java/com/starflow/game/YandexAdsPlugin.kt`
- [ ] Обновить `scripts/setup-android.mjs` — авто-добавление SDK зависимости
- [ ] Создать `src/ads/definitions.ts` — TypeScript-интерфейс для Capacitor bridge
- [ ] Обновить `src/ads/ad-manager.ts` — подключить нативный плагин
- [ ] Добавить инициализацию в `main.ts` при запуске на нативной платформе
- [ ] Протестировать с `demo-rewarded-yandex` ID
- [ ] Заменить на production ID после модерации

### Release
- [ ] Собрать release APK с Yandex Ads SDK
- [ ] Протестировать на реальном устройстве
- [ ] Загрузить на RuStore
- [ ] Подключить аналитику показов в интерфейсе РСЯ

---

## 11. Полезные ссылки

| Ресурс | URL |
|--------|-----|
| Yandex Ads SDK Quick Start | https://ads.yandex.com/helpcenter/en/dev/android/quick-start |
| Rewarded Video Guide | https://ads.yandex.com/helpcenter/en/dev/android/rewarded |
| GitHub — SDK Android | https://github.com/yandexmobile/yandex-ads-sdk-android |
| SDK 7 Features | https://ads.yandex.com/sdk7 |
| Changelog | https://ads.yandex.com/helpcenter/en/dev/android/changelog-android |
| FAQ (WebView — NO) | https://ads.yandex.com/helpcenter/en/support/faq/sdk-integration |
| Maven: mobileads | https://mvnrepository.com/artifact/com.yandex.android/mobileads |
| Регистрация в РСЯ | https://ads.yandex.com/helpcenter/ru/monetization/account/joining |
| Самозанятые в РСЯ | https://yandex.ru/project/yan/npd |
| Тестовые ad unit ID | (указаны в доках SDK, `demo-rewarded-yandex`) |
