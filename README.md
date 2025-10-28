# Stock Recalculation + POS Draft (ERPNext)

Automates end‑of‑day reconciliation using only ERPNext APIs. It compares ERP stock (Bin.actual_qty) to your day‑end Excel and creates a draft POS Invoice for the computed differences.

What it does

- Fetches current stock via API from `Bin` for a configured warehouse.
- Reads your latest day‑end Excel sheet and computes `sold = actual_qty − Excel end` per item.
- Looks up Standard Selling prices via API and creates a draft POS Invoice with a single Cash payment line (sum of item totals).

Flow

1) Fetch ERP stock: Calls `GET /api/v2/document/Bin` with filters for warehouse and non‑zero quantities.
2) Read shop sheet: Parses the latest worksheet in the Excel file and trims header rows.
3) Compute deltas: Matches Excel `item` to ERP `item_code`, computes `sold`, logs a console table.
4) Create invoice: Calls `POST /api/v2/document/POS Invoice` with items and a total Cash payment.

Requirements

- Node.js 18+
- ERPNext API key/secret with permissions to read `Bin`, read `Item Price`, and create `POS Invoice`
- ERPNext site URL

Setup

```bash
npm install
```

Create `.env` in the project root:

```
ERPNEXT_TOKEN=api_key:api_secret
ERPNEXT_URL=https://your-instance.example.com
```

Configuration

- ERP URL/token: Set `ERPNEXT_URL` and `ERPNEXT_TOKEN` in `.env`.
- Warehouse filter: Update the `Bin` filter warehouse in `erpnext.js:58`.
- Price list: Update the price list used in `erpnext.js:90` if not “Standard Selling”.
- POS invoice defaults: Company, customer, POS profile, currency, and item warehouse are set in `erpnext.js:132–140`.
- Shop Excel path: Update the path template in `main.js:103–105`.
- Department: Default is `butchery` in `main.js:111`; change to `grocery` if needed.

Run

```powershell
npm run main
# or
node main.js
```

What you’ll see

- Console table of computed item deltas (`sold`).
- API response confirming a draft POS Invoice (document name in output).

Data assumptions

- Excel sheet columns must include: `item`, `add`, `total`, and `end ` (note the trailing space).
- The latest worksheet in the file contains the day‑end data.
- Excel `item` values match ERPNext `item_code`.

Notes

- The calculation uses current ERP `Bin.actual_qty` as the “start”; it produces a variance vs Excel “end”, not necessarily the day’s sales unless your process ensures that interpretation.

Troubleshooting

- 401/403 from API: verify `ERPNEXT_TOKEN` and that the API key/secret has permission for the doctypes used.
- Empty POS Invoice: ensure Excel `item` codes exist in ERPNext and that items have a price in the selected price list.
- Wrong warehouse/quantities: adjust the `Bin` filter warehouse in `erpnext.js:58` and item `warehouse` in `erpnext.js:139`.

Files

- `main.js`: Excel processing and orchestration
- `erpnext.js`: ERPNext API calls (stock fetch, price lookup, invoice creation)
- `.env`: API URL and token

License

MIT
