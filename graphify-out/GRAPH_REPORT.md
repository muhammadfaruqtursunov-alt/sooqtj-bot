# Graph Report - sooqtj-bot  (2026-06-02)

## Corpus Check
- 0 files · ~99,999 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 325 nodes · 555 edges · 19 communities
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]

## God Nodes (most connected - your core abstractions)
1. `_conn()` - 17 edges
2. `upload_product_photo()` - 11 edges
3. `useDarkMode()` - 11 edges
4. `_get_sheet()` - 11 edges
5. `update_product_prices()` - 10 edges
6. `update_product_photo()` - 10 edges
7. `_ensure_orders_sheet()` - 9 edges
8. `getPhotoUrl()` - 9 edges
9. `str` - 8 edges
10. `_public_base()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `Telegram WebApp JS SDK` --semantically_similar_to--> `pyTelegramBotAPI dependency`  [INFERRED] [semantically similar]
  mini-app/index.html → requirements.txt
- `Favicon /logo.png` --semantically_similar_to--> `SOOQ.TJ brand logo (SVG)`  [INFERRED] [semantically similar]
  mini-app/index.html → mini-app/public/logo.svg
- `npm run build step` --shares_data_with--> `mini-app index.html SPA entry`  [INFERRED]
  .github/workflows/pages.yml → mini-app/index.html
- `Railway-hosted API backend (web-production-748b4.up.railway.app)` --conceptually_related_to--> `fastapi dependency`  [INFERRED]
  .github/workflows/pages.yml → requirements.txt
- `Railway-hosted API backend (web-production-748b4.up.railway.app)` --conceptually_related_to--> `psycopg2-binary dependency`  [INFERRED]
  .github/workflows/pages.yml → requirements.txt

## Import Cycles
- None detected.

## Communities (19 total, 0 thin omitted)

### Community 0 - "Community 0"
Cohesion: 0.08
Nodes (21): GlassToggle(), CONFETTI, MAP, AdminPage(), ClientPage(), DRIVER_STATUSES, DriverPage(), ALL_STATUSES (+13 more)

### Community 1 - "Community 1"
Cohesion: 0.09
Nodes (39): float, add_product(), _col_letter(), create_order(), delete_product(), ensure_connected(), _ensure_orders_sheet(), _find_col() (+31 more)

### Community 2 - "Community 2"
Cohesion: 0.09
Nodes (24): MSG_TYPES, PriceBlock(), ProductCard(), ALL_STATUSES, CHIP_ACTIVE, CHIP_COLORS, ORDER_STATUSES, ph() (+16 more)

### Community 3 - "Community 3"
Cohesion: 0.10
Nodes (35): bytes, add_expense(), add_partner(), add_review(), _conn(), delete_expense(), get_client_user_ids(), get_clients() (+27 more)

### Community 4 - "Community 4"
Cohesion: 0.08
Nodes (30): fastapi dependency, google-auth dependency, gspread dependency, psycopg2-binary dependency, pyTelegramBotAPI dependency, python-multipart dependency, requests dependency, uvicorn[standard] dependency (+22 more)

### Community 5 - "Community 5"
Cohesion: 0.10
Nodes (8): broadcast(), BroadcastIn, create_expense(), ExpenseIn, Force re-register Telegram webhook + return current webhook info., ReviewIn, setup_bot(), submit_review()

### Community 6 - "Community 6"
Cohesion: 0.11
Nodes (17): dependencies, lucide-react, react, react-dom, devDependencies, autoprefixer, postcss, tailwindcss (+9 more)

### Community 7 - "Community 7"
Cohesion: 0.23
Nodes (13): DebugPanel(), req(), _buf, clearLogs(), dapi(), derr(), dlog(), dumpText() (+5 more)

### Community 8 - "Community 8"
Cohesion: 0.24
Nodes (12): add_driver_runtime(), add_partner_runtime(), _get_admin_id(), get_role(), init_drivers(), _load_drivers_from_env(), _load_partners_from_env(), int (+4 more)

### Community 9 - "Community 9"
Cohesion: 0.24
Nodes (10): driver_activate(), is_admin(), make_markup(), partner_activate(), int, Добавляет user_id в PARTNER_IDS через Railway API., Добавляет user_id в DRIVER_IDS через Railway API., _save_driver_to_railway() (+2 more)

### Community 10 - "Community 10"
Cohesion: 0.20
Nodes (12): BatchOrderIn, create_manual_order(), create_order(), create_order_batch(), ManualOrderIn, OrderIn, OrderItemIn, Admin-only: register an order received via external channels.     Stored with u (+4 more)

### Community 11 - "Community 11"
Cohesion: 0.26
Nodes (12): _compress_to_webp(), _public_base(), Upload a photo and assign it to a specific product row (writes Фото 1 column onl, Upload → compress to WebP (~70x smaller) → publish to GitHub Pages CDN.     Als, Build the public HTTPS base URL from the Host header.     request.base_url is u, Build the public HTTPS base URL from the Host header.     request.base_url is u, Resize to max_px on the long edge and re-encode as WebP (~50-80KB).     ~70x sm, upload_logo() (+4 more)

### Community 12 - "Community 12"
Cohesion: 0.18
Nodes (11): _diag_notify(), get_current_user(), _github_put_file(), bool, str, Admin-only: probe why notifications might not reach the client., Create/update a file in the GitHub repo via Contents API.     Triggers GitHub A, serve_image() (+3 more)

### Community 13 - "Community 13"
Cohesion: 0.25
Nodes (8): _extract_orm_code(), get_products(), on_startup(), Find ORM-XXX in any field of the product dict (handles swapped Артикул/Категория, Find ORM-XXX in any field of the product dict (handles swapped Артикул/Категория, Recompute cost & selling price for every product and write back to Sheets., Recompute cost & selling price for every product and write back to Sheets., recalc_prices()

### Community 14 - "Community 14"
Cohesion: 0.29
Nodes (7): add_product(), delete_product(), get_role_endpoint(), ProductIn, int, remove_expense(), update_product()

## Knowledge Gaps
- **45 isolated node(s):** `name`, `version`, `type`, `dev`, `build` (+40 more)
  These have ≤1 connection - possible missing edges or undocumented components.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `upload_product_photo()` connect `Community 11` to `Community 13`, `Community 12`, `Community 5`, `Community 14`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `Force re-register Telegram webhook + return current webhook info.`, `Admin-only: probe why notifications might not reach the client.`, `Find ORM-XXX in any field of the product dict (handles swapped Артикул/Категория` to the rest of the system?**
  _94 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08194905869324474 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.09230769230769231 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.08974358974358974 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.10317460317460317 - nodes in this community are weakly interconnected._
- **Should `Community 4` be split into smaller, more focused modules?**
  _Cohesion score 0.08275862068965517 - nodes in this community are weakly interconnected._