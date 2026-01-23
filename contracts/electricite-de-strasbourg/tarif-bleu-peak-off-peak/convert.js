const fs = require("fs");
const path = require("path");

/**
 * Converts a date string from DD/MM/YYYY format to ISO format (YYYY-MM-DD)
 * @param {string} dateStr - Date string in DD/MM/YYYY format
 * @returns {string} - Date string in ISO format
 */
function convertToIsoDate(dateStr) {
  if (!dateStr) return null;

  const [day, month, year] = dateStr.split("/");
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

/**
 * Reads and processes the Option_HPHC.csv file to return pricing data grouped by subscribed power
 * Creates both peak and off-peak prices for each time period
 * @returns {Object} - Object with subscribed power as keys and arrays of price objects as values
 */
function processPeakOffPeakOptions() {
  try {
    // Read the CSV file
    const csvPath = path.join(__dirname, "Option_HPHC.csv");
    const csvContent = fs.readFileSync(csvPath, "utf-8");

    // Parse CSV content
    const lines = csvContent.trim().split("\n");
    const headers = lines[0].split(";").map((header) => header.trim());

    // Find column indices
    const dateDebutIndex = headers.indexOf("DATE_DEBUT");
    const dateFinIndex = headers.indexOf("DATE_FIN");
    const pSouscriteIndex = headers.indexOf("P_SOUSCRITE");
    const partVariableHcTtcIndex = headers.indexOf("PART_VARIABLE_HC_TTC"); // Off-peak
    const partVariableHpTtcIndex = headers.indexOf("PART_VARIABLE_HP_TTC"); // Peak
    const partFixeTtcIndex = headers.indexOf("PART_FIXE_TTC");

    if (
      dateDebutIndex === -1 ||
      dateFinIndex === -1 ||
      pSouscriteIndex === -1 ||
      partVariableHcTtcIndex === -1 ||
      partVariableHpTtcIndex === -1 ||
      partFixeTtcIndex === -1
    ) {
      throw new Error("Required columns not found in CSV");
    }

    // Group data by subscribed power
    const result = {};

    // Process each data row (skip header)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue; // Skip empty lines

      const columns = line.split(";");

      const subscribedPower = columns[pSouscriteIndex];
      const startDate = columns[dateDebutIndex];
      const endDate = columns[dateFinIndex];
      const offPeakPriceStr = columns[partVariableHcTtcIndex];
      const peakPriceStr = columns[partVariableHpTtcIndex];
      const subscriptionPriceStr = columns[partFixeTtcIndex];

      // Skip rows with missing data
      if (
        !subscribedPower ||
        !startDate ||
        !offPeakPriceStr ||
        !peakPriceStr ||
        !subscriptionPriceStr
      )
        continue;

      // Convert prices from string to number, replace comma with dot, then multiply by 10000 for integer
      const offPeakPrice = Math.round(
        parseFloat(offPeakPriceStr.replace(",", ".")) * 10000
      );
      const peakPrice = Math.round(
        parseFloat(peakPriceStr.replace(",", ".")) * 10000
      );
      // Subscription price is yearly in euros, convert to monthly and multiply by 10000 for integer
      const subscriptionPrice = Math.round(
        (parseFloat(subscriptionPriceStr.replace(",", ".")) / 12) * 10000
      );

      // Convert dates to ISO format
      const startDateIso = convertToIsoDate(startDate);
      const endDateIso = endDate ? convertToIsoDate(endDate) : null;

      // Create off-peak price object
      const offPeakPriceObject = {
        contract: "peak-off-peak",
        price_type: "consumption",
        currency: "euro",
        start_date: startDateIso,
        end_date: endDateIso,
        price: offPeakPrice,
        hour_slots: "TO_REPLACE_OFF_PEAK",
        day_type: null,
      };

      // Create peak price object
      const peakPriceObject = {
        contract: "peak-off-peak",
        price_type: "consumption",
        currency: "euro",
        start_date: startDateIso,
        end_date: endDateIso,
        price: peakPrice,
        hour_slots: "TO_REPLACE_PEAK",
        day_type: null,
      };

      // Create subscription price object
      const subscriptionPriceObject = {
        contract: "peak-off-peak",
        price_type: "subscription",
        currency: "euro",
        start_date: startDateIso,
        end_date: endDateIso,
        price: subscriptionPrice,
        hour_slots: null,
        day_type: null,
      };

      // Initialize array for this subscribed power if it doesn't exist
      if (!result[subscribedPower]) {
        result[subscribedPower] = [];
      }

      // Add all price objects to the appropriate subscribed power group
      result[subscribedPower].push(offPeakPriceObject);
      result[subscribedPower].push(peakPriceObject);
      result[subscribedPower].push(subscriptionPriceObject);
    }

    return result;
  } catch (error) {
    console.error("Error processing Option_HPHC.csv:", error.message);
    throw error;
  }
}

module.exports = processPeakOffPeakOptions;
