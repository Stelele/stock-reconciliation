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

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

/**
 * Fetch with retries on network errors (e.g. dropped sockets) and transient
 * HTTP statuses (429, 5xx). Waits for a short backoff between attempts and
 * rethrows the last error once the retry budget is exhausted. Non-retriable
 * HTTP errors (4xx) throw immediately with the response body in the message,
 * so callers always receive either an ok Response or an exception.
 * Note: retrying a non-idempotent request (POST) can duplicate a document if
 * the first attempt actually succeeded server-side — accepted at the
 * enterSales call site.
 * @param {string} url
 * @param {RequestInit} [options]
 * @returns {Promise<Response>}
 */
async function fetchWithRetry(url, options = {}) {
  /** @type {Error | undefined} */
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const code = /** @type {{ cause?: { code?: string } }} */ (lastError)
        ?.cause?.code;
      console.log(
        `Error${code ? ` (${code})` : ""}, retrying ${attempt}/${MAX_RETRIES}: ${url}`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAY_MS * attempt),
      );
    }

    /** @type {Response} */
    let response;
    try {
      response = await fetch(url, options);
    } catch (error) {
      lastError = /** @type {Error} */ (error);
      continue;
    }

    if (response.ok) {
      return response;
    }

    // 429 and 5xx are usually transient — treat them like network errors.
    if (response.status === 429 || response.status >= 500) {
      lastError = new Error(`HTTP ${response.status}`);
      continue;
    }

    // Other client errors will not fix themselves on a retry.
    const body = await response.text();
    throw new Error(`ERPNext returned HTTP ${response.status}: ${body}`);
  }

  throw lastError;
}

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

  const { data: openingBalances } = await fetchWithRetry(
    `${ERPNEXT_URL}/api/v2/document/Bin?${qs}`,
    {
      headers,
    },
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

  const { data } = await fetchWithRetry(
    `${ERPNEXT_URL}/api/v2/document/Item Price?${qs}`,
    { headers },
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

  const response = await fetchWithRetry(
    `${ERPNEXT_URL}/api/v2/document/POS Invoice`,
    {
      headers,
      method: "POST",
      body: JSON.stringify({
        company: "Njeremoto Enterprises",
        customer: "Reconciliation Customer",
        pos_profile: "Enterprise POS",
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
            amount: Math.ceil(
              itemPrices.reduce((acc, item) => acc + item.total, 0),
            ),
          },
        ],
      }),
    },
  ).then((res) => res.json());

  console.log(`Draft POS invoice created: ${response.data.name}`);
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

  const { data: posInvoices } = await fetchWithRetry(
    `${ERPNEXT_URL}/api/v2/document/POS Invoice?${qs}`,
    {
      headers,
    },
  ).then((res) => res.json());

  return posInvoices;
}
