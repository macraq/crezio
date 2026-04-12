/**
 * Seed: fałszywi influencerzy + zgłoszenia do wskazanej kampanii (dev / QA).
 *
 * Wymaga: SUPABASE_SERVICE_ROLE_KEY oraz SUPABASE_URL lub PUBLIC_SUPABASE_URL (np. z .env w root repo).
 *
 * Przykład:
 *   pnpm --filter @influeapp/seed-influencers seed -- --campaign <uuid> --count 5
 *   pnpm --filter @influeapp/seed-influencers seed -- --campaign <uuid> --dry-run
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../.env') });

type ApplicationStatus =
  | 'applied'
  | 'selected'
  | 'preparation_for_shipping'
  | 'publication'
  | 'completed';

const CATEGORIES = ['beauty', 'tech', 'lifestyle', 'gaming', 'food', 'fitness'] as const;
const CITIES = ['Warszawa', 'Kraków', 'Gdańsk', 'Wrocław', 'Poznań', 'Łódź'] as const;

const DESCRIPTIONS = [
  'Tworzę treści o kosmetykach i pielęgnacji; współpracuję z markami beauty od 2021.',
  'Short-form video, tech i gadżety — publikuję na TikTok i Instagram.',
  'Lifestyle i podróże po Polsce; zaangażowanie społeczności ok. 4–6%.',
  'Gaming, streamy i recenzje sprzętu; publiczność głównie 18–34.',
  'Kulinaria i przepisy domowe; regularne stories i rolki.',
];

function usage(): never {
  console.error(`
Użycie:
  pnpm --filter @influeapp/seed-influencers seed -- --campaign <uuid> [opcje]

Opcje:
  --campaign <uuid>     ID kampanii (wymagane)
  --count <n>           Liczba influencerów (domyślnie 5)
  --email-prefix <s>    Prefiks e-maili przed losowym sufiksem (domyślnie: seed-inf)
  --password <s>        Hasło dla kont (domyślnie: zmienna SEED_INFLUENCER_PASSWORD lub SeedInfluencer123!)
  --application-status  Status zgłoszenia: applied | selected | ... (domyślnie: applied)
  --dry-run             Tylko wypisz plan, bez zapisu do bazy

Zmienne środowiskowe:
  SUPABASE_URL lub PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY (wymagany; to nie jest PUBLIC_SUPABASE_ANON_KEY — patrz wyjście polecenia supabase status)
  SEED_INFLUENCER_PASSWORD (opcjonalnie, domyślne hasło seed)
`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  let campaign: string | undefined;
  let count = 5;
  let emailPrefix = 'seed-inf';
  let password: string | undefined;
  let applicationStatus: ApplicationStatus = 'applied';
  let dryRun = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--campaign' && argv[i + 1]) {
      campaign = argv[++i];
    } else if (a === '--count' && argv[i + 1]) {
      count = Math.max(1, parseInt(argv[++i], 10) || 1);
    } else if (a === '--email-prefix' && argv[i + 1]) {
      emailPrefix = argv[++i];
    } else if (a === '--password' && argv[i + 1]) {
      password = argv[++i];
    } else if (a === '--application-status' && argv[i + 1]) {
      applicationStatus = argv[++i] as ApplicationStatus;
    } else if (a === '--dry-run') {
      dryRun = true;
    } else if (a === '--help' || a === '-h') {
      usage();
    }
  }

  if (!campaign) usage();

  const allowed: ApplicationStatus[] = [
    'applied',
    'selected',
    'preparation_for_shipping',
    'publication',
    'completed',
  ];
  if (!allowed.includes(applicationStatus)) {
    console.error(`Nieprawidłowy --application-status: ${applicationStatus}`);
    process.exit(1);
  }

  return {
    campaign,
    count,
    emailPrefix,
    password: password ?? process.env.SEED_INFLUENCER_PASSWORD ?? 'SeedInfluencer123!',
    applicationStatus,
    dryRun,
  };
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randRate(): number {
  return Math.round((0.005 + Math.random() * 0.07) * 10000) / 10000;
}

function getSupabaseAdmin(): SupabaseClient {
  const url = (process.env.SUPABASE_URL ?? process.env.PUBLIC_SUPABASE_URL)?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    if (url && !key) {
      console.error(
        'Brak SUPABASE_SERVICE_ROLE_KEY w .env.\n' +
          'Ten skrypt tworzy konta przez Admin API — potrzebny jest klucz service role (nie wystarczy PUBLIC_SUPABASE_ANON_KEY).\n' +
          'Lokalnie: uruchom `supabase status` i skopiuj wartość „service_role key” / „Secret” do:\n' +
          '  SUPABASE_SERVICE_ROLE_KEY=...',
      );
    } else {
      console.error(
        'Brak SUPABASE_URL lub PUBLIC_SUPABASE_URL albo SUPABASE_SERVICE_ROLE_KEY w .env (root repozytorium).',
      );
    }
    process.exit(1);
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function main() {
  const raw = process.argv.slice(2).filter((a) => a !== '--');
  const opts = parseArgs(raw);
  const admin = opts.dryRun ? null : getSupabaseAdmin();

  if (!opts.dryRun && admin) {
    const { data: camp, error: campErr } = await admin
      .from('campaigns')
      .select('id,name,status')
      .eq('id', opts.campaign)
      .maybeSingle();
    if (campErr) {
      console.error('Błąd odczytu kampanii:', campErr.message);
      process.exit(1);
    }
    if (!camp) {
      console.error(`Nie znaleziono kampanii o id: ${opts.campaign}`);
      process.exit(1);
    }
    console.log(`Kampania: ${(camp as { name: string }).name} (${(camp as { status: string }).status})`);
  } else {
    console.log(`[dry-run] Kampania: ${opts.campaign}`);
  }

  const created: { email: string; userId: string }[] = [];

  for (let i = 0; i < opts.count; i++) {
    const suffix = `${Date.now()}-${i}-${Math.random().toString(36).slice(2, 8)}`;
    const email = `${opts.emailPrefix}-${suffix}@influe.seed`;
    const category = pick(CATEGORIES);
    const location = pick(CITIES);
    const followers = randInt(3_000, 420_000);
    const engagement = randRate();
    const selfDescription = pick(DESCRIPTIONS);
    const completion = randInt(45, 98);

    if (opts.dryRun) {
      console.log(`[dry-run] ${email} | ${category} | ${location} | ${followers} followers | ER ${engagement}`);
      continue;
    }

    const { data: userData, error: createErr } = await admin!.auth.admin.createUser({
      email,
      password: opts.password,
      email_confirm: true,
      user_metadata: {
        account_type: 'influencer',
        terms_accepted_at: new Date().toISOString(),
        privacy_accepted_at: new Date().toISOString(),
        locale: 'pl',
      },
    });

    if (createErr || !userData.user) {
      console.error(`Tworzenie użytkownika ${email}:`, createErr?.message ?? 'brak user');
      continue;
    }

    const userId = userData.user.id;

    const { error: profErr } = await admin!.from('influencer_profiles').upsert(
      {
        profile_id: userId,
        category,
        location,
        followers_count: followers,
        engagement_rate: engagement,
        self_description: selfDescription,
        profile_completion_pct: completion,
        social_links: { instagram: `https://instagram.com/${email.split('@')[0]}` },
      },
      { onConflict: 'profile_id' },
    );

    if (profErr) {
      console.error(`influencer_profiles (${email}):`, profErr.message);
      await admin!.auth.admin.deleteUser(userId);
      continue;
    }

    const { error: appErr } = await admin!.from('campaign_applications').insert({
      campaign_id: opts.campaign,
      influencer_id: userId,
      status: opts.applicationStatus,
      pitch_text_at_submit: selfDescription,
    });

    if (appErr) {
      console.error(`campaign_applications (${email}):`, appErr.message);
      await admin!.auth.admin.deleteUser(userId);
      continue;
    }

    created.push({ email, userId });
    console.log(`OK ${email} → ${userId}`);
  }

  if (!opts.dryRun && created.length) {
    console.log(`\nUtworzono ${created.length} kont. Hasło logowania: (to co podano / domyślne seed)`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
