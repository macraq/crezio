# OAuth – połączenia z Instagram, YouTube, TikTok

Edge Functions `oauth-start` i `oauth-callback` realizują flow OAuth 2.0, żeby zapisać tokeny dostępu do API social media (później: statystyki, zasięgi kampanii).

## Flow

1. Użytkownik na stronie **Ustawienia** klika „Połącz” przy danej platformie.
2. Frontend wysyła `POST /functions/v1/oauth-start` z `Authorization: Bearer <session>` i `{ "provider": "youtube" }`.
3. Edge Function tworzy wpis w `oauth_states`, zwraca `redirect_url` do providera.
4. Przeglądarka przekierowuje użytkownika na stronę logowania providera.
5. Po autoryzacji provider przekierowuje na `GET /functions/v1/oauth-callback?code=...&state=...`.
6. Edge Function (z `SUPABASE_SERVICE_ROLE_KEY`) wymienia `code` na tokeny, zapisuje w `social_oauth_connections`, przekierowuje na `APP_URL/settings?oauth_connected=...`.

## Zmienne środowiskowe (Secrets)

Ustaw w Supabase: **Dashboard → Project Settings → Edge Functions → Secrets** (lub `supabase secrets set`).

| Secret | Opis |
|--------|------|
| `APP_URL` | URL aplikacji (redirect po OAuth), np. `https://twoja-domena.com` lub `http://localhost:4321` |
| `YOUTUBE_CLIENT_ID` | Client ID z Google Cloud Console (YouTube Data API v3) |
| `YOUTUBE_CLIENT_SECRET` | Client secret |
| `INSTAGRAM_CLIENT_ID` | App ID z Meta for Developers (Facebook Login dla Instagram Graph API) |
| `INSTAGRAM_CLIENT_SECRET` | App Secret |
| `TIKTOK_CLIENT_KEY` | Client Key z TikTok for Developers (Login Kit) |
| `TIKTOK_CLIENT_SECRET` | Client Secret |
| `FACEBOOK_CLIENT_ID` | App ID z Meta for Developers (Facebook Login) |
| `FACEBOOK_CLIENT_SECRET` | App Secret |
| `TWITCH_CLIENT_ID` | Client ID z Twitch Developer Console |
| `TWITCH_CLIENT_SECRET` | Client Secret |
| `X_CLIENT_ID` | Client ID (API Key) z X Developer Portal |
| `X_CLIENT_SECRET` | Client Secret (API Key Secret) |

Dostarczane automatycznie przez Supabase: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

## Konfiguracja u providerów

### YouTube (Google Cloud Console)

1. Utwórz projekt, włącz **YouTube Data API v3**.
2. Credentials → Create OAuth 2.0 Client ID (typ: Web application).
3. **Authorized redirect URIs**: `https://<PROJECT_REF>.supabase.co/functions/v1/oauth-callback`
4. Skopiuj Client ID i Client Secret do Secrets.

### Instagram (Meta for Developers)

1. Aplikacja typu „Consumer” lub „Business”, dodaj produkt **Facebook Login**.
2. Facebook Login → Settings: **Valid OAuth Redirect URIs**: `https://<PROJECT_REF>.supabase.co/functions/v1/oauth-callback`
3. W App Review poproś o uprawnienia: `instagram_basic`, `instagram_manage_insights`.
4. Skopiuj App ID i App Secret do Secrets (`INSTAGRAM_CLIENT_ID`, `INSTAGRAM_CLIENT_SECRET`).

### TikTok (TikTok for Developers)

1. Utwórz aplikację Login Kit (Web).
2. Redirect URI: `https://<PROJECT_REF>.supabase.co/functions/v1/oauth-callback`
3. W aplikacji włącz scope: `user.info.basic`, `user.info.stats`.
4. Skopiuj Client Key i Client Secret do Secrets (`TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`).

### Facebook (Meta for Developers)

1. Ta sama aplikacja co dla Instagrama lub osobna. Dodaj produkt **Facebook Login**.
2. Facebook Login → Settings: **Valid OAuth Redirect URIs**: `https://<PROJECT_REF>.supabase.co/functions/v1/oauth-callback`
3. Używane scope: `public_profile`, `pages_show_list`, `pages_read_engagement` (do statystyk stron).
4. Skopiuj App ID i App Secret do Secrets (`FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET`). Możesz użyć tych samych co dla Instagrama, jeśli to jedna aplikacja Meta.

### Twitch (Twitch Developer Console)

1. [dev.twitch.tv](https://dev.twitch.tv/console) → Twitch Applications → Create Application (lub istniejąca).
2. **OAuth Redirect URLs**: `https://<PROJECT_REF>.supabase.co/functions/v1/oauth-callback`
3. Używane scope: `user:read:email`, `user:read:broadcast`, `channel:read:analytics` (profil, kanał, analityka).
4. Skopiuj Client ID i Client Secret do Secrets (`TWITCH_CLIENT_ID`, `TWITCH_CLIENT_SECRET`).

### X (Twitter) – Developer Portal

1. [developer.x.com](https://developer.x.com) → Projects & Apps → wybierz aplikację (lub utwórz).
2. **User authentication settings** → **Set up** → OAuth 2.0, typ: Web App.
3. **Callback URI / Redirect URL**: `https://<PROJECT_REF>.supabase.co/functions/v1/oauth-callback`
4. Scope: `tweet.read`, `users.read`, `offline.access` (refresh token). X używa OAuth 2.0 z **PKCE** (obsłużone w Edge Functions).
5. Skopiuj Client ID i Client Secret (w portalu: API Key i API Key Secret) do Secrets (`X_CLIENT_ID`, `X_CLIENT_SECRET`).

## Użycie tokenów (później)

Tokeny są w tabeli `social_oauth_connections` (dostęp tylko dla danego użytkownika przez RLS). Do pobierania statystyk w kampaniach:

- **YouTube**: `GET https://www.googleapis.com/youtube/v3/channels?part=statistics` z `Authorization: Bearer <access_token>`.
- **Instagram**: Instagram Graph API, np. `GET /{ig-user-id}/insights` (wymaga konta biznesowego powiązanego z Fan Page).
- **TikTok**: User Info API z scope `user.info.stats`.
- **Facebook**: Graph API (np. `/me`, `/me/accounts` dla stron, insights).
- **Twitch**: Helix API (np. `GET /helix/users`, `GET /helix/analytics` dla statystyk kanału).
- **X (Twitter)**: Twitter API v2 (np. `GET /2/users/me`, `GET /2/users/:id`, posty, metryki).

Przed wywołaniem API sprawdź `expires_at` i w razie potrzeby odśwież token (`refresh_token`).
