import dotenv from "dotenv";
dotenv.config();

import { readFileSync } from "fs";
import { read, utils } from "xlsx";
import puppeteer from "puppeteer";
import path, { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const ERPNEXT_EMAIL = process.env.ERPNEXT_EMAIL;
const ERPNEXT_PASSWORD = process.env.ERPNEXT_PASSWORD;
const ERPNEXT_TOKEN = process.env.ERPNEXT_TOKEN;
const ERPNEXT_URL = "https://njeremoto.jh.erpnext.com";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const downloadPath = path.resolve(__dirname, "downloads");
console.log(`Download path: ${downloadPath}`);

/**
 * @typedef {{
 *  'Barcode': string,
 *  'Has Item Scanned': string,
 *  'Item Code': string,
 *  'Item Name': string,
 *  'Item Group': string,
 *  'Warehouse': string,
 *  'Quantity': string,
 *  'Valuation Rate': string,
 *  'Amount': string,
 *  'Allow Zero Valuation Rate': string,
 *  'Use Serial No / Batch Fields': string,
 *  'Reconcile All Serial Nos / Batches': string,
 *  'Serial / Batch Bundle': string,
 *  'Current Serial / Batch Bundle': string,
 *  'Serial No': string,
 *  'Batch No': string,
 *  'Current Qty': string,
 *  'Current Amount': string,
 *  'Current Valuation Rate': string,
 *  'Current Serial No': string,
 *  'Quantity Difference': string,
 *  'Amount Difference': string
 * }} ErpStockData
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
 * @typedef {{
 *  item: string,
 *  start: number,
 *  end: number,
 *  sold: number,
 * }} SoldItem
 */

/**
 * @typedef {{
 *  unitPrice: number,
 *  total: number,
 * }} Price
 */

/**
 * @typedef { SoldItem & Price } ItemPrice
 */

/**
 * @param {string} erpStockFileName
 * @returns {Array<ErpStockData>}
 */
function fetchErpData(erpStockFileName) {
  const erpStockFile = readFileSync(erpStockFileName, "utf-8");

  const erpStockData = erpStockFile
    .split("\n")
    .map((line) => line.split(",").map((cell) => cell.replaceAll('"', "")));
  erpStockData.splice(0, 1);
  erpStockData.splice(1, 5);

  const formattedErpStockData = [];

  for (let i = 1; i < erpStockData.length; i++) {
    const obj = {};

    for (let j = 0; j < erpStockData[0].length; j++) {
      obj[erpStockData[0][j]] = erpStockData[i][j];
    }

    formattedErpStockData.push(obj);
  }

  return formattedErpStockData;
}

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
 * @param {Array<ErpStockData>} formattedErpStockData
 * @param {Array<ShopData>} filteredShopData
 * @returns {Array<SoldItem>}
 */
function processData(formattedErpStockData, filteredShopData) {
  const finalData = [];

  for (const erpData of formattedErpStockData) {
    const shopItem = filteredShopData.find(
      (item) => item["item"] === erpData["Item Code"]
    );

    if (shopItem) {
      finalData.push({
        item: erpData["Item Name"],
        start: Number.parseFloat(erpData["Quantity"]),
        end: shopItem["end "],
        sold: Number.parseFloat(erpData["Quantity"]) - shopItem["end "],
      });
    }
  }

  const soldItems = finalData.filter((item) => item.sold !== 0);
  console.table(soldItems);

  return soldItems;
}

async function downloadErpCsvFile() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  if (fs.existsSync(path.resolve(downloadPath, "Items.csv"))) {
    console.log("Clearing old downloads...");
    fs.unlinkSync(path.resolve(downloadPath, "Items.csv"));
  }

  const client = await page.createCDPSession();
  await client.send("Page.setDownloadBehavior", {
    behavior: "allow",
    downloadPath: downloadPath,
  });

  await page.setViewport({ width: 1080, height: 1024 });

  await page.goto(`${ERPNEXT_URL}/app/stock-reconciliation`);

  await page.locator("#login_email").fill(ERPNEXT_EMAIL);
  await page.locator("#login_password").fill(ERPNEXT_PASSWORD);

  await Promise.all([
    page.waitForNavigation(),
    page.locator('.page-card-actions button[type="submit"]').click(),
  ]);

  await page.locator('button[data-label="Add Stock Reconciliation"]').click();

  while (
    (await page.evaluate(() => {
      return document.querySelector('input[data-fieldname="company"]').value;
    })) !== "Njeremoto Enterprises"
  ) {
    await page
      .locator('input[data-fieldname="company"]')
      .fill("Njeremoto Enterprises");

    await sleep(1000);
    await page.keyboard.press("Enter");
  }

  await page
    .locator('input[data-fieldname="set_warehouse"]')
    .fill("Stores - NEs");

  await sleep(1000);
  await page.keyboard.press("Enter");

  await page
    .locator('button[data-label="Fetch%20Items%20from%20Warehouse"]')
    .click();

  await page.locator('input[data-fieldname="warehouse"]').fill("Stores - NEs");
  await sleep(2000);

  await page.keyboard.press("Enter");
  await sleep(1000);

  await page.locator('input[data-fieldname="ignore_empty_stock"]').click();

  await page
    .locator(
      'button[type="button"][class="btn btn-primary btn-sm btn-modal-primary"]'
    )
    .click();

  await sleep(2000);
  await page
    .locator('button[class="grid-download btn btn-xs btn-secondary"')
    .click();

  await sleep(1000);
  await browser.close();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * @param {Array<ItemPrice>} itemPrices
 */
async function enterSales(itemPrices) {
  console.log("Entering sales...");
  const headers = {
    Authorization: `token ${ERPNEXT_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const { data } = await fetch(`${ERPNEXT_URL}/api/v2/document/POS Invoice`, {
    headers,
    method: "POST",
    body: JSON.stringify({
      company: "Njeremoto Enterprises",
      customer: "Butchery Customer",
      pos_profile: "Enterprise Butchery POS",
      currency: "USD",
      items: itemPrices.map((item) => ({
        item_code: item.item,
        qty: item.sold,
        warehouse: "Stores - NEs",
      })),
      payments: [
        {
          mode_of_payment: "Cash",
          amount: itemPrices.reduce((acc, item) => acc + item.total, 0),
        },
      ],
    }),
  }).then((res) => res.json());
  console.log(`Draft POS invoice created: ${data.name}`);
}

/**
 *
 * @param {'grocery' | 'butchery'} dept
 * @returns
 */
function getShopDataFileName(dept = "grocery") {
  const date = new Date();

  const month = date.getMonth() + 1;
  const year = date.getFullYear();
  const fullMonthName = date.toLocaleString("default", { month: "long" });

  const addon = dept === "grocery" ? "" : " Butchery";
  const shopDataFileName = `G:/My Drive/Njeremoto Shop/Operations/${year}/${month}-${fullMonthName}/Njeremoto${addon} day end ${fullMonthName} ${year}.xlsx`;

  return shopDataFileName;
}

/**
 * @param {Array<SoldItem>} soldItems
 * @returns {Promise<ItemPrice[]>}
 */
async function getItemPrices(soldItems) {
  const headers = {
    Authorization: `token ${ERPNEXT_TOKEN}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  const itemCodes = soldItems.map((item) => item.item);
  const fields = [
    "name",
    "item_code",
    "price_list",
    "currency",
    "uom",
    "price_list_rate",
  ];
  const filters = [
    ["Item Price", "price_list", "=", "Standard Selling"],
    ["Item Price", "item_code", "in", itemCodes],
  ];

  const qs = new URLSearchParams({
    fields: JSON.stringify(fields),
    filters: JSON.stringify(filters),
    limit_page_length: "1000",
  });

  const { data } = await fetch(
    `${ERPNEXT_URL}/api/v2/document/Item Price?${qs}`,
    {
      headers,
    }
  ).then((res) => res.json());

  /**
   * @type {Array<ItemPrice>}
   */
  return soldItems.map((item) => {
    const price = data.find((entry) => entry.item_code === item.item);

    return {
      item: item.item,
      start: item.start,
      end: item.end,
      sold: item.sold,
      unitPrice: price.price_list_rate,
      total: price.price_list_rate * item.sold,
    };
  });
}

/**
 *
 * @param {ErpStockData[]} erpStockData
 * @param {ShopData[]} shopData
 */
function getUnmapedItems(erpStockData, shopData) {
  return shopData.filter((shopItem) => {
    return !erpStockData.find(
      (erpItem) => erpItem["Item Code"] === shopItem["item"]
    );
  });
}

async function main() {
  await downloadErpCsvFile();

  const erpStockFileName = path.resolve(downloadPath, "Items.csv");
  const erpStockData = fetchErpData(erpStockFileName);

  const shopData = [...fetchShopData(getShopDataFileName("butchery"))].sort(
    (a, b) => (a["item"] > b["item"] ? 1 : -1)
  );

  console.log("Unmapped items:");
  console.table(
    getUnmapedItems(erpStockData, shopData).map((item) => item["item"])
  );

  const processedData = processData(erpStockData, shopData);
  // const itemPrices = await getItemPrices(processedData);
  // await enterSales(itemPrices);
}

await main();
