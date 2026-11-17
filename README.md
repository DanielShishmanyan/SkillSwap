# SkillSwap

SkillSwap is a peer-to-peer learning marketplace for exchanging skills or booking paid one-way lessons. The project is designed as a production-style diploma MVP with responsive workflows, typed domain logic, Firebase boundaries, and a realistic offline demo mode.

## Features

- Skill setup with teaching proficiency, delivery mode, and optional hourly rates
- Discover search and filters with realistic seeded profiles
- Weighted mutual-swap and paid-lesson recommendations
- Swap proposals with pending, accepted, completed, and cancelled states
- Paid lesson booking through a replaceable mock payment provider
- Conversation UI and Firestore real-time message service
- Profile editing, XP, levels, stats, and locked/unlocked achievements
- Firebase Authentication, Firestore, Storage configuration, and security rules
- Responsive layouts, accessible controls, empty states, loading affordances, and toast feedback

## Screenshots

Add final desktop and mobile captures here after deployment.

## Stack

React 19, TypeScript, Vite, Tailwind CSS, React Router, Firebase modular SDK, TanStack Query, React Hook Form, Zod, Lucide React, and Sonner.

## Architecture

```text
src/
  app/             routing, providers, application store
  components/      layout, UI primitives, users, transactions
  data/            deterministic development seed
  features/        auth, chat, users, matching, skills, payments, gamification
  firebase/        Firebase initialization
  pages/           routed product screens
  types/           shared domain contracts
```

UI components do not initialize Firebase. Firebase calls live in feature services. `AppStore` currently provides deterministic demo persistence for presentations; the matching algorithm and payment provider remain the same when feature hooks are switched to Firebase services.

## Firestore Model

- `users/{uid}` stores the public profile, aggregate stats, availability, and embedded `teaches` / `learns` arrays. Embedding keeps profile discovery reads predictable for this MVP.
- `skills/{skillId}` is the canonical read-only skill catalog.
- `swaps/{swapId}` and `lessons/{lessonId}` are top-level collections because both participants need direct queries.
- `reviews/{reviewId}` references author, recipient, and completed session.
- `conversations/{conversationId}` contains participant IDs and context.
- `conversations/{conversationId}/messages/{messageId}` stores ordered real-time messages.

Aggregate rating, XP, levels, and completion counters are protected from client profile updates. In production, update them in trusted Cloud Functions after a session or review transaction.

## Matching Algorithm

[`matching.algorithm.ts`](src/features/matches/matching.algorithm.ts) returns a `0-100` score using:

| Signal | Weight |
| --- | ---: |
| Mutual skill compatibility | 50% |
| Location compatibility | 15% |
| Availability overlap | 15% |
| Candidate rating | 10% |
| Relevant proficiency | 10% |

A candidate must teach at least one wanted skill. When they also want a skill the current user teaches, the result becomes a high-priority mutual swap; otherwise it is a paid-lesson opportunity.

## Firebase Setup

For Google sign-in and the separate password + email-code flow, follow [AUTH_SETUP.md](AUTH_SETUP.md). Registration and sign-in with a password require a server-verified code. Google sign-in uses a verified Firebase Google session.

1. Create a Firebase project and a web application.
2. Enable Email/Password Authentication.
3. Create Firestore in production mode and enable Storage.
4. Copy `.env.example` to `.env.local` and fill in the web app values.
5. Deploy `firestore.rules` and `storage.rules` with the Firebase CLI.

```bash
firebase deploy --only firestore:rules,storage
```

Local demo sign-in requires `VITE_ENABLE_DEMO_AUTH=true`, no Firebase configuration, and Vite development mode. Production builds fail closed when authentication is not configured. Demo registration is disabled and passwords are no longer stored in localStorage.

## Development

```bash
npm install
npm run dev
```

Production checks:

```bash
npm run lint
npm run build
npm run preview
```

## Payment Integration

`features/payments/payment.service.ts` defines a `PaymentProvider` interface. The current provider simulates confirmation and returns a mock transaction. A future Stripe implementation can replace it without changing booking UI or lesson domain types. Secure production payment confirmation must be performed server-side with a webhook or trusted function.
