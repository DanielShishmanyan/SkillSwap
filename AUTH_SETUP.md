# Настройка на защитения вход

Входът с Google използва Firebase Authentication. Входът с парола и код използва Firebase Authentication, Cloud Functions и Resend. Изпращането на имейли изисква настройка и deployment на Cloud Functions.

## Вход с Google

1. В Firebase Console → Authentication → Sign-in method активирайте Google и запазете настройките.
2. В Authentication → Settings → Authorized domains добавете `skill-swap-eight-delta.vercel.app`.
3. Добавете настройките на Firebase Web приложението (`VITE_FIREBASE_*` от `.env.example`) във Vercel → Settings → Environment Variables → Production и направете Redeploy. Ключът за App Check е необходим за входа с имейл код.
4. Публикувайте обновените правила с `firebase deploy --project skillswap-ba92b --only firestore:rules,storage`, ако услугите са активирани в проекта.

Google сесията изисква потвърден имейл и изтича след 12 часа. Входът с парола продължава да изисква код от Resend.

## Как работи входът с имейл код

1. Клиентът изпраща имейл и парола към `startEmailAuth`. Паролата се проверява чрез Firebase, а новите акаунти се създават непотвърдени.
2. Сървърът изпраща криптографски генериран шестцифрен код. В Firestore остава само HMAC на кода, а не самият код или паролата.
3. `verifyEmailAuthCode` проверява кода и атомарно го отбелязва като използван. След проверката сървърът издава Firebase custom token с `email_otp` и `otp_verified_at`.
4. Firestore/Storage rules изискват тези claims и потвърден имейл. Обикновен Firebase вход с парола не дава достъп до защитените данни.

Кодът важи 10 минути от първата заявка. Има максимум 5 грешни опита, 60 секунди между изпращанията и максимум 3 повторни изпращания. Повторното изпращане сменя кода, без да нулира грешките или срока. Има допълнителни транзакционни лимити по IP, имейл и акаунт. Нов вход анулира предишния код за акаунта. Всяка callable функция изисква Firebase App Check.

Сесиите се пазят чрез `browserSessionPersistence`, не като собствен JSON в localStorage. Код се изисква при всеки нов вход с парола; презареждането на вече отворен таб запазва сесията. След 12 часа се изисква нов вход. Не задавайте `email_otp` като постоянен user custom claim чрез `setCustomUserClaims` — той трябва да принадлежи само на сесия, издадена след проверка на код.

## 1. Firebase

