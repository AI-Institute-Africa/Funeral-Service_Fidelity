# Development notes

How the Fidelity Funeral Services application is built. For supported production workflows and setup requirements, see the [README](../../README.md).

```bash
npm run dev      # start the dev server
npm run build    # type-check and build
npm run lint     # oxlint
npm test         # vitest (unit tests)
```

## API modes

The application defaults to `VITE_API_MODE=live` and talks to the API in [`openapi.yaml`](openapi.yaml). `npm run mock-api` remains an explicit local test utility only; never use mock mode or seeded identities for real customer data.

Feature layout: `features/auth` is the session (types, API calls, route guard, hooks), `features/account` is the customer's policy and requests, `features/memorials` is the public memorial pages and the owner's editor, and `features/marketplace` is the shop, basket, checkout and orders, and `features/admin` is the staff portal. Other features import each other only through their `index.ts` (for example `@/features/auth`).

### Marketplace and orders

- **Server-authoritative prices.** The browser sends choices (item, options, quantity, wording), never prices. `pricing.ts` is the one place prices are worked out; the basket and checkout use it for a preview, and the server (or the mock) recomputes the real total when the order is placed.
- **Shared, pure logic.** `pricing.ts`, `validation.ts`, `order-flow.ts` and `seed` data import only relative `.ts` files, so `scripts/mock-api.mjs` loads them straight from `src/` under Node and the browser mock and the reference server cannot drift apart.
- **Order lifecycle.** `order-flow.ts` moves an order from `awaiting_payment` to `paid`, `confirmed`, `in_progress` and `delivered`, or to `payment_failed` and back. Time is passed in, so it is easy to test. The page polls an order while its payment is pending or it is in progress.
- **Mock payments.** In mock mode any 077 or 078 EcoCash number is approved after a few seconds, `078 000 0000` is always declined, and Paynow shows a stand-in for its hosted page. A real integration needs gateway credentials, signed webhooks and idempotency keys (see `backend-integration.md`).
- **Basket.** `cart.ts` is a small external store backed by `localStorage`, read through `useSyncExternalStore`, so the header button, the drawer and product pages share it without a provider.


### Staff portal

- **Three kinds of people, one shell.** `AppShell` is the frame for every signed-in area; `AccountLayout` and `PortalLayout` only choose its navigation. The portal's navigation (`portalNav` in `config/site.ts`) depends on the role.
- **Funeral operations workspace.** The original extended operations workspace is local-only and is not the production system of record. Do not use it to create customer cases, record payments or determine policy eligibility. Production case registration and assignment use `/funeral-support`, `/account/funeral-cases`, `/provider-portal/funeral-cases`, and the authenticated case API.
- **Client funeral intake.** `/funeral-support` requires a signed-in customer and submits policy-covered case reports or walk-in coverage consultations to the server. Policy details are returned only when the account phone matches the policy phone; authorized relatives may submit a policy number and deceased name for server-side verification without receiving policyholder data. Case coverage remains subject to Fidelity review.
- **WhatsApp funeral coordination groups.** A reporter must explicitly consent before group creation. The bridge creates one group per case using an idempotent database claim and uses the case reference in the group subject for recovery after a process restart. The signed-in reporter is added first; the assigned Fidelity coordinator is added when assigned. Additional relatives are included only after the reporter confirms their consent. Group creation failures are stored, exposed to the admin case queue and retried after the WhatsApp session reconnects or by an administrator. The gateway must be paired and running, alerts and WhatsApp sending must be enabled, and a dedicated Fidelity-owned number must be used. Baileys is unofficial and requires an explicit compliance decision before any production deployment.
- **Policy import.** In live mode, the administrator portal's `/provider-portal/policies/import` page uses cookie-authenticated policy endpoints to download templates, preview XLSX validation results, and confirm a staged merge by policy number. It accepts `policy-per-row` (with `covered_members` formatted as `Name|Relationship|Share;...`) or `member-per-row`; previews expire after 30 minutes. The API limits files to 8 MB, validates before staging, records the importing administrator, and clears staged policy data after commit. Sign-in requires backend SMS configuration and a strong session signing secret. Public sign-up creates customer accounts only; create the initial administrator with the guarded `npm run admin:provision` script after migrations are deployed. Customer policy lookup is restricted to matching account/policy phones; authorized relatives may submit a policy number and covered person through case intake for staff review without seeing policy details.
- **Kuwana token charge settings.** The operations workspace includes a disabled-by-default charge table for exhumations, WhatsApp alerts, support, maps, flowers, biography/music/video generation and recording replay. Amounts are unset and the table is only local demo configuration; it does not connect to a Kuwana balance or debit service. A production integration requires Kuwana's API contract, sandbox, approved feature prices and debit/refund/reconciliation rules. Never trust a browser-side price or balance for a real charge.
- **Maps, messaging and recordings.** Cemetery and grave-search pages can open a Google Maps search for the cemetery; they do not have verified grave coordinates. Virtual flowers already use the memorial offering flow. WhatsApp sending uses the existing opt-in alert/bridge configuration; stream live alerts are sent only to invitees whose consent is recorded. Stream records are restricted in the UI to signed-in invited viewers (or administrators), and an invited viewer can reopen an ended recording record. The player remains placeholder-only until a real recording host and authorized playback URL service are configured; browser-only checks are not a production access-control boundary.
- **LLM/RAG and generated media.** The grief assistant remains explicitly scripted. No model provider, approved retrieval corpus, privacy/retention policy, music-generation service, or video-generation/hosting provider is configured, so the app does not claim to generate AI answers, biographies, music or videos. Configure approved providers and knowledge sources server-side before enabling those services; do not expose credentials in frontend code.
- **WhatsApp gateway deployment status.** The backend contains a Baileys bridge at `backend/src/whatsapp`, linked to the durable alert outbox and the `send-whatsapp` pg-boss queue. For a local infrastructure test, configure the backend environment and database, apply `npm run db:migrate`, then run `npm run dev`, `npm run worker` and `npm run whatsapp` in separate backend terminals. Pair the dedicated company number from the staff Messaging page only after authenticated admin controls are available. The bridge is an unofficial WhatsApp Web client, not the Meta WhatsApp Business Platform; production use requires a policy/compliance decision and a dedicated number. Sending also requires both `ALERTS_ENABLED=true` and an explicit persisted WhatsApp enable setting. Alerts must remain opt-in, respect STOP, and only message third parties with recorded consent.
- **Production scope boundary.** Authentication, policy import/lookup, funeral case registration, assignment and consent-gated WhatsApp groups are server-backed. Other legacy memorial, marketplace, exhumation, contribution and operations screens still have incomplete live API coverage and must not be represented as operational financial or case-management systems. The alert/admin messaging endpoints still use a shared `ALERTS_API_TOKEN`; do not put that token in frontend configuration. Complete the corresponding server transactions and controls before enabling those services with real customer data.
- **Rules live in pure modules.** `admin/logic.ts` (who may do what, the overview numbers), `account/request-flow.ts` (the assignment lifecycle) and `marketplace/order-flow.ts` (order moves) take time as an argument and import only relative `.ts` files, so the browser mock and `scripts/mock-api.mjs` use the same code. The server must enforce the same rules; the UI hides actions only as a convenience.
- **What a response carries.** Each request and order comes back with the actions the caller may take (`actions`), decided on the server, so the screen never works out permissions for itself.
- **The mock server is one server.** `admin/mock-store.ts` reads and updates the other features' mock tables directly (the one place features reach into each other's mock stores). Everything is loaded on demand, so a live build never fetches it.
- **Audit trail.** Every change made through the portal appends an entry to the activity log; the log is append-only.

## Code structure

```text
src/
  app/          App shell: router, route effects (scroll, title), error boundary, 404
  components/   Shared, feature-agnostic UI (layout/ = header, footer, shells; ui/ = small widgets)
  config/       Site-wide constants: route paths, navigation, titles
  features/     One folder per product area. Each owns its components, data, logic and CSS
  lib/          Pure helpers (formatting)
  styles/       Design system: tokens, base, layout, shared components
```

- Import across folders with the `@/` alias (`@/components/ui/Section`); use `./` only within a folder.
- Features don't reach into each other's internals (only `features/home` composes the other features' section components into the page). Shared pieces move up into `components/`.
- Data and business logic (`data.ts`, `pricing.ts`, `api.ts`) stay out of components so they can be tested and replaced. `features/plans/api.ts` is the seam for a real quote endpoint.
- The provider portal and the customer account pages are lazy-loaded routes.

## Design system

CSS is organised in cascade layers, declared once in `src/index.css`:

```text
tokens → base → layout → components → features
```

A later layer always beats an earlier one, so there are no specificity fights and file import order does not matter.

| Layer | Where | Contains |
| --- | --- | --- |
| `tokens` | `styles/tokens.css` | Palette and semantic tokens, spacing, type, radius, shadow, motion, z-index |
| `base` | `styles/base.css` | Reset, typography, `.container`, `.section`, `.stack`, `.muted` |
| `layout` | `styles/layout.css` | Header, mobile drawer, footer |
| `components` | `styles/components.css` | `.btn`, `.badge`, `.card`, `.icon-tile`, `.split`, `.grid`, forms, chip, accordion, stat card, toast |
| `features` | `features/*/*.css` | Styles specific to one feature, imported by that feature's components |

Rules:

1. **Components use semantic tokens only** (`--color-accent`, `--color-surface`, `--space-4`), never palette values (`--red-500`) and never raw hex/px colours. To re-theme, change the semantic tier in `tokens.css`.
2. **Reuse a primitive before writing a new class.** A card is `card` plus modifiers (`card--interactive`, `stack`), not a new bespoke block. Feature CSS only adds what is genuinely unique.
3. **Vary a primitive with custom properties**, e.g. `--card-pad`, `--stack-gap`, `--outline-color`, rather than overriding its rules.
4. Anchored sections get `scroll-margin-top` from the header height token, so new `id`s need no extra work.
5. Class names are BEM-style (`block__element--modifier`); one block per component.
