# src/i18n

next-intl setup: `request.ts` picks the locale and loads its messages per request. Nothing else imports from here; components use `useTranslations`/`getTranslations` (`nextjs-app-structure` i18n rules).
