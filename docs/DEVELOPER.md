# Developer Guide: Stock Reconciliation Scripts

## Architecture

Two primary modules work together:

1. **`main.js`** — Orchestration layer: Excel parsing, delta computation, and API coordination.
2. **`erpnext.js`** — ERPNext API client: stock fetch, price lookup, and POS Invoice creation.

## ERPNext API Client (`erpnext.js`)

### Imports & Configuration

```js
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

const ERPNEXT_TOKEN = process.env.ERPNEXT_TOKEN;
const ERPNEXT_URL = process.env.ERPNEXT_URL;

const headers = {
  Authorization: `token ${ERPNEXT_TOKEN}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};
```

- `ERPNEXT_TOKEN`: API key and secret in `api_key:api_secret` format.
- `ERPNEXT_URL`: Base URL of the ERPNext instance (e.g., `https://your-instance.example.com`).
- All API requests use token auth via the `Authorization: token <token>` header (ERPNext `api_key:api_secret` token — **not** Bearer).

### Functions

#### `getErpStockData()`

- **Endpoint**: `GET ${ERPNEXT_URL}/api/v2/document/Bin`
- **Purpose**: Fetch current stock levels for the configured warehouse.
- **Query params**:
  - `fields`: JSON-stringified list of fields: `name`, `item_code`, `warehouse`, `actual_qty`, `reserved_qty`, `projected_qty`, `valuation_rate`.
  - `filters`: JSON-stringified two filters:
    1. `["Bin", "warehouse", "=", "Stores - NEs"]` — limits to a specific warehouse.
    2. `["Bin", "actual_qty", "!=", 0]` — only non-zero quantities.
  - `limit_page_length: 0` — returns all records (no pagination limit).
- **Response**: Array of `ErpStockEntry` objects with fields: `name`, `item_code`, `warehouse`, `actual_qty`, `reserved_qty`, `projected_qty`, `valuation_rate`.

#### `getItemPrices(soldItems)`

- **Endpoint**: `GET ${ERPNEXT_URL}/api/v2/document/Item Price`
- **Purpose**: Look up Standard Selling prices for items that have non-zero sold quantities.
- **Query params**:
  - `fields`: JSON-stringified fields: `name`, `item_code`, `price_list`, `currency`, `uom`, `price_list_rate`.
  - `filters`: JSON-stringified two filters:
    1. `["Item Price", "price_list", "=", "Standard Selling"]` — filters by price list.
    2. `["Item Price", "item_code", "in", itemCodes]` — limits to the sold item codes.
  - `limit_page_length: "1000"` — returns up to 1000 results.
- **Response**: Array of `Item Price` documents. Each has `price_list_rate` which is used as the unit price.
- **Mapping**: Each sold item is matched to its price entry by `item_code`. The returned object includes `unitPrice` (from `price_list_rate`), `total` (unitPrice * sold).

#### `enterSales(itemPrices)`

- **Endpoint**: `POST ${ERPNEXT_URL}/api/v2/document/POS Invoice`
- **Purpose**: Create a draft POS Invoice with the computed sales.
- **Request body** includes:
  - `company`: `"Njeremoto Enterprises"`
  - `customer`: `"Reconciliation Customer"`
  - `pos_profile`: `"Enterprise POS"`
  - `currency`: `"USD"`
  - `update_stock`: `1` — this flag tells ERPNext to adjust Bin actual_qty.
  - `items`: Array of `{ item_code, qty, warehouse }` where `qty` is `item.sold` and `warehouse` is `"Stores - NEs"`.
  - `payments`: Array with one Cash payment for the total amount (`Math.ceil(itemPrices.reduce((acc, item) => acc + item.total, 0))`).
- **Response**: JSON with the created POS Invoice document name, or error status.

#### `getPaidPOSInvoices()`

- **Endpoint**: `GET ${ERPNEXT_URL}/api/v2/document/POS Invoice`
- **Purpose**: At startup, check for any already-paid POS invoices for the company to prevent double-invoicing.
- **Filters**: `docstatus = 1` (submitted), `company = "Njeremoto Enterprises"`, `status = "Paid"`.
- **Returns**: Array of paid POS Invoice record objects (fields include `name`, `status`), or empty array if none found.

## Main Orchestration (`main.js`)

### Imports

```js
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { readFileSync } from "fs";
import { read, utils } from "xlsx";
import {
  getErpStockData,
  getItemPrices,
  enterSales,
  getPaidPOSInvoices,
} from "./erpnext.js";
```

### Key Types

- **`ShopData`**: Row-based data from Excel with fields: `item`, `start`, `add`, `total`, `end ` (trailing space), `Sold`, ` Selling Price `, ` Order Price `, ` selling amount `, ` Order Amount `, ` contribution `.
- **`StockItemSummary`**: Simplified summary: `{ item, start, end, sold }`.
- **`ErpStockEntry`**: ERPNext Bin entry (defined in `erpnext.js` typedef).
- **`ItemPrice`**: Combined type from SoldItem + Price: `{ item, start, end, sold, unitPrice, total }`.

### Functions

#### `fetchShopData(shopDataFileName)`

