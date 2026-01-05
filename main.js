import dotenv from "dotenv";
dotenv.config();

import { readFileSync } from "fs";
import { read, utils } from "xlsx";
import {
  getErpStockData,
  getItemPrices,
  enterSales,
  getPaidPOSInvoices,
} from "./erpnext.js";

/**
 * @typedef { import("./erpnext.js").ErpStockEntry } ErpStockEntry
 * @typedef { import("./erpnext.js").ItemPrice } ItemPrice
 * @typedef { import("./erpnext.js").SoldItem } SoldItem
 * @typedef { import("./erpnext.js").Price } Price
 */

/**
 * @typedef {{
 *  item: string,
 *  start: number,
 *  add: number,
 *  total: number,
 *  'end ': number,
 *  Sold: number,
 *  ' Selling Price ': number,
 *  ' Order Price ': number,
 *  ' selling amount ': number,
 *  ' Order Amount ': number,
 *  ' contribution ': number,
 * }} ShopData
 */

/**
 * @typedef {{
 *  item: string,
 *  start: number,
 *  end: number,
 *  sold: number,
 * }} StockItemSummary
 */

/**
 * @param {string} [shopDataFileName]
 * @returns {Array<ShopData>}
 */
function fetchShopData(shopDataFileName) {
  const shopFile = read(readFileSync(shopDataFileName).buffer);

  const latestSheetName = shopFile.SheetNames[shopFile.SheetNames.length - 1];
  console.log(`Processing shop data file: ${shopDataFileName}`);
  console.log(`Processing sheet: ${latestSheetName}`);

  const range = utils.decode_range(shopFile.Sheets[latestSheetName]["!ref"]);
  range.s.r = 2;
  shopFile.Sheets[latestSheetName]["!ref"] = utils.encode_range(range);

  const shopData = utils.sheet_to_json(shopFile.Sheets[latestSheetName]);

  return shopData
    .filter((item) => "add" in item && "total" in item)
    .sort((a, b) => (a["item"] > b["item"] ? 1 : -1));
}

/**
 * @param {Array<ErpStockEntry>} formattedErpStockData
 * @param {Array<ShopData>} filteredShopData
 * @returns {Array<SoldItem>}
 */
function processData(formattedErpStockData, filteredShopData) {
  const finalData = [];

  for (const erpData of formattedErpStockData) {
    const shopItem = filteredShopData.find(
      (item) => item["item"] === erpData["item_code"],
    );

    if (shopItem) {
      finalData.push({
        item: erpData["item_code"],
        start: erpData["actual_qty"],
        end: shopItem["end "],
        sold: erpData["actual_qty"] - shopItem["end "],
      });
    }
  }

  const soldItems = finalData.filter((item) => item.sold !== 0);
  console.table(soldItems);

  return soldItems;
}

/**
 *
 * @param {'Butchery' | 'Liquor'} dept
 * @returns
 */
function getShopDataFileName(dept = "Butchery" | "Liquor") {
  const date = new Date();

  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const fullMonthName = date.toLocaleString("default", { month: "long" });

  const shopDataFileName = `G:/My Drive/Njeremoto Shop/Operations/${year}/${month}-${fullMonthName}/Njeremoto ${dept} day end ${fullMonthName} ${year}.xlsx`;

  return shopDataFileName;
}

async function main() {
  const posOpeningEntries = await getPaidPOSInvoices();
  if (posOpeningEntries.length > 0) {
    console.error(`
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
There are paid POS invoices in ERPNext that have not been consolidated.
Please consolidate them before running this script to prevent double-invoicing.
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!`);
    return;
  }

  const erpData = await getErpStockData();
  const shopData = [
    ...fetchShopData(getShopDataFileName("Butchery")),
    ...fetchShopData(getShopDataFileName("Liquor")),
  ].sort((a, b) => (a["item"] > b["item"] ? 1 : -1));

  const processedData = processData(erpData, shopData);
  const itemPrices = await getItemPrices(processedData);

  await enterSales(itemPrices.filter((item) => item.sold > 0));
}

await main();
