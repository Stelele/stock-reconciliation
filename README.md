# Stock Recalculation + POS Draft (ERPNext)

Automates end-of-day stock reconciliation and creates a draft POS Invoice in ERPNext based on differences between ERP stock and your shop’s day‑end Excel.

What it does

- Logs into ERPNext, opens Stock Reconciliation, fetches items from a warehouse, and downloads `Items.csv`.
- Reads your latest day‑end Excel sheet and computes sold = ERP Quantity − Excel end.
- Looks up standard selling prices and creates a draft POS Invoice via API with calculated quantities and a single Cash payment line (sum of item totals).

Flow

1) Download ERP items: Puppeteer navigates to Stock Reconciliation and downloads `downloads/Items.csv`.
2) Read shop sheet: Parses the latest sheet in the Excel workbook and trims the header rows.
3) Compute deltas: Matches Excel `item` to ERP `Item Code`, computes `sold` per item, logs a console table.
4) Create invoice: Calls ERPNext API to create a draft POS Invoice for sold items.

Requirements

- Node.js 18+
- ERPNext user with access to Stock Reconciliation and POS
- API key/secret for ERPNext (token auth)
- Local Chromium/Chrome allowed to launch (Puppeteer visible browser)

Setup

```bash
npm install
```

Create `.env` in the project root:

```
ERPNEXT_EMAIL=your.user@your-domain.com
ERPNEXT_PASSWORD=your-erpnext-password
ERPNEXT_TOKEN=api_key:api_secret
ERPNEXT_URL=https://your-instance.example.com
```

The ERPNext URL is read from `.env` as `ERPNEXT_URL`.

Configuration

- ERP URL: Set `ERPNEXT_URL` in `.env`.
- Company: Update company name used in Stock Reconciliation in `main.js:205` and `main.js:209`.
- Warehouse: Update warehouse in `main.js:217`, `main.js:226`, and POS item lines `main.js:275`.
- POS profile/customer/currency: Adjust POS invoice defaults in `main.js:268–276`.
- Shop Excel path: The path is built from current year/month and an optional department. Update the base path template in `main.js:300–302`.
- Department: The run uses `butchery` by default in `main.js:379`. Change to `grocery` or wire a parameter if needed.
- Downloads folder: Uses `./downloads` (created automatically if not present on first download).

Run

```powershell
npm run main
# or
node main.js
```

What you’ll see

- A visible browser window.
- Login to ERPNext, open Stock Reconciliation, fetch items from your warehouse, then download `downloads/Items.csv`.
- Console table of computed sold quantities from the Excel sheet.
- A draft POS Invoice created via API; the server response includes the document name.

Data assumptions

- ERP CSV includes headers such as `Item Code`, `Item Name`, and `Quantity` from Stock Reconciliation export.
- Excel sheet columns must include: `item`, `add`, `total`, and `end ` (note the trailing space).
- The latest worksheet in the file contains the day‑end data.

Gotchas

- CSV parsing is simple (splits on commas) and assumes no embedded commas in fields. If your export includes quoted commas, consider switching to a robust CSV parser.
- The script drops a few header/meta lines from the ERP CSV before mapping columns; if your export structure differs, adjust `fetchErpData()` in `main.js:98–120`.
- The Excel path points to a Windows Google Drive location; update the template in `main.js:300–302` for your environment.
- POS entry happens via API (creates a draft POS Invoice); it does not automate the POS UI.

Troubleshooting

- Puppeteer launch issues: ensure `npm install` completed; if corporate policies block Chromium, set `PUPPETEER_EXECUTABLE_PATH` to a local Chrome.
- Missing `Items.csv`: confirm company/warehouse values and that “Fetch Items from Warehouse” ran successfully.
- Empty POS Invoice: make sure Excel `item` values match ERPNext `Item Code`, and that items have a Standard Selling price.

Files

- `main.js`: Automation + processing logic
- `downloads/Items.csv`: Auto‑downloaded ERP stock snapshot
- `.env`: Credentials and API token

License

MIT