- Reads an Excel file from disk using `readFileSync` + `xlsx.read`.
- Determines the latest sheet name (last in `SheetNames` array).
- Decodes the range and sets the start row to index 2, skipping the first two rows (the header area).
- Converts the sheet to JSON using `utils.sheet_to_json`.
- Filters rows that have both `add` and `total` fields.
- Sorts alphabetically by `item` name.

#### `processData(formattedErpStockData, filteredShopData)`

- Iterates over ERP stock entries.
- For each ERP entry, finds a matching shop item by `item_code` (`erpData["item_code"]`) vs `item` (`shopItem["item"]`).
- If a match exists, computes:
  - `start`: ERP `actual_qty`
  - `end`: Excel `end ` value (note the trailing space in the column name!)
  - `sold`: `actual_qty - end`
- Filters out items where `sold === 0`.
- Logs the result as `console.table(soldItems)`.

#### `getShopDataFileName(dept = "Butchery" | "Liquor")`

- Generates the Excel file path based on the current date:
  - `year`: `date.getFullYear()`
  - `month`: `date.getMonth() + 1` (1-indexed)
  - `fullMonthName`: e.g., "September"
- Path template:
  ```
  ${EXCEL_FILE_PATH}/${year}/${month}-${fullMonthName}/Njeremoto ${dept} day end ${fullMonthName} ${year}.xlsx
  ```
- Example: `./excel/2026/9-September/Njeremoto Butchery day end September 2026.xlsx`

#### `main()`

The entry point, async execution:

1. **Checks for paid POS invoices** — calls `getPaidPOSInvoices()`. If any exist, logs an error and aborts to prevent double-invoicing.

2. **Fetches ERP stock data** — `getErpStockData()`.

3. **Reads shop data for both departments**:
   ```js
   ...fetchShopData(getShopDataFileName("Butchery")),
   ...fetchShopData(getShopDataFileName("Liquor")),
   ```
   Combines and sorts by item name.

4. **Processes data** — `processData(erpData, shopData)` to compute deltas.

5. **Looks up prices** — `getItemPrices(processedData)` — enriches each sold item with `unitPrice` and `total`.

6. **Enters sales** — `enterSales(itemPrices.filter((item) => item.sold > 0))` — creates the draft POS Invoice.

### Execution Flow

```
main()
  → getPaidPOSInvoices()              # abort if paid invoices exist
  → getErpStockData()                 # fetch Bin records
  → fetchShopData(Butchery) + fetchShopData(Liquor)  # read Excel
  → processData()                     # compute sold = actual_qty - Excel end
  → getItemPrices()                   # fetch Standard Selling prices
  → enterSales()                      # create draft POS Invoice
```

## Development Setup

### Prerequisites

- **Node.js**: 18+ (the script uses ES module syntax — `import`/`export` — and the global `fetch` API; `"type": "module"` is already set in package.json).
- **ERPNext instance** with API access.
- **Excel files** day-end data in the expected path structure.

### Local Setup

```bash
# 1. Clone / download the repo
git clone https://github.com/Stelele/stock-reconciliation.git
cd stock-reconciliation

# 2. Install dependencies
npm install

# 3. Create .env file
cat > .env <<EOF
ERPNEXT_TOKEN=api_key:api_secret
ERPNEXT_URL=https://your-instance.example.com
EXCEL_FILE_PATH=/absolute/path/to/excel/files
EOF

# 4. Place Excel files
# Ensure the Excel directory structure exists:
# /path/to/excel/2026/9-September/Njeremoto Butchery day end September 2026.xlsx
# /path/to/excel/2026/9-September/Njeremoto Liquor day end September 2026.xlsx

# 5. Run the script
node main.js
```

### Debugging Tips

- **No data returned from ERP**: Check that `ERPNEXT_TOKEN` is `api_key:api_secret` format and the API key has read permissions for `Bin` and `Item Price` doctypes.
- **Empty sold items**: Verify that Excel `item` values exactly match ERPNext `item_code` values (case-sensitive).
- **Price lookup returns undefined**: Ensure items have a price in the "Standard Selling" price list (or whichever price list is configured in `erpnext.js:94`).
- **POS Invoice with 0 items**: The script filters `itemPrices.filter((item) => item.sold > 0)` before creating the invoice. If all sold quantities are 0, no invoice is created.
- **Trailing space in Excel column**: The code explicitly handles the `end ` column name with a trailing space. If your Excel file uses `end` without a space, you'll need to adjust the column reference in `main.js:85`.

### Adding New Features

- **New department**: Add a new call to `fetchShopData(getShopDataFileName("NewDept"))` in `main()`, and update `getShopDataFileName()` if you need a different path template.
- **Different price list**: Change the filter value in `erpnext.js:94` from `"Standard Selling"` to your price list name.
- **Different warehouse**: Update the warehouse filter in `erpnext.js:59` and the `warehouse` field in the POS Invoice body (`erpnext.js:148`).
- **Additional Excel columns**: Modify `fetchShopData()` to parse extra columns, and update `processData()` and the `ShopData` typedef in `main.js`.