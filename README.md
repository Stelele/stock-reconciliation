# Stock Recalculation + POS Draft (ERPNext)

Automates end-of-day reconciliation using only ERPNext APIs. It compares ERP stock (Bin.actual_qty) to your day-end Excel and creates a draft POS Invoice for the computed differences.

## Value Proposition

Reconcile stock values between ERPNext and physical inventory; find product sales not recorded via POS.

## What It Does

- Fetches current stock via ERPNext API from `Bin` for a configured warehouse.
- Reads the latest day-end Excel sheet and computes `sold = actual_qty − Excel end` per item.
- Looks up Standard Selling prices via ERPNext API and creates a draft POS Invoice with a single Cash payment line (sum of item totals).

## Flow

1. **Fetch ERP stock**: Calls `GET /api/v2/document/Bin` with filters for warehouse and non-zero quantities.
2. **Read shop sheet**: Parses the latest worksheet in the Excel file and trims header rows.
3. **Compute deltas**: Matches Excel `item` to ERP `item_code`, computes `sold`, logs a console table.
4. **Create invoice**: Calls `POST /api/v2/document/POS Invoice` with items and a total Cash payment.

## Requirements

- **Node.js**: `>=12`; tested with Node 18+
- **ERPNext API key/secret** with permissions to read `Bin`, read `Item Price`, and create `POS Invoice`
- **ERPNext site URL**

## Installation

```bash
git clone https://github.com/Stelele/stock-reconciliation.git
cd stock-reconciliation
npm install
```

> Note: the npm package name is `stock-recalculation`, which differs from the repo directory name (`stock-reconciliation`); keep the clone directory as `stock-reconciliation`.

Create `.env` in the project root:

```
ERPNEXT_TOKEN=api_key:api_secret
ERPNEXT_URL=https://your-instance.example.com
EXCEL_FILE_PATH=/absolute/path/to/excel/files
```

## Configuration

| Setting | File | Description |
|---|---|---|
| ERP URL/token | `.env` | Set `ERPNEXT_URL` and `ERPNEXT_TOKEN` in `.env`. |
| Warehouse filter | `erpnext.js:59` | Update the `Bin` filter warehouse (default: `Stores - NEs`). |
| Price list | `erpnext.js:94` | Update the price list used if not "Standard Selling". |
| POS invoice defaults | `erpnext.js:136–158` | Company, customer, POS profile, currency, and item warehouse. |
| Shop Excel path | `main.js:109` | Path template for day-end Excel files. |
| Department | `main.js:102` | Default is `Butchery`; change to `Liquor` if needed. |

## Usage

```bash
node main.js
# or
npm run main
```

### What You'll See

- Console table of computed item deltas (`sold`).
- API response confirming a draft POS Invoice (document name in output).

## Data Assumptions

- Excel sheet columns must include: `item`, `add`, `total`, and `end ` (note the trailing space).
- The latest worksheet in the file contains the day-end data.
- Excel `item` values match ERPNext `item_code`.
- Departments supported: `Butchery` and `Liquor`.

## Troubleshooting / FAQ

| Issue | Resolution |
|---|---|
| 401/403 from API | Verify `ERPNEXT_TOKEN` and that the API key/secret has permission for the doctypes used. |
| Empty POS Invoice | Ensure Excel `item` codes exist in ERPNext and that items have a price in the selected price list. |
| Wrong warehouse/quantities | Adjust the `Bin` filter warehouse in `erpnext.js:59` and item `warehouse` in `erpnext.js:148`. |
| Paid POS invoices remain | The script checks for paid POS invoices at startup; consolidate them before running to prevent double-invoicing. |

## Contributing

1. Fork the repo.
2. Create a feature branch: `git checkout -b feature/foo`.
3. Commit your changes: `git commit -m "Add foo"`.
4. Push to your fork: `git push origin feature/foo`.
5. Open a Pull Request.

## License

MIT

Copyright (c) 2025 Gift Mugweni

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
Software.