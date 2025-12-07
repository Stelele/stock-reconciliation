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
  const binFields = [
    "name",
    "item_code",
    "warehouse",
    "actual_qty",
    "reserved_qty",
    "projected_qty",
    "valuation_rate",
  ];
  const binFilters = [
    ["Bin", "warehouse", "=", "Stores - NEs"],
    ["Bin", "actual_qty", "!=", 0],
  ];

  const qs = new URLSearchParams({
    fields: JSON.stringify(binFields),
    filters: JSON.stringify(binFilters),
    limit_page_length: 0,
  });

  const { data: openingBalances } = await fetch(
    `${ERPNEXT_URL}/api/v2/document/Bin?${qs}`,
    {
      headers,
    }
  ).then((res) => res.json());

  return openingBalances;
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
  if (itemPrices.length === 0) {
    console.log("No sales to enter");
    return;
  }

  const response = await fetch(`${ERPNEXT_URL}/api/v2/document/POS Invoice`, {
    headers,
    method: "POST",
    body: JSON.stringify({
      company: "Njeremoto Enterprises",
      customer: "Butchery Customer",
      pos_profile: "Enterprise Butchery POS",
      currency: "USD",
      update_stock: 1,
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

  if (response.data) {
    console.log(`Draft POS invoice created: ${response.data.name}`);
  } else {
    console.error(`Error creating POS invoice: ${response.status}`);
    console.error(response);
  }
}

export async function getPaidPOSInvoices() {
  const posOpeningFields = ["name", "status"];
  const posOpeningFilters = [
    ["POS Invoice", "docstatus", "=", "1"],
    ["POS Invoice", "company", "=", "Njeremoto Enterprises"],
    ["POS Invoice", "status", "=", "Paid"],
  ];

  const qs = new URLSearchParams({
    fields: JSON.stringify(posOpeningFields),
    filters: JSON.stringify(posOpeningFilters),
    limit_page_length: 0,
  });

  const { data: posInvoices } = await fetch(
    `${ERPNEXT_URL}/api/v2/document/POS Invoice?${qs}`,
    {
      headers,
    }
  ).then((res) => res.json());

  return posInvoices;
}
