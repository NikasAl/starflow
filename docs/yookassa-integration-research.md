# YooKassa — Исследование интеграции покупки энергии в Star Flow

> Дата: 2026-04-24
> Статус: исследование
> Контекст: Star Flow — 3D космическая стратегия (Three.js + Capacitor + TypeScript), RuStore
> Существующая инфраструктура: YooKassa на kreagenium.ru (FastAPI, создание счетов)

---

## 1. Краткое резюме

**Цель:** Позволить игрокам покупать внутриигровую валюту «энергия» за реальные рубли через YooKassa.

**Главный вывод:** У тебя уже есть готовый серверный код для YooKassa (создание invoice, проверка статуса). Для интеграции в мобильное приложение нужно:

1. **Добавить endpoint для Star Flow** на существующий сервер (или отдельный)
2. **В приложении** — открыть payment_url в системном браузере через `@capacitor/browser`
3. **После оплаты** — вернуться в приложение через deep link (`starflow://payment?invoice_id=xxx`)
4. **Проверить статус** через серверный API → выдать энергию

**Преимущества подхода:**
- Не нужен отдельный юрлицо — используешь существующий аккаунт YooKassa
- Минимальная комиссия: от **0.4%** за успешный платёж (базовый тариф)
- Самозанятый: НПД 4% от физлиц, 6% от юрлиц/ИП
- Уже знакомый код — не нужно изучать новый SDK

---

## 2. Существующая инфраструктура

### 2.1 Сервер (kreagenium.ru)

```
FastAPI
├── POST /billing/create    → { invoice_id, payment_url, amount }
├── GET  /billing/status/:id → { invoice_id, status, is_paid, ... }
├── GET  /billing/check/:id  → { invoice_id, is_paid }
└── GET  /billing/prices     → { premium: { price, features } }
```

Сервис использует `create_invoice()` и `get_invoice_status()` из `yookassa_service`.

### 2.2 Текущая система энергии в игре

| Параметр | Значение |
|----------|---------|
| Стартовая энергия | 5 |
| Энергия за рекламу (Ads) | +5 |
| Буст «Ускорение» | 5 энергии (15 сек) |
| Буст «Заморозка» | 8 энергии (10 сек) |
| Буст «Щит» | 10 энергии (8 сек) |

---

## 3. Архитектура платежей

### 3.1 Схема данных

```
┌──────────────────────────────────────────────────────────┐
│  Star Flow (Capacitor / WebView)                         │
│                                                          │
│  Игрок нажимает «Купить энергию»                         │
│  ├── 10 энергии — 10₽                                   │
│  ├── 30 энергии — 25₽                                   │
│  └── 100 энергии — 79₽                                  │
│                                                          │
│  → fetch POST /api/billing/create                        │
│    { device_id, amount, product: "energy_30" }           │
│                                                          │
│  ← { invoice_id, payment_url }                           │
│                                                          │
│  → @capacitor/browser.open({ url: payment_url })         │
│  → Системный браузер: оплата картой/СБП/ЮMoney          │
│                                                          │
│  ← Пользователь платит → YooKassa редиректит:           │
│    starflow://payment/success?invoice_id=xxx              │
│  или:                                                    │
│    starflow://payment/fail?invoice_id=xxx                │
│                                                          │
│  → fetch GET /api/billing/check/:invoice_id              │
│  ← { is_paid: true }                                     │
│  → grantEnergy(state, 30)                                │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Сервер kreagenium.ru (FastAPI)                           │
│                                                          │
│  POST /api/billing/create                                │
│  ├── Валидация product → amount                           │
│  ├── create_invoice(amount, description, device_id,      │
│  │                 metadata: { product, game: "starflow" })│
│  └── return { invoice_id, payment_url }                   │
│                                                          │
│  GET /api/billing/check/:id                               │
│  └── return { is_paid: true/false }                       │
│                                                          │
│  Webhook от YooKassa (опционально):                        │
│  POST /api/billing/webhook                                │
│  └── Подтверждение платежа от YooKassa                    │
└──────────────────────────────────────────────────────────┘
```

### 3.2 Жизненный цикл покупки

```
1. Игрок в игре → нажимает «Купить 30 энергии за 25₽»
2. Приложение → POST /api/billing/create
   body: { device_id: "uuid", amount: 25, product: "energy_30" }
3. Сервер → создаёт invoice в YooKassa с metadata:
   { product: "energy_30", game: "starflow", energy_amount: 30 }
4. Сервер → возвращает { invoice_id: "xxx", payment_url: "https://..." }
5. Приложение → открывает payment_url в системном браузере
   через @capacitor/browser.open()
6. Пользователь → платит картой / СБП / ЮMoney
7. YooKassa → редиректит на return_url:
   starflow://payment/success?invoice_id=xxx
8. Приложение → ловит deep link, проверяет:
   GET /api/billing/check/xxx → { is_paid: true }
9. Приложение → grantEnergy(state, 30) + UI обновление
10. YooKassa → отправляет webhook на сервер (confirmation)
```

