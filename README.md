# Око Гора — Стратегічний OSINT Монітор

Незалежний ресурс з моніторингу, аеророзвідки та стратегічної аналітики бойового простору.

**Сайт:** [okogora.com.ua](https://okogora.com.ua)  
**Telegram:** [@oko_gora](https://t.me/oko_gora)

## Локальний запуск

**Вимоги:** Node.js 18+

1. Встановити залежності: `npm install`
2. Додати `GEMINI_API_KEY` у файл `.env.local`
3. Запустити: `npm run dev`

## Деплой

```bash
npm run build
```

Вміст папки `dist/` завантажити на хостинг або налаштувати GitHub Actions.

## Автосинхронізація Telegram -> posts.json

- Додано workflow: `.github/workflows/sync-telegram-posts.yml`
- Запуск:
  - вручну з GitHub Actions (`workflow_dispatch`)
  - автоматично кожні 30 хв (`schedule`)
  - з адмінки кнопкою `SYNC TG` (викликає `workflow_dispatch` через GitHub API)
- Джерело каналу за замовчуванням: `https://t.me/s/oko_gora`
- За потреби можна задати repo variables:
  - `TG_CHANNEL_URL`
  - `TG_MAX_POSTS`
