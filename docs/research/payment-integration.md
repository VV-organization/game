# Arco Pay integration in FApix Racing

Verified from local source on 6 November 2026. No real payment was created; no neighbouring credentials, environment files or production records were read or copied.

## Contract and source distinction

The user selected **Arco Pay**. The implementation follows the merchant protocol currently used by Shardsmarket and OnyxShop. The current local Shardsmarket integration is branded **Arco Pay / Clickit** and uses `https://api.clickit.team/api/v1` with the hosted form at `https://payment.paidlayer.com`. This is different from the newer unrelated `api.arcpay.space/v1` protocol. Domains are configurable; no merchant identity is inherited from another shop.

Read-only source evidence:

- `/Users/anton/Finext/shardsmarket/backend/src/modules/providers/arco-pay/arco-pay.client.ts`: create/status request envelopes, headers, amount units, shop validation, hosted CARD URL.
- `/Users/anton/Finext/shardsmarket/backend/src/modules/providers/arco-pay/arco-pay-webhook-signature.ts`: RSA-SHA1 signature over the original request bytes.
- `/Users/anton/Finext/shardsmarket/docs/operations/arco-pay.md`: current merchant protocol, authoritative statuses and required CARD form POST handoff.
- `/Users/anton/Finext/onyxshop/backend/src/services/topUpService.ts` and `backend/src/arcopay/{client,types}.ts`: IPS creation, QR registration and NSPK URL restrictions.

These are current code contracts, not proof of provider availability or merchant readiness. This project's own active credentials and permitted payment methods have not been verified.

## Implemented requests

All provider requests use POST, JSON, Bearer token, `x-api-key` and `x-req-id`. Redirect following is forbidden; timeout is 10 seconds; responses are bounded to 1 MiB. Client responses never expose provider messages or credentials.

### Card

`POST /payments/create` sends:

- `MerchantOrderId`: persistent local top-up UUID; the same UUID is `x-req-id`.
- `Amount`: rubles × 100, integer kopeks. Currency is RUB.
- `Type: PayIn`, `PaymentTypes: [CARD]`, `IsForm: true`, `LifeTime: 900`.
- `CallbackUrl`: own PUBLIC_URL + `/api/payments/arco/callback`.
- Both return URLs: own PUBLIC_URL + `/?payment=<local UUID>`.

The returned order must match shop, merchant order, amount, currency and method when supplied. The hosted URL is constructed from the validated OrderId and configured hosted origin.

The browser should navigate to the CARD hosted form by HTML form **POST**, with `successUrl` and `failUrl` fields set to the current FApix payment return URL. Shardsmarket records stale provider-localStorage redirects when ordinary GET navigation is used. The payment return query is a lookup key, never proof of settlement.

### SBP

Create uses `PaymentTypes: [IPS]` and `IsForm: false`. The verified provider OrderId is persisted **before** requesting the QR.

`POST /payments/ips/qrcData` sends `OrderId`, `QrcType: 02`, `TemplateVersion: 01`, `QrTtl: 15`. The returned order is checked again. Only an HTTPS `qr.nspk.ru` URL with no custom port, credentials or fragment is accepted. The browser follows this URL by GET. A saved OrderId permits retrying QR generation without creating a second provider order.

### Status and callbacks

`POST /payments/status` sends saved `OrderId`. Before any credit, the server checks provider OrderId, configured ShopId, RUB currency, exact kopeks/rubles, local MerchantOrderId, method when supplied and persisted provider configuration identity.

Only **CHARGED** (CARD) and **IPS_ACCEPTED** (IPS) credit Fapix. CREATED, AUTHORIZED, QRCDATA_CREATED and intermediate statuses do not. DECLINED, CHARGE_DECLINED, VOIDED and EXPIRED display failure. Unknown or refund-related states do not create new credit.

Callback `Payment-Sign` is verified as canonical base64 RSA-SHA1 over raw request bytes with this project's public key. A valid callback only triggers a fresh provider status request. It cannot directly credit from body fields. A signed early callback can recover the provider ID after an ambiguous CREATE response, but cannot overwrite an existing different binding.

The browser may poll an owned payment; the server also reconciles saved unresolved provider IDs every 30 seconds. Positive settlement is final and exactly one ledger credit is allowed. A later authoritative success may correct an earlier failure.

## Local wallet and access rules

