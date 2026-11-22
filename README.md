# Don Macchiatos: Loyalty Card (Phase 3: shared database)

Vite + React + Supabase (Postgres). No extra npm packages: the app talks to Supabase with plain `fetch` (`src/data/supabase.js`).

```
npm install
npm run dev         # needs .env.local (see src/supabase/SETUP.md)
npm run build
npm test            # 20 unit tests, no database needed
npm run test:live   # real checks against your Supabase project (see below)
```

**First, do the manual steps in `src/supabase/SETUP.md`** (run `src/supabase/schema.sql`, create the staff user, set the two environment variables).

## How it works
- All records live in Supabase. The browser can't read or write tables; it can only call database functions (`src/supabase/schema.sql`). The database decides every result.
- **Staff** sign in (Supabase Auth) and must also be on the `staff` table. `issue_code`, `get_sale_code`, `give_reward` and the demo-data functions re-check this on every call.
- **Codes:** 4 digits, unique among active codes, linked to the drink, 15-minute expiry, single use. One sale = one random token: "Issue code" creates the code, "Show same code" reads the saved one back, "Start next purchase" begins a new sale (old records are kept).
- **Redeem** (`redeem_code`) runs in one transaction: lock code, check it, record the purchase, mark the code redeemed, update the stamp count, create a reward at the 10th stamp. Any failure rolls everything back; simultaneous attempts cannot both succeed.
- **Stamps** are shown from the purchase list the database returns; the browser never sends a count.
- **Connection indicator** (footer): green only after a real `ping()` request succeeds.

## Structure
```
src/data/supabase.js       fetch client + staff session
src/logic/api.js           screens -> database functions
src/logic/useDbStatus.js   connection indicator state
src/logic/useStaffSession.js
src/logic/customerService.js, loyalty.js   card/stamp/usual-drink rules (pure)
src/components/            existing screens + DbStatus, StaffLogin, StaffSection
src/supabase/schema.sql    tables, RLS, functions (run in SQL Editor)
scripts/live-check.mjs     live integration check
```

## Live check
```
VITE_SUPABASE_URL=... VITE_SUPABASE_ANON_KEY=... STAFF_EMAIL=... STAFF_PASSWORD=... npm run test:live
```
Without the staff variables only the customer and security checks run. It only creates flagged demo records (number 09000000xxx); remove them with "Remove demo customers" in the Staff panel. Copy-to-clipboard must be checked by hand in a browser.
