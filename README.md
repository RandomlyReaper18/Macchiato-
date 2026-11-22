# Don Macchiatos: Loyalty Card (Phase 2: Customers and Stamps)

Vite + React. Run it:

```
npm install
npm run dev      # development
npm run build    # production build check
npm test         # unit tests for the loyalty rules (Node 20+, no extra packages)
```

## Structure
```
src/
  App.jsx                 page composition + in-memory demo state
  components/             Header, Navigation, HeroSection, MenuSection, MenuCard,
                          LoyaltyCard, StampProgress, RedeemCodePanel,
                          StaffCodePanel, PromotionSection, Footer, Decor (shared art)
  data/                   shop.js (name), menu.js (single menu source), customers.js (demo)
  logic/loyalty.js        stamp math, usual drink, code issue/check (demo versions)
  styles/index.css        design tokens + all styling
```
Edit the shop name in `data/shop.js` and drinks/prices in `data/menu.js`.

## How the loyalty rules work
- **Lookup:** the mobile number is normalized (`+63 912...` becomes `0912...`), validated (`09` + 9 digits), then matched against stored customers. Unknown numbers offer a short enrollment form (mobile + optional name). A number can only be enrolled once.
- **Stamps:** derived from the number of redeemed purchases, one stamp per purchase code. `current_stamps` and `completed_cards` are never stored separately, so they cannot drift or go negative. Purchase 10 completes the card and creates one reward; purchase 11 starts the next card. History, completed cards and rewards are all kept.
- **Usual drink:** most purchased drink over the whole history. A tie goes to the tied drink bought most recently, then alphabetical.
- **Rewards:** earned automatically at the 10th stamp; staff mark the free drink as given (customers cannot).

## Storage (temporary)
Records are saved in **this browser's localStorage** (`src/data/store.js`). That is local-only, not a shared database: staff and customers on different devices will not see each other's data. Phase 3+ replaces `store.js` with a real shared database. Rules live in `src/logic/customerService.js` as pure functions so they can move to a server unchanged.

## Demo vs production
| Feature | Now | Production (later phases) |
|---|---|---|
| Menu | Real, from `menu.js` | Same (or from DB) |
| Customers, purchases, rewards | localStorage, seeded demo customers | Shared database |
| Purchase codes | Generated in the browser, lost on reload (Phase 1 demo) | Server-generated, hashed, single-use, expiring, linked to the purchase (Phase 3) |
| Redeem | Browser calls the rules directly | Server verifies the code, then awards the stamp |
| Staff panel | Open to anyone | Staff login, server-side only |

Demo numbers (shown as buttons on the card): 09123456789 (1 stamp), 09171234567 (6), 09987654321 (9), 09556667777 (0), 09445556666 (complete card), 09334445555 (usual-drink example), 09223334444 (second card in progress).
Try it: Staff panel > Issue code > type that code in Redeem (after loading a card).
