# @weedtip/mobile (Flutter)

Single Flutter codebase → iOS + Android (+ web for fast iteration). Mirrors the web
consumer experience and shares the same Supabase backend + RPC contracts.

## Stack

- `supabase_flutter` — auth + data (same project as web; search via the
  `search_dispensaries` / `search_products` RPCs)
- `go_router` — navigation (bottom-nav `StatefulShellRoute`)
- `flutter_riverpod` — state management (providers in `lib/src/providers.dart`)
- `flutter_dotenv` — config from `assets/config.env`

## Structure

```
lib/
├── main.dart              # env + Supabase init, ProviderScope, MaterialApp.router
├── theme.dart             # brand theme (mirrors web Tailwind tokens)
└── src/
    ├── models.dart        # Dispensary / Product / Category (+ formatPrice/Distance)
    ├── supabase.dart      # client accessor
    ├── repository.dart    # data access (mirrors @weedtip/supabase queries)
    ├── providers.dart     # Riverpod providers
    ├── router.dart        # GoRouter + bottom-nav shell
    ├── widgets.dart       # DispensaryCard, ProductCard, RatingStars, async states
    └── screens/           # home, explore, dispensary, products, profile (+ inline auth)
```

Screens: **Home** (hero, categories, featured), **Explore** (search + open-now filter),
**Dispensary** (info, menu, reviews), **Products** (category filter), **Profile**
(sign in/up + sign out).

## Setup & run

```bash
cd apps/mobile
cp assets/config.env.example assets/config.env    # fill in Supabase URL + anon key
flutter pub get
flutter run                      # device/emulator (iOS/Android)
flutter run -d chrome            # fast web iteration against the local Supabase
```

> **Config gotcha:** the env asset is `assets/config.env` (NOT a dotfile) — Flutter's
> asset bundler silently skips leading-dot filenames, which breaks dotenv on web.

## Checks

```bash
flutter analyze   # static analysis (clean)
flutter test      # unit tests (model parsing + formatting)
flutter build web --no-tree-shake-icons   # compile a web bundle
```

> Platform folders (`web/` committed; `ios/`/`android/` generated via
> `flutter create --platforms=ios,android .`). The brand theme in `lib/theme.dart`
> mirrors the web Tailwind tokens — keep them in sync.
