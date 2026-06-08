# AGENTS.md

## Run

```bash
npm start          # production
npm run dev        # with --watch (Node 18+)
```

## Architecture

Entry: `src/bot.js` — initializes bot, syncs DB (`alter: true`), registers `/start` and the callback router.

### Callback routing (single source of truth)

All callback_data strings are routed in `bot.js` switch + `handleCallbackData()`. Conventions:

| Prefix | Pattern | Handler |
|--------|---------|---------|
| `home` | exact | handleHome |
| `help` | exact | handleHelp |
| `products` | exact | handleProductList |
| `product_{id}` | `product_` | handleProductDetail |
| `buy_{id}` | `buy_` | handleBuy |
| `check_{invoice}` | `check_` | handleCheckPayment |
| `profile` | exact | handleProfile |
| `history_{page}` | `history_` | handleHistory |
| `/admin` command | exact | send admin menu (new message) |
| `admin` | exact | handleAdminMenu |
| `admin_stats` | exact | handleAdminStats |
| `admin_products_{page}` | `admin_products_` | handleAdminProducts |
| `admin_product_add` | exact | handleAdminProductAdd |
| `admin_users_{page}` | `admin_users_` | handleAdminUsers |
| `admin_user_view_{id}` | `admin_user_view_` | show user detail + actions |
| `admin_user_ban_{id}` | `admin_user_ban_` | ban |
| `admin_user_unban_{id}` | `admin_user_unban_` | unban |
| `admin_user_addbal_{id}` | `admin_user_addbal_` | add balance (sets input state) |
| `admin_user_subbal_{id}` | `admin_user_subbal_` | sub balance (sets input state) |
| `admin_user_search` | exact | search (sets input state) |
| `admin_transactions_{page}` | `admin_transactions_` | transaction list |

### Admin text input quirk

Admin actions requiring text input (add product, add/sub balance, search user) use an in-memory `Map` (`adminInputState`). The map key is `` `${chatId}_${telegramId}` ``. State is set in the callback handler and consumed in the `message` event handler. Always delete the state after consuming.

## Payment flow

1. User clicks `buy_{id}` → transaction created (`status: pending`) → Pakasir `createPayment('qris', ...)` → QR code image sent directly to chat
2. `check_{invoice}` callback checks real status via Pakasir `detailPayment()`
3. If `completed`: create Pterodactyl user → create server → update transaction → send credentials
4. Pakasir SDK config: `PAKASIR_SLUG` + `PAKASIR_APIKEY` in `.env`
5. QR generation uses `qrcode` npm package — generates PNG buffer from `payment_url`

## Pterodactyl API docs

Full reference at `pterodactyl-api-docs/`. Key implementation details in `services/pterodactylService.js`:

- **Create user**: requires `last_name` (set to `"Panel"`), `language`
- **Create server**: uses `deploy.locations` (auto-assign allocation) unless `DEFAULT_ALLOCATION_ID` is set — matches Pterodactyl API contract exactly
- **Delete server**: passes `force: true` query param
- **Auth header**: `Authorization: Bearer ptla_...` + `Accept: Application/vnd.pterodactyl.v1+json` (set in `config/pterodactyl.js`)
- **Env vars**: `PTERODACTYL_PTLA` (App API key, starts `ptla_`), `PTERODACTYL_PTLC` (Client API key, starts `ptlc_`)

## Env

Copy `.env.example` → `.env`. Required vars: `BOT_TOKEN`, `ADMIN_ID`, `PTERODACTYL_*`, `TRIPAY_*`.

## DB

SQLite via Sequelize. `alter: true` on boot — will add columns but won't drop them. Running `alter: true` every boot is intentional for dev speed.

Models: `User`, `Product`, `Transaction`, `Config` — associations in `models/index.js`.

## Key dirs

| Dir | Responsibility |
|-----|---------------|
| `handlers/` | callback/command logic, calls services |
| `services/` | business logic (user CRUD, Pterodactyl API, Tripay API) |
| `keyboards/` | inline keyboard builders (no reply keyboards anywhere) |
| `utils/` | formatter, logger, helper |

## Style rules

- All menu navigation via `editMessageText` + inline keyboards — never `sendMessage` for navigation, never `ReplyKeyboardMarkup`.
- Callback validation: admin-only callbacks check `isAdmin(telegramId)` against `ADMIN_ID`.
- Every menu has a back button.
- Error handling: `try/catch` in every handler, logged via `logger`.
- Invoices: format `INV/YYMMDD/RANDOM`.
- Password generation: 12 chars with special chars.
