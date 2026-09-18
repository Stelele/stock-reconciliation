# User Guide: Stock Reconciliation Workflow

## Overview

This script automates end-of-day stock reconciliation between ERPNext and physical inventory recorded in Excel, and creates a draft POS Invoice for any differences found.

## Step-by-Step Operation

### 1. Environment Setup

- Ensure `.env` exists in the project root with `ERPNEXT_TOKEN`, `ERPNEXT_URL`, and `EXCEL_FILE_PATH` (required; used by `main.js:109`) set.
- The script reads `.env.local` first, then the generic `.env` (dotenv precedence).

### 2. Run the Script

```bash
node main.js
# or
npm run main
```

### 3. What Happens Internally

The script executes these steps in order:

1. **Check for unconsolidated paid POS invoices**
   - Calls `GET /api/v2/document/POS Invoice?filters=[["POS Invoice","docstatus","=","1"],["POS Invoice","company","=","Njeremoto Enterprises"],["POS Invoice","status","=","Paid"]]`
   - If any paid invoices exist, the script aborts with an error message to prevent double-invoicing.

2. **Fetch ERP stock data**
   - Calls `GET /api/v2/document/Bin?filters=[["Bin","warehouse","=","Stores - NEs"],["Bin","actual_qty","!=",0]]&fields=[...]`
   - Retrieves `actual_qty`, `item_code`, `warehouse` for all non-zero stock entries in the configured warehouse.

3. **Read day-end Excel data**
   - Reads the latest worksheet from the Excel file at the path template:
     `${EXCEL_FILE_PATH}/${year}/${month}-${fullMonthName}/Njeremoto ${dept} day end ${fullMonthName} ${year}.xlsx`
   - Two departments are supported: `Butchery` and `Liquor`.
   - Parses the sheet, skips the header row, and extracts rows with `item`, `add`, `total`, and `end ` (trailing space in column name) columns.

4. **Compute deltas (sold quantity)**
   - For each ERP stock entry, finds a matching Excel item by `item_code` / `item` field.
   - Computes `sold = actual_qty - Excel "end "` value.
   - Results are logged as a console.table output.

5. **Look up selling prices**
   - For each computed `sold` item, calls `GET /api/v2/document/Item Price?filters=[["Item Price","price_list","=","Standard Selling"],["Item Price","item_code","in",...]]&fields=[...]`
   - Retrieves `price_list_rate` (the Standard Selling price).

6. **Create draft POS Invoice**
   - Calls `POST /api/v2/document/POS Invoice` with:
     - Company: `Njeremoto Enterprises`
     - Customer: `Reconciliation Customer`
     - POS Profile: `Enterprise POS`
     - Currency: `USD`
     - `update_stock: 1`
     - Items array with `item_code`, `qty` (sold quantity), and `warehouse: "Stores - NEs"`
     - Payment: single Cash entry for the total amount (sum of `price_list_rate * sold` per item).

### 4. Output Interpretation

- **Console table**: Shows each item's `item`, `start` (ERP actual_qty), `end` (Excel end value), and `sold` (variance).
- **POS Invoice response**: If successful, displays the draft POS Invoice document name (e.g., `Draft POS invoice created: ABC-123`).

### 5. Supported Departments

- **Butchery** (default): Excel path includes `Njeremoto Butchery day end...`
- **Liquor**: Excel path includes `Njeremoto Liquor day end...`

To switch departments, modify the `dept` parameter in `main.js:102` or call `getShopDataFileName("Liquor")`.

## Excel File Format Requirements

- The Excel file must contain a worksheet with columns: `item`, `add`, `total`, and `end ` (note the **trailing space** after "end").
- The latest worksheet in the file is used (tabs are ordered by date/recency).
- `item` values in Excel must match ERPNext `item_code` values.
- Files are expected at: `${EXCEL_FILE_PATH}/${year}/${month}-${fullMonthName}/Njeremoto ${dept} day end ${fullMonthName} ${year}.xlsx`

## Troubleshooting

| Symptom | Likely Cause | Fix |
---|---|---
Script aborts with "There are paid POS invoices..." | Unconsolidated paid invoices exist in ERPNext | Consolidate them in ERPNext before re-running.
Empty console table (no items) | No matching items between ERP and Excel | Verify Excel `item` codes match ERPNext `item_code`; check price list has prices.
POS Invoice created with 0 items | No items had `sold > 0` | Check that `actual_qty > Excel "end "` for some items.
401/403 API errors | Invalid or improperly formatted `ERPNEXT_TOKEN` | Token must be `api_key:api_secret` format with correct permissions. |
Excel not found | `EXCEL_FILE_PATH` not set or wrong path | Set `EXCEL_FILE_PATH` in `.env` to the absolute path containing the Excel directories. |

## FAQ

**Q: Can I add more departments beyond Butchery and Liquor?**
A: Yes — modify `getShopDataFileName()` in `main.js` to support additional department names, and ensure the corresponding Excel files exist at the expected path.

**Q: What if my price list is not "Standard Selling"?**
A: Update the price list filter in `erpnext.js:94` from `"Standard Selling"` to your custom price list name.

**Q: Does this script update stock in ERPNext?**
A: Yes — the POS Invoice creation includes `update_stock: 1`, which will adjust Bin `actual_qty` based on the sold quantities.

**Q: Can I change the warehouse used for reconciliation?**
A: Yes — update the warehouse filter in `erpnext.js:59` from `"Stores - NEs"` to your target warehouse name.