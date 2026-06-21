# Design System

Source: the Kanjo plan (`Kanjo.pdf`). Tokens here are mirrored in
`web/tailwind.config.ts` and `web/src/index.css` — keep them in sync; code is the
source of truth.

## Design Philosophy

Japanese ledger-inspired visual style: traditional accounting books, Japanese
stationery, MUJI, minimal notebooks. Calm, focused, trustworthy aesthetic.

## Color Palette

| Token | Hex | Use |
|---|---|---|
| Background | `#F8F5F0` | page background (paper) |
| Secondary Background | `#F1ECE4` | cards, raised surfaces |
| Primary Text | `#2B2B2B` | body / headings |
| Secondary Text | `#6B6B6B` | muted / captions |
| Positive | `#4F6F52` | income, gains |
| Negative | `#9B4D4D` | expense, loss |
| Accent | `#6F5E53` | links, emphasis |
| Border | `#E5DED3` | card / table borders (1px) |

## Typography

| Role | Font | Alt |
|---|---|---|
| Headings | Noto Serif JP | IBM Plex Serif |
| Body | Geist | Inter |
| Numeric | JetBrains Mono | — |

Numbers (amounts, balances) always render in the monospace numeric face so
columns align.

## Component Guidelines

- **Cards** — subtle paper styling: 1px `#E5DED3` border, 8px radius, `#F8F5F0`
  background.
- **Tables** — first-class. Dense, searchable, keyboard-friendly.
- **Charts** — readability first: thin lines, minimal fills, limited colors,
  clear labels (Recharts).

## Information Architecture

- **Dashboard metrics**: Current Balance, Monthly Burn, Savings Rate, Runway,
  Recent Transactions.
- **Ledger columns**: Date, Description, Amount, Account, Category, Project, Tags.
- **Accounts** (examples): BCA, Jago, Cash, Emergency Fund, Investments.
- **Categories** (examples): Housing, Food, Transportation, Infrastructure,
  Projects, Hobbies, Healthcare.
- **Projects** can own transactions — e.g. *LazyScan Lite* with VPS, Domain, SMTP
  at a monthly cost of Rp 185,000.
- **Reports**: Cash Flow, Burn Rate, Category Breakdown, Balance Trend, Project
  Cost Breakdown.