---

## 4. Тарифы YooKassa и налоги

### 4.1 Комиссия YooKassa

| Тариф | Комиссия |
|-------|---------|
| Базовый (по умолчанию) | **2.8%** с банковских карт РФ |
| Минимальная ставка | **0.4%** (при обороте от 500К₽/мес) |
| Отмена / возврат | **0₽** (без комиссии) |

### 4.2 Налоги для самозанятого

| Параметр | Значение |
|----------|---------|
| НПД от физлиц | **4%** |
| НПД от юрлиц/ИП | **6%** |
| Налоговый вычет | До **10 000₽** в год |
| Лимит дохода | **2 400 000₽** / год |
| Декларация | Не нужна (Мой Налог считает автоматически) |

### 4.3 Пример расчёта

Покупка на **25₽** (30 энергии):

```
Входящий платёж:           25.00 ₽
Комиссия YooKassa (2.8%):  -0.70 ₽
Выплата на счёт:           24.30 ₽
НПД 4% (физлицо):         -0.97 ₽
Чистый доход:              23.33 ₽
```

---

## 5. Товары (пакеты энергии)

| Пакет | Энергия | Цена | Энергия/руб | Маркетинговое название |
|-------|---------|------|-------------|----------------------|
| Малый | 10 | 10₽ | 1.00 | «Разведчик» |
| Средний | 30 | 25₽ | 1.20 | «Командир» |
| Большой | 100 | 79₽ | 1.27 | «Адмирал» |

**Ценообразование:** Большой пакет выгоднее — стимулирует покупки бóльших сумм.
Энергия расходуется на бусты:
- 1 буст «Ускорение» = 5 энергии
- 1 буст «Заморозка» = 8 энергии
- 1 буст «Щит» = 10 энергии

---

## 6. Интеграция — технические детали

### 6.1 Deep Link (Android App Links)

Для возврата из браузера в приложение после оплаты нужен **deep link scheme**.

В `AndroidManifest.xml` (добавляется автоматически Capacitor):

```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="starflow" />
</intent-filter>
```

В `capacitor.config.ts`:

```typescript
const config: CapacitorConfig = {
  appId: 'com.starflow.game',
  appName: 'Star Flow Command',
  webDir: 'dist',
  server: {
    // Для dev: нужен для глубоких ссылок
    // androidScheme: 'https'
  },
  plugins: {
    SplashScreen: { launchShowDuration: 0 },
    App: {
      // Deep link scheme для возврата после оплаты
      urlScheme: 'starflow',
    },
  },
};
```

### 6.2 return_url для YooKassa

При создании invoice на сервере нужно указать `return_url`:

```python
return_url = f"starflow://payment/success?invoice_id={invoice_id}"
```

YooKassa после успешной оплаты редиректит браузер на этот URL.
Android перехватит `starflow://` схему и откроет приложение.

### 6.3 @capacitor/browser

Для открытия платёжной страницы в системном браузере:

```bash
npm install @capacitor/browser
npx cap sync
```

Использование в TypeScript:

```typescript
import { Browser } from '@capacitor/browser';

async function openPayment(paymentUrl: string) {
  await Browser.open({ url: paymentUrl });
  // После оплаты: deep link вернёт пользователя в приложение
}
```

### 6.4 Обработка deep link

```typescript
import { App } from '@capacitor/app';

App.addListener('appUrlOpen', (event: { url: string }) => {
  const url = new URL(event.url);

  if (url.host === 'payment') {
    const invoiceId = url.searchParams.get('invoice_id');
    if (invoiceId) {
      handlePaymentCallback(invoiceId);
    }
  }
});

async function handlePaymentCallback(invoiceId: string) {
  // Проверить статус оплаты через сервер
  const response = await fetch(
    `https://kreagenium.ru/api/billing/check/${invoiceId}`
  );
  const data = await response.json();

  if (data.is_paid) {
    // Получить amount энергии из конфига пакетов
    // Или сохранить в metadata при создании invoice
    grantEnergy(state, energyAmount);
    // Показать toast «Энергия получена!»
  }
}
```

### 6.5 Серверные изменения

Новый endpoint (или расширение существующего):

```python
@router.post("/billing/create-starflow", response_model=PaymentCreateResponse)
async def create_starflow_payment(request: PaymentCreateRequest):
    """Создание платежа для покупки энергии в Star Flow."""
    # Определить пакет энергии по сумме
    products = {
        10:  {"energy": 10,  "name": "Разведчик"},
        25:  {"energy": 30,  "name": "Командир"},
        79:  {"energy": 100, "name": "Адмирал"},
    }

    product = products.get(int(request.amount))
    if not product:
        raise HTTPException(400, "Invalid product amount")

    description = f"Star Flow: {product['name']} ({product['energy']} энергии)"

    invoice_id, payment_url = create_invoice(
        amount=request.amount,
        description=description,
        device_id=request.device_id,
        metadata={
            "type": "starflow_energy",
            "energy_amount": str(product["energy"]),
            "game": "starflow",
        }
    )

    return PaymentCreateResponse(
        invoice_id=invoice_id,
        payment_url=payment_url,
        amount=request.amount,
    )