- Fresh accounts start with zero Fapix. No client race-result endpoint grants money.
- SQLite stores users, scrypt password hashes, hashed session tokens, purchases, ownership, top-ups and a unique-reference ledger.
- Every credit and purchase is a transaction. Duplicate provider delivery and duplicate client purchase keys cannot duplicate balances or ownership.
- Financial history belongs to the account. A guest may pay for a named account, but receives no private user, balance, inventory or session for that recipient.
- Top-up resume is permitted only to the creating browser/account or recipient account. Unrelated sessions receive 404.
- Authenticated top-up idempotency is bound to the account, including parallel first requests. Guest idempotency is bound to the HttpOnly visitor cookie initialised by `GET /api/session`; the frontend must obtain that session before creating a guest payment. A guest POST without an established cookie returns 409 VISITOR_REQUIRED and a cookie, without inserting any payment. Two concurrent first requests therefore cannot create duplicate orders.
- Login is case-insensitive, 3–24 ASCII letters/digits/underscores. Passwords are 8–128 characters.
- Session cookies are HttpOnly, SameSite=Lax, Secure when NODE_ENV=production. JSON mutation requests enforce same-origin checks. Auth/mutation requests are rate limited.
- Top-ups accept **whole rubles from 1 to 100,000**. Every product price and balance uses integer Fapix. This is an explicit implementation policy because VV-136 does not define fractional rubles.
- Bundles have a fixed displayed price. Existing component ownership is preserved; components are not duplicated. An entirely owned bundle cannot be purchased.

## Configuration

Default: `PAYMENT_MODE=disabled`. Missing or invalid real-provider configuration also results in disabled mode; it never silently falls back to sandbox.

For local demonstration only: `PAYMENT_MODE=sandbox`. No bank is contacted. The UI must label this mode; funding is through the explicit sandbox success/failure action. By default it uses `data/fapix-sandbox.sqlite`. The database itself records sandbox/live identity and refuses to reopen a sandbox wallet as a real one.

For real payments:

| Variable | Meaning |
| --- | --- |
| PAYMENT_MODE | arco |
| PUBLIC_URL | This project's public HTTPS origin, no path/query |
| ARCO_PAY_SHOP_ID | This project's merchant shop ID |
| ARCO_PAY_API_KEY | This project's API key |
| ARCO_PAY_BEARER_TOKEN | This project's bearer token |
| ARCO_PAY_PUBLIC_KEY | Provider callback public key, PEM; escaped newlines accepted |
| ARCO_PAY_API_URL | Optional; default current merchant API above |
| ARCO_PAY_PAYMENT_ORIGIN | Optional; default current hosted origin above |
| DATABASE_PATH | Optional persistent SQLite file; live default data/fapix.sqlite |
| NODE_ENV | production for HTTPS deployment and secure cookies |
| HOST / PORT | Bind settings; default 127.0.0.1:3001 |

The process loads an optional local `.env` via Node's built-in loader. `.env.example` contains no credentials. In production use a persistent disk, a TLS reverse proxy and backups appropriate to the wallet database.

## Remaining deployment and provider work

1. Supply and verify this project's own merchant configuration, allowed CARD/IPS channels and public callback endpoint.
2. Validate actual hosted CARD handoff, SBP QR registration, callback signature, successful settlement and exactly-once credit with the intended provider environment. Local mock tests do not establish these.
3. If CREATE returns an ambiguous transport result before any OrderId is available, persist `review_reason=create_unconfirmed`. The API returns 202 with the existing local ID, `status=pending`, `requiresReview=true` and a user-facing explanation; retries and GET preserve this state. The API does not repeat CREATE. A signed callback followed by independent status verification can bind the provider ID, restore the existing checkout or settle the original payment. Without a callback it requires merchant-side investigation; no unsupported lookup-by-merchant endpoint is invented. A known order with temporarily unavailable checkout is marked `checkout_unavailable` and can recover without creating another provider order.
4. Refund processing, chargeback handling, receipts/fiscal integration, account recovery and operational admin tooling are outside VV-136's specified API and are not implemented.
5. SQLite is intended for one application instance on a persistent local filesystem. Multi-instance deployment requires a shared transactional database and coordinated reconciliation.

## Verification performed

Vitest covers authoritative versus intermediate provider states, invalid shops/currency/IDs/amounts, tampered signatures, QR flow ordering, disabled configuration, account/session isolation, duplicate credit, concurrent idempotency, insufficient balance, duplicate ownership, equip authorization, private history, payment resume, persistence after restart and sandbox/live database separation. Full suite and TypeScript check passed after implementation. No production API request or bank charge was attempted.
