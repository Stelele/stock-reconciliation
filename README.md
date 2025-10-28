# Stock Recalculation & POS Autofill (ERPNext)

Automates a daily stock reconciliation workflow against ERPNext and optionally backfills POS quantities for items sold but not recorded. The script:

- Logs into ERPNext, creates a Stock Reconciliation, and downloads the Items CSV.
- Reads your shop day-end Excel, calculates sold quantities = start − end.
- Opens ERPNext POS and fills in item quantities for the calculated sold items.

This helps catch missed POS entries after a physical/day-end count.

## How It Works

1. Download ERP stock: Puppeteer logs into ERPNext Stock Reconciliation and downloads `Items.csv` to `downloads/`.
2. Read shop file: The script opens your day-end Excel (latest sheet), trims the header, and filters rows that include both `add` and `total` columns.
3. Match & compute: Matches shop `item` to ERP `Item Code`, computes `sold = Quantity − end` for items with positive sold.
4. Create POS Invoice: Uses the ERPNext API to create a draft POS invoice with the calculated sold items and their quantities.

Console prints a table of the sold items before POS entry.

## Prerequisites

- Node.js 18+.
- An ERPNext user with access to Stock Reconciliation and POS for your company/warehouse.
- Items and barcodes in ERPNext that match what you type in POS search.
- Network access to allow Puppeteer/Chromium to run. First install may download a browser.

## Installation

```bash
npm install
```

Create a `.env` file in the project root:

```
ERPNEXT_EMAIL=your.user@your-domain.com
ERPNEXT_PASSWORD=your-erpnext-password
ERPNEXT_TOKEN=your-erpnext-api-token
ERPNEXT_URL=https://your-instance.erpnext.com
```

## Configuration

Open `main.js` and review the following:

- `shopDataFileName`: Path to your day-end Excel. Example currently points to `G:/My Drive/.../Njeremoto day end September 2025.xlsx`. Update to your month/path.
- `addon`: If you use a variant (e.g., " Butchery"), set accordingly to match your Excel filename.
- Company/Warehouse: In `downloadErpCsvFile()` the script fills `Njeremoto Enterprises` and `Stores - NEs`. Change to your Company and Warehouse names used in ERPNext.
- ERPNext URL: Set in your `.env` file as `ERPNEXT_URL`. The script will use this as the base URL for both web interface and API calls.
- Downloads folder: Uses `./downloads`. Ensure it exists or allow Puppeteer to create it; you can create it manually if needed.

## Running

You can run via npm script or node directly:

```powershell
npm run main
# or
node main.js
```

What to expect:

- A visible browser window opens (headless: false).
- Script logs in with `.env` credentials.
- Stock Reconciliation is opened; Items are fetched from your warehouse; a CSV downloads to `downloads/Items.csv`.
- The script computes sold quantities from the Excel and prints them as a table.
- POS opens and the script searches each item and sets the computed quantity.

## Data Assumptions

- ERP CSV headers match what ERPNext exports for Stock Reconciliation, including `Item Code` and `Quantity`.
- Shop Excel contains columns named exactly: `item`, `add`, `total`, and `end ` (note the trailing space in `end ` per the current sheet headers).
- The latest sheet in the workbook contains the day-end data to process.

If your headers differ, adjust the field names in `main.js` where they are referenced.

## ERPNext Tips

- Ensure the POS profile and price lists are configured so searched items appear and can be added to the cart.
- If MFA or SSO is enforced, consider an app/password or a test user for automation.
- UI element locators (selectors) may change with ERPNext versions; if the script breaks on a selector, update the corresponding `page.locator(...)` in `main.js`.

## Troubleshooting

- Puppeteer cannot launch: ensure `npm install` completed and that your environment allows running Chromium. Try setting `PUPPETEER_EXECUTABLE_PATH` to a local Chrome if needed.
- No `Items.csv`: verify the Company/Warehouse values and that the "Fetch Items from Warehouse" action runs successfully.
- No items in POS Invoice: confirm that item codes in your shop Excel match ERPNext item codes, and that the items have valid price list rates.

## Files

- `main.js`: End-to-end automation and processing logic.
- `downloads/Items.csv`: Auto-downloaded ERPNext items file (overwritten each run).
- `.env`: ERPNext credentials (email/password).

## License

MIT
