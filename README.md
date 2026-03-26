# crezio.app – Influencer Marketing Platform (MVP)

Monorepo: panel influencera (web), panel marki (partner), wspólne pakiety UI/lib/hooks, Supabase (PostgreSQL + Auth + Realtime + Functions).

## Wymagania

- **Node.js** ≥ 20 (zalecane: `nvm use` lub `.nvmrc`)
- **pnpm** 9.x (`npm i -g pnpm@9`)
- **Supabase CLI** (opcjonalnie, do lokalnej bazy): [instalacja](https://supabase.com/docs/guides/cli)

## Szybki start (setup deweloperski)

### 1. Instalacja zależności

```bash
pnpm install
```

### 2. Zmienne środowiskowe

Skopiuj szablon i uzupełnij (dla lokalnego Supabase uruchom w kroku 3 `supabase status` i wklej URL + anon key):

```bash
cp .env.example .env
# Edytuj .env – PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY
```

Aplikacje czytają `PUBLIC_SUPABASE_*` z `.env` w katalogu głównym (Vite/Astro).

### 3. Baza danych (Supabase)

**Opcja A – Supabase w chmurze**

- Załóż projekt na [supabase.com](https://supabase.com).
- W Dashboard: Project Settings → API: skopiuj **Project URL** i **anon public** key do `.env`.
- W SQL Editor uruchom migracje z `supabase/migrations/` w kolejności (albo użyj Supabase CLI: `supabase db push` po podłączeniu linku).

**Opcja B – Supabase lokalnie (Docker)**

```bash
supabase start
supabase status   # URL + anon key do .env
supabase db reset # stosuje migracje z supabase/migrations/
```

### 4. Uruchomienie aplikacji

```bash
# Wszystkie aplikacje (web + partner) w trybie dev
pnpm dev
```

- **Panel influencera (web):** http://localhost:4321  
- **Panel marki (partner):** http://localhost:4322  

Pojedyncze appy:

```bash
pnpm --filter @influeapp/web dev
pnpm --filter @influeapp/partner dev
```

### 5. Build i preview

```bash
pnpm build
# Preview zbudowanych appów (np. astro preview w każdym appie)
pnpm --filter @influeapp/web preview
pnpm --filter @influeapp/partner preview
```

## Struktura monorepo

| Ścieżka | Opis |
|--------|------|
| `apps/web` | Astro – panel influencera + landing (port 4321) |
| `apps/partner` | Astro – panel marki / partnera (port 4322) |
| `packages/ui` | Wspólne komponenty React (Tailwind/DaisyUI) |
| `packages/lib` | Typy TS, helpery, klient Supabase |
| `packages/hooks` | Custom hooks React (auth, Supabase) |
| `supabase/` | Config, migracje DB, Edge Functions |

## Skrypty (root)

| Komenda | Działanie |
|---------|-----------|
| `pnpm dev` | Uruchamia `dev` we wszystkich appach (Turborepo) |
| `pnpm build` | Build wszystkich appów i pakietów |
| `pnpm lint` | Lint w całym monorepo |
| `pnpm format` | Formatowanie Prettier |
| `pnpm typecheck` | Sprawdzenie typów TS |
| `pnpm db:reset` | Lokalnie: `supabase db reset` |
| `pnpm db:push` | Wypchnięcie migracji do zdalnej bazy |

## Dokumentacja produktowa i techniczna

- **PRD:** [.ai/prd.md](.ai/prd.md)
- **Stack:** [.ai/tech-stack.md](.ai/tech-stack.md)
- **Schemat DB:** [.ai/work/003_schema.sql](.ai/work/003_schema.sql), [.ai/work/004_rls.sql](.ai/work/004_rls.sql)  
  Wdrożone w: `supabase/migrations/`.

## Testy (do rozbudowy)

- **Unit:** Vitest w pakietach/appach (`pnpm test`).
- **E2E:** Playwright – konfiguracja w kolejnych iteracjach.

## Hosting

- Frontend (Astro): Vercel lub Netlify. Domyślnie build jest `output: 'static'`; dla SSR w produkcji dodaj adapter (`@astrojs/vercel` lub `@astrojs/node`) i ustaw `output: 'server'` w `astro.config.mjs`.
- Backend: Supabase (hosted).
- CI/CD: GitHub Actions + pipeline Vercel/Netlify.
