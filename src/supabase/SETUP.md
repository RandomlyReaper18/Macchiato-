# Supabase setup (Phase 3)

Free plan is enough. Steps 1-5 are manual and only you can do them.

## 1. Create the project
supabase.com > **New project** (region near the Philippines, e.g. Singapore). Save the database password. Wait until it finishes starting.

## 2. Create or upgrade the database
**SQL Editor > New query**, paste ALL of `src/supabase/schema.sql`, press **Run** ("Success").
Safe to run again, including on top of the earlier Phase 3A version: it only adds what is missing.
Check **Table Editor**: `drinks` has 12 rows and every table shows "RLS enabled" (leave it on).

## 3. Turn off public sign-ups
**Authentication > Sign In / Providers**: switch **Allow new users to sign up** OFF.

## 4. Create the staff login
1. **Authentication > Users > Add user > Create new user**: staff email + strong password, tick **Auto Confirm User**.
2. **SQL Editor**, run (change the email):
```sql
insert into public.staff (user_id)
select id from auth.users where email = 'staff@example.com'
on conflict do nothing;
```
A user who can sign in but is not in `staff` cannot issue codes, give rewards or create demo data.

## 5. Connect the website
Copy two values from **Project Settings > API** (Project URL and the anon / publishable key):

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Project URL, e.g. `https://abcdxyz.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | anon / publishable key |

- **Local:** copy `.env.example` to `.env.local`, fill both, run `npm run dev`.
- **Vercel:** Project > Settings > Environment Variables, add both names for Production (and Preview), then **redeploy** (Vite reads them at build time).
- NEVER use the `service_role` key anywhere in this project.

The footer shows "Database connected" only after a real request to the database succeeds.

## Functions the website calls
| Function | Who | Purpose |
|---|---|---|
| `ping()` | anyone | Connection check |
| `get_card(mobile)` | anyone | Load card, history, rewards |
| `enroll_customer(mobile, name)` | anyone | Create a card (one per number) |
| `redeem_code(mobile, code)` | anyone | Atomic: verify code, record purchase, +1 stamp, reward at 10 |
| `staff_check()` | anyone | Tells the screen if the signed-in user is staff |
| `issue_code(drink_id, sale_token)` | staff | New code per sale; same token returns the same code |
| `get_sale_code(sale_token)` | staff | Read-only: show the same code again |
| `give_reward(mobile)` | staff | Mark oldest waiting free drink as given |
| `create_demo_data()` / `remove_demo_data()` | staff | Flagged demo customers 09000000001-3 |

## Table mapping to your Phase 3 spec
| Your spec | In the database |
|---|---|
| `customers.current_stamps`, `completed_cards` | Same names. Written only by `redeem_code` in the same transaction as the purchase. |
| `purchase_codes.created_at` | `issued_at` (also `expires_at`) |
| `purchase_codes.drink_name`, `status`, `redeemed_at`, `redeemed_by_customer_id` | Same names; `status` is `issued`, `redeemed` or `expired` |
| `purchases.purchase_code_id` | `code_id` (UNIQUE: one code can never give two stamps) |
| `rewards` | Same; `reward_status` is `earned` or `redeemed` |
| extras | `drinks`, `staff`, `redeem_attempts`; `is_demo` flags |

## Demo data
Staff panel > **Test data** > Create demo customers (09000000001 = 0 cups, ...02 = 3 cups, ...03 = 9 cups). Any number from 09000000000 to 09000000999 is treated as a test number and flagged `is_demo`. **Remove demo customers** deletes only flagged rows. Real customers are never touched.

## Known limits
- Anyone who knows a customer's mobile number can view that card and redeem a valid code for it (your spec: number = identity). A PIN or SMS check could be added later.
- Codes are stored readable (not hashed) so "Show same code" works. Protection: staff-only issuing, rate limit (5 wrong tries per number / 60 overall per 10 minutes), 15-minute expiry, single use.
- Anyone can create a card for any valid number (self-enrollment, as in Phase 2).
