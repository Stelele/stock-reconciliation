import dotenv from "dotenv";
dotenv.config();

const ERPNEXT_TOKEN = process.env.ERPNEXT_TOKEN;
const ERPNEXT_URL = process.env.ERPNEXT_URL;
const headers = {
  Authorization: `token ${ERPNEXT_TOKEN}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};

/**
 * @typedef {{
 *   name: string,
 *   item_code: string,
 *   warehouse: string,
 *   actual_qty: number,
 *   reserved_qty: number,
 *   projected_qty: number,
 *   valuation_rate: number,
 * }} ErpStockEntry
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
 * @returns {Promise<ErpStockEntry[]>}
 */
export async function getErpStockData() {
  const fields = [
    "name",
    "item_code",
    "warehouse",
    "actual_qty",
    "reserved_qty",
    "projected_qty",
    "valuation_rate",
  ];
  const filters = [
    ["Bin", "warehouse", "=", "Stores - NEs"],
    ["Bin", "actual_qty", "!=", 0],
  ];

  const qs = new URLSearchParams({
    fields: JSON.stringify(fields),
    filters: JSON.stringify(filters),
    limit_page_length: "1000",
  });

  const { data } = await fetch(`${ERPNEXT_URL}/api/v2/document/Bin?${qs}`, {
    headers,
  }).then((res) => res.json());

  return data;
}

/**
 * @param {Array<SoldItem>} soldItems
 * @returns {Promise<ItemPrice[]>}
 */
export async function getItemPrices(soldItems) {
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
    { headers }
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
 * @param {Array<ItemPrice>} itemPrices
 */
export async function enterSales(itemPrices) {
  console.log("Entering sales...");

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
