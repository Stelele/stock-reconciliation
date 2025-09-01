import { readFileSync } from "fs"
import { read, utils } from "xlsx"

/**
 * @type {string}
 */
const erpStockFileName = "./Items.csv"

/**
 * @type {string}
 */
const shopFileName = "day_end.xlsx"

/**
 * @type {string}
 */
const erpStockFile = readFileSync(erpStockFileName, "utf-8")
const shopFile = read(readFileSync(shopFileName).buffer)

const latestSheetName = shopFile.SheetNames[shopFile.SheetNames.length - 1]
console.log(`Processing sheet: ${latestSheetName}`)
const range = utils.decode_range(shopFile.Sheets[latestSheetName]["!ref"])
range.s.r = 2
shopFile.Sheets[latestSheetName]["!ref"] = utils.encode_range(range)
const shopData = utils.sheet_to_json(shopFile.Sheets[latestSheetName])

/**
 * @type {Array<{
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
 * }>}
 */
const filteredShopData = shopData
    .filter(item => "add" in item && "total" in item)
    .sort((a,b) => a["item"] > b["item"] ? 1 : -1)

const erpStockData = erpStockFile.split("\n").map(line => line.split(",").map(cell => cell.replaceAll("\"", "")))
erpStockData.splice(0, 1)
erpStockData.splice(1, 5)

/**
 * @type {Array<{
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
 * }>}
 */
const formattedErpStockData = []

for (let i = 1; i < erpStockData.length; i++) {
    const obj = {}

    for(let j = 0; j < erpStockData[0].length; j++) {
        obj[erpStockData[0][j]] = erpStockData[i][j]    
    }

    formattedErpStockData.push(obj)
}

/**
 * @type {Array<{
 *  item: string,
 *  start: number,
 *  end: number,
 *  sold: number,
 * }>}
 */
const finalData = []

for(const erpData of formattedErpStockData) {
    const shopItem = filteredShopData.find(item => item["item"] === erpData["Item Code"])

    if(shopItem) {
        finalData.push({
            item: erpData["Item Code"],
            start: Number.parseFloat(erpData["Quantity"]),
            end: shopItem["end "],
            sold:  Number.parseFloat(erpData["Quantity"]) - shopItem["end "],
        })
    }
}

const soldItems = finalData.filter(item => item.sold > 0)
console.table(soldItems)