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
| `buy_qris_{id}` | `buy_qris_` | handleBuyWithQris |
| `buy_balance_{id}` | `buy_balance_` | handleBuyWithBalance |
| `buy_manual_{id}` | `buy_manual_` | handleManualQrisPanel (sets manualQrisState) |
| `vps` | exact | handleVpsList |
| `vps_{id}` | `vps_{digit}` | handleVpsDetail |
| `vps_buy_{id}` | `vps_buy_` | handleVpsBuyInit (sets password input state) |
| `vps_buy_qris_{invoice}` | `vps_buy_qris_` | handleVpsBuyWithQris |
| `vps_buy_balance_{invoice}` | `vps_buy_balance_` | handleVpsBuyWithBalance |
| `vps_buy_manual_{id}` | `vps_buy_manual_` | handleManualQrisVps (sets manualQrisState) |
| `vps_check_{invoice}` | `vps_check_` | handleVpsCheckPayment |
| `profile` | exact | handleProfile |
| `history_{page}` | `history_` | handleHistory |
| `topup` | exact | handleTopupInit (sets topup_amount state) |
| `topup_check_{invoice}` | `topup_check_` | handleTopupCheckPayment |
| `/admin` command | exact | send admin menu (new message) |
| `admin` | exact | handleAdminMenu |
| `admin_stats` | exact | handleAdminStats |
| `admin_products_{page}` | `admin_products_` | handleAdminProducts |
| `admin_product_add` | exact | handleAdminProductAdd (panel) |
| `admin_vps_add` | exact | handleAdminVpsAdd |
| `admin_users_{page}` | `admin_users_` | handleAdminUsers |
| `admin_user_view_{id}` | `admin_user_view_` | show user detail + actions |
| `admin_user_ban_{id}` | `admin_user_ban_` | ban |
| `admin_user_unban_{id}` | `admin_user_unban_` | unban |
| `admin_user_addbal_{id}` | `admin_user_addbal_` | add balance (sets input state) |
| `admin_user_subbal_{id}` | `admin_user_subbal_` | sub balance (sets input state) |
| `admin_user_search` | exact | search (sets input state) |
| `admin_broadcast` | exact | handleBroadcastInit (sets broadcast_content state) |
| `admin_broadcast_cancel` | exact | cancel broadcast → back to admin |
| `admin_broadcast_confirm_yes` | exact | handleBroadcastStart (reads content from adminInputState) |
| `admin_transactions_{page}` | `admin_transactions_` | transaction list |
| `admin_manual_payments_{page}` | `admin_manual_payments_` | handleAdminManualPayments (list pending) |
| `admin_manual_confirm_{txId}` | `admin_manual_confirm_` | handleAdminManualConfirm |
| `admin_manual_reject_{txId}` | `admin_manual_reject_` | handleAdminManualReject |

### Admin text input quirk

Admin actions requiring text input (add product, add/sub balance, search user, broadcast, topup) use an in-memory `Map` (`adminInputState`). The map key is `` `${chatId}_${telegramId}` ``. State is set in the callback handler and consumed in the `message` event handler. Always delete the state after consuming.

Additional state maps:
- `vpsInputState`: stores VPS password requests (`vps_password` action)
- `manualQrisState`: stores manual QRIS photo upload requests (`manual_qris_photo` action)

The `message` handler checks both `adminInputState` and `manualQrisState`, deleting from whichever map the state was found.

Broadcast uses `copyMessage` API — any message the admin sends (text, photo, video, document, sticker, etc) is copied verbatim to all users. State flow: `broadcast_content` → `broadcast_confirm` (stores `fromChatId` + `msgId` for callback consumption).

Non-text messages are allowed for `broadcast_content` and `manual_qris_photo` states.

## Payment flow

1. User can choose payment method: QRIS (Pakasir), Balance (saldo), or Manual QRIS (upload proof)
2. **QRIS**: User clicks QRIS → transaction created (`status: pending`) → Pakasir `createPayment('qris', ...)` → QR code image sent directly to chat → `check_*` callback polls real status
3. **Balance**: User clicks Bayar dengan Saldo → checks sufficient balance → deducts → transaction created as `paid` → creates server immediately
4. **Manual QRIS**: User clicks Manual QRIS → uploads proof photo → forwarded to admin with confirm/reject buttons → admin clicks confirm → transaction `paid` → creates server
5. Pakasir SDK config: `PAKASIR_SLUG` + `PAKASIR_APIKEY` in `.env`
6. QR generation uses `qrcode` npm package — generates PNG buffer from `payment_url`
7. **Top-up**: User clicks Top Up → enters amount → QRIS payment created → `topup_check_*` callback → on `completed` adds to user balance

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