```

**Важно:** В YooKassa API при создании платежа указать `return_url`:

```python
# В yookassa_service.py
payment_data = {
    "amount": {"value": str(amount), "currency": "RUB"},
    "confirmation": {
        "type": "redirect",
        "return_url": f"starflow://payment/success?invoice_id={invoice_id}"
    },
    "description": description,
    "metadata": metadata,
    "capture": True,  # Автоматическое подтверждение
}
```

---

## 7. Сравнение подходов

### Вариант A: Payment URL в системном браузере (рекомендуемый)

| Плюс | Минус |
|------|-------|
| Минимальная доработка (один endpoint) | Пользователь покидает приложение |
| Использует существующий сервер | Нужен deep link для возврата |
| Все способы оплаты YooKassa | Зависимость от интернет-соединения |
| Нет нативного кода | |

### Вариант B: YooKassa Mobile SDK (нативный)

| Плюс | Минус |
|------|-------|
| Платёж внутри приложения | Нужно согласовать с менеджером YooKassa |
| Лучший UX | Требует Kotlin/Java plugin |
| Нет переклюения на браузер | Дольше разрабатывать |
| | Нужен отдельный shop_id для приложения |

### Вариант C: YooKassa + InAppBrowser (встроенный)

| Плюс | Минус |
|------|-------|
| Не покидает приложение | Проблемы с редиректами из WebView |
| | Может не работать СБП |
| | Google Pay / SberPay могут не работать |

**Рекомендация: Вариант A** (системный браузер). Проще реализовать, надёжнее, использует существующую инфраструктуру. Пользователь привык к редиректу на страницу оплаты — это стандартный паттерн.

---

## 8. Защита от накрутки

### 8.1 Проблема

Игрок может вручную перейти на `starflow://payment/success?invoice_id=xxx` **без реальной оплаты** и получить энергию.

### 8.2 Решение

**Всегда проверять статус через сервер:**

```typescript
async function handlePaymentCallback(invoiceId: string) {
  const res = await fetch(`${API_BASE}/billing/check/${invoiceId}`);
  const data = await res.json();

  if (!data.is_paid) {
    showError("Оплата не найдена");
    return;
  }

  // Проверить, не выдавали ли уже эту энергию
  const fulfilledKey = `fulfilled_${invoiceId}`;
  if (localStorage.getItem(fulfilledKey)) {
    showError("Энергия уже начислена");
    return;
  }

  // Начислить энергию
  grantEnergy(state, energyAmount);
  localStorage.setItem(fulfilledKey, 'true');

  showSuccess("Энергия получена!");
}
```

**На сервере** — сохранять `device_id` в metadata и проверять при webhook:

```python
# При проверке: сравнить device_id с ожидаемым
# При webhook: записать факт успешной оплаты
```

---

## 9. Чеклист реализации

### Сервер (kreagenium.ru)
- [ ] Создать endpoint `/api/billing/create-starflow` с продуктами энергии
- [ ] Добавить `return_url` с deep link схемой в создание invoice
- [ ] Добавить `metadata` с `energy_amount` и `game: starflow`
- [ ] Добавить endpoint `/api/billing/products-starflow` (список пакетов)
- [ ] (Опционально) Webhook для подтверждения платежей

### Приложение
- [ ] Настроить deep link scheme `starflow://` в `capacitor.config.ts`
- [ ] Установить `@capacitor/browser`
- [ ] Добавить кнопку «Магазин энергии» в меню или HUD
- [ ] Реализовать fetch → Browser.open → deep link callback
- [ ] Реализовать проверку `is_paid` через сервер перед начислением
- [ ] Защита от повторного начисления (localStorage fulfilled_ keys)
- [ ] Сохранять покупку в save.ts для персистентности

### Android
- [ ] Проверить intent-filter для deep links в AndroidManifest.xml
- [ ] Протестировать полный цикл: покупка → оплата → возврат → начисление

---

## 10. Полезные ссылки

| Ресурс | URL |
|--------|-----|
| YooKassa Mobile SDK | https://yookassa.ru/developers/payment-acceptance/integration-scenarios/mobile-sdks/android-sdk |
| YooKassa API | https://yookassa.ru/developers/api |
| YooKassa GitHub SDK | https://github.com/yoomoney/yookassa-android-sdk |
| YooKassa return_url docs | https://github.com/yoomoney/yookassa-github-docs/blob/master/checkout-api/031-02%20return_url.md |
| Тарифы YooKassa | https://yookassa.ru/fees |
| Самозанятые + YooKassa | https://yookassa.ru/platezhi-dlya-samozanyatyh |
| @capacitor/browser | https://capacitorjs.com/docs/apis/browser |
| Capacitor Deep Links | https://capacitorjs.com/docs/apis/app |
| Capacitor InAppBrowser | https://capacitorjs.com/docs/apis/inappbrowser |