- Създайте Firebase проект и Web приложение; активирайте Email/Password Authentication и Firestore.
- За deployment на Cloud Functions е необходим [Blaze plan](https://firebase.google.com/docs/functions/get-started). Това е външна настройка с billing; не е включвана автоматично.
- В Authentication задайте политика с минимум 12 и максимум 128 знака за нови пароли и активирайте email enumeration protection. Използвайте собствен домейн в Authorized domains.
- Регистрирайте Web приложението в [App Check с reCAPTCHA v3](https://firebase.google.com/docs/ap p-check/web/recaptcha-provider). Добавете домейните на приложението. Секретният reCAPTCHA ключ е за Firebase Console; публичният site key е за клиента.
- Копирайте стойностите от `.env.example` в `.env.local`, включително `VITE_FIREBASE_APPCHECK_SITE_KEY`. Задайте `VITE_ENABLE_DEMO_AUTH=false`.
- За локална работа с реален backend задайте `VITE_FIREBASE_APPCHECK_DEBUG=true` в `.env.local` и попълнете `VITE_FIREBASE_APPCHECK_SITE_KEY`. Рестартирайте Vite, отворете приложението и регистрирайте debug токена от browser console във Firebase Console → App Check → Web app → Manage debug tokens. Debug режимът се включва само при development. Пазете токена извън Git. Не изключвайте `enforceAppCheck` в production.

## 2. Resend

- Създайте акаунт в [Resend](https://resend.com), потвърдете домейна за изпращане и създайте ключ с право за изпращане на имейли.
- Изберете адрес като `SkillSwap <auth@your-domain.com>` за `AUTH_EMAIL_FROM`.
- Не поставяйте `RESEND_API_KEY` или `OTP_HMAC_KEY` във VITE променливи: VITE стойностите са видими в браузъра.

## 3. Сървърни настройки и deployment

Използвайте Node.js 22 и Firebase CLI. Командите се изпълняват от основната папка `SkillSwap`, освен където е посочено друго.

```powershell
firebase login
firebase use --add
npm --prefix functions ci
firebase functions:secrets:set RESEND_API_KEY
firebase functions:secrets:set OTP_HMAC_KEY
```

За `OTP_HMAC_KEY` използвайте нова случайна стойност с поне 32 знака (например 64 hex знака от криптографски генератор). CLI ще поиска стойностите интерактивно. Не ги публикувайте в чат, код или Git.

Копирайте `functions/.env.example` в `functions/.env.<PROJECT_ID>` и задайте `FIREBASE_WEB_API_KEY` (публичния Firebase Web API key за същия проект) и `AUTH_EMAIL_FROM`. Ако Web API key е ограничен по HTTP referrer, използвайте отделен API key със същия проект и подходящи API ограничения за сървърния Identity Toolkit REST endpoint; не разхлабвайте ограниченията на браузърния ключ.

```powershell
firebase deploy --only functions:auth,firestore:rules,storage
npm run build
```

Функциите са в `europe-west1`; клиентът използва същия регион. Runtime service account трябва да има необходимото право за подписване на Firebase custom tokens (`iam.serviceAccounts.signBlob`). Следвайте [официалните инструкции за custom tokens](https://firebase.google.com/docs/auth/admin/create-custom-tokens), ако deployment средата не го предоставя.

Задайте TTL поле `deleteAfter` за колекциите `authChallenges`, `authChallengeOwners` и `authRateLimits`. TTL е за почистване; срокът на кода се проверява независимо и не зависи от навременното изтриване. Достъпът на клиентите до тези колекции е забранен от правилата.

Deployment на новите правила прекратява достъпа на старите password-only сесии. Потребителите трябва да влязат отново и да потвърдят имейл код.

## Локална демонстрация

За локален дизайн preview без Firebase може да използвате `VITE_ENABLE_DEMO_AUTH=true`. Този режим работи само с `npm run dev`, само без Firebase конфигурация и само със sample акаунта `mila@skillswap.dev` / `skillswap`. Той е ясно обозначен и **не изпраща имейли**. Production build отказва demo вход. Текущата `.env.local` е настроена за реалния проект `skillswap-ba92b` и demo режимът е изключен.

Старите browser-only акаунти не се мигрират като реални акаунти. При зареждане се изтриват старите `skillswap.accounts` и `skillswap.session` ключове, които съдържаха пароли/самодекларирани сесии. Други данни в localStorage не се изтриват. Реалните потребители трябва да се регистрират чрез конфигурирания backend.

## Проверки

```powershell
npm run lint
npm run build
npm --prefix functions run check
npm --prefix functions test
firebase emulators:exec --only auth,firestore,storage --project demo-skillswap-auth "node --test functions/test/rules.test.js functions/test/auth-flow.test.js"
```

Емулаторните тестове изискват Node.js 22, Java и Firebase CLI. Те не изпращат реални имейли и не използват production проект. Проверяват отказ на достъп без код, изтекли сесии, защита на кодовете, Storage достъп и запазване на session claims при refresh, без прехвърлянето им към password-only вход.

След настройка направете реален тест със свой имейл: регистрация → получен код → вход; изход → нов код → вход; грешен/стар код → отказ; повторно изпращане → старият код вече не работи.

Интеграционните тестове изпълняват сървърните обработчици с Firebase емулатори и симулиран Resend отговор. Покриват регистрация, вход, повторно изпращане, едновременна проверка на един код и отказ при неуспешна доставка. Реалната доставка и App Check конфигурацията трябва да се проверят след deployment.

Проверката на production зависимостите с `npm audit --omit=dev` не отчита известни уязвимости. Пълният audit на клиента все още отчита 7 предупреждения в инструментите за разработка на Tailwind 3 (braces/postcss-selector-parser); автоматичното предложено решение преминава към Tailwind 4 и изисква отделна миграция. Override за `@grpc/grpc-js` използва поправената версия вместо уязвимата зависимост на Firebase.

Останалият `AppStore` продължава да използва демонстрационни профили/сделки и локални данни. Тази промяна защитава Firebase автентикацията и достъпа до Firebase ресурси; не мигрира целия бизнес слой към Firestore.

API справки: [Firebase callable functions](https://firebase.google.com/docs/functions/callable), [Resend Send Email](https://resend.com/docs/api-reference/emails/send-email).
