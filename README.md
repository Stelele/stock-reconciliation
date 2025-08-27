# Stock Recalculation Script

This project contains a simple script designed to help reconcile stock values between your ERPNext system and your physical inventory. Its main purpose is to identify discrepancies in product sales that were not recorded through the Point of Sale (POS) module.

## How It Works

- **Data Sources:**
  - The script reads stock data exported from ERPNext (system stock values).
  - It also reads your physical stock count (as recorded during a stock take).
- **Comparison:**
  - The script compares the ERPNext stock values with the physical stock values for each product.
- **Discrepancy Detection:**
  - If the physical stock is less than the ERPNext stock, the difference is considered as products sold but not recorded in the POS module.
- **Output:**
  - The script outputs a list of products and the number of units sold that were not punched in the POS.

## Files

- `main.js`: The main script that performs the stock reconciliation.
- `Items.csv`: Contains the list of items/products and their stock values (format may vary based on your export).
- `day_end.xlsx`: May contain additional data for daily reconciliation (if used).

## Usage

1. Export your stock data from ERPNext and your physical stock count into the provided CSV/Excel files.
2. Run the script using Node.js:
   ```powershell
   node main.js
   ```
3. Review the output to see which products have discrepancies.

## Requirements

- Node.js installed on your system.
- Ensure your data files (`Items.csv`, `day_end.xlsx`) are in the same directory as `main.js`.

## Customization

- You may need to adjust the script to match the exact format of your ERPNext and physical stock data exports.

## License

This project is licensed under the MIT License.
