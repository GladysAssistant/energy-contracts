const fs = require("fs");
const path = require("path");

const offPeakSlots =
  "00:00,00:30,01:00,01:30,02:00,02:30,03:00,03:30,04:00,04:30,05:00,05:30,22:00,22:30,23:00,23:30";
const peakSlots =
  "06:00,06:30,07:00,07:30,08:00,08:30,09:00,09:30,10:00,10:30,11:00,11:30,12:00,12:30,13:00,13:30,14:00,14:30,15:00,15:30,16:00,16:30,17:00,17:30,18:00,18:30,19:00,19:30,20:00,20:30,21:00,21:30";

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
 * Reads and processes the Option_Tempo.csv file to return pricing data grouped by subscribed power
 * Creates 6 prices for each time period: Blue/White/Red days, each with peak/off-peak pricing
 * @returns {Object} - Object with subscribed power as keys and arrays of price objects as values
 */
function processTempoOptions() {
  try {
    // Read the CSV file
    const csvPath = path.join(__dirname, "Option_Tempo.csv");
    const csvContent = fs.readFileSync(csvPath, "utf-8");

    // Parse CSV content
    const lines = csvContent.trim().split("\n");
    const headers = lines[0].split(";").map((header) => header.trim());

    // Find column indices
    const dateDebutIndex = headers.indexOf("DATE_DEBUT");
    const dateFinIndex = headers.indexOf("DATE_FIN");
    const pSouscriteIndex = headers.indexOf("P_SOUSCRITE");

    // Blue day prices (Bleu)
    const partVariableHcBleuTtcIndex = headers.indexOf(
      "PART_VARIABLE_HCBleu_TTC"
    );
    const partVariableHpBleuTtcIndex = headers.indexOf(
      "PART_VARIABLE_HPBleu_TTC"
    );

    // White day prices (Blanc)
    const partVariableHcBlancTtcIndex = headers.indexOf(
      "PART_VARIABLE_HCBlanc_TTC"
    );
    const partVariableHpBlancTtcIndex = headers.indexOf(
      "PART_VARIABLE_HPBlanc_TTC"
    );

    // Red day prices (Rouge)
    const partVariableHcRougeTtcIndex = headers.indexOf(
      "PART_VARIABLE_HCRouge_TTC"
    );
    const partVariableHpRougeTtcIndex = headers.indexOf(
      "PART_VARIABLE_HPRouge_TTC"
    );

    if (
      dateDebutIndex === -1 ||
      dateFinIndex === -1 ||
      pSouscriteIndex === -1 ||
      partVariableHcBleuTtcIndex === -1 ||
      partVariableHpBleuTtcIndex === -1 ||
      partVariableHcBlancTtcIndex === -1 ||
      partVariableHpBlancTtcIndex === -1 ||
      partVariableHcRougeTtcIndex === -1 ||
      partVariableHpRougeTtcIndex === -1
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

      // Get all price strings
      const blueOffPeakStr = columns[partVariableHcBleuTtcIndex];
      const bluePeakStr = columns[partVariableHpBleuTtcIndex];
      const whiteOffPeakStr = columns[partVariableHcBlancTtcIndex];
      const whitePeakStr = columns[partVariableHpBlancTtcIndex];
      const redOffPeakStr = columns[partVariableHcRougeTtcIndex];
      const redPeakStr = columns[partVariableHpRougeTtcIndex];

      // Skip rows with missing essential data or empty price data
      if (
        !subscribedPower ||
        !startDate ||
        !blueOffPeakStr ||
        !bluePeakStr ||
        !whiteOffPeakStr ||
        !whitePeakStr ||
        !redOffPeakStr ||
        !redPeakStr
      )
        continue;

      // Convert prices from string to number, replace comma with dot, then multiply by 10000 for integer
      const blueOffPeakPrice = Math.round(
        parseFloat(blueOffPeakStr.replace(",", ".")) * 10000
      );
      const bluePeakPrice = Math.round(
        parseFloat(bluePeakStr.replace(",", ".")) * 10000
      );
      const whiteOffPeakPrice = Math.round(
        parseFloat(whiteOffPeakStr.replace(",", ".")) * 10000
      );
      const whitePeakPrice = Math.round(
        parseFloat(whitePeakStr.replace(",", ".")) * 10000
      );
      const redOffPeakPrice = Math.round(
        parseFloat(redOffPeakStr.replace(",", ".")) * 10000
      );
      const redPeakPrice = Math.round(
        parseFloat(redPeakStr.replace(",", ".")) * 10000
      );

      // Convert dates to ISO format
      const startDateIso = convertToIsoDate(startDate);
      const endDateIso = endDate ? convertToIsoDate(endDate) : null;

      // Create price objects for all 6 combinations
      const priceObjects = [
        // Blue day prices
        {
          contract: "edf-tempo",
          price_type: "consumption",
          currency: "euro",
          start_date: startDateIso,
          end_date: endDateIso,
          price: blueOffPeakPrice,
          hour_slots: offPeakSlots,
          day_type: "blue",
        },
        {
          contract: "edf-tempo",
          price_type: "consumption",
          currency: "euro",
          start_date: startDateIso,
          end_date: endDateIso,
          price: bluePeakPrice,
          hour_slots: peakSlots,
          day_type: "blue",
        },
        // White day prices
        {
          contract: "edf-tempo",
          price_type: "consumption",
          currency: "euro",
          start_date: startDateIso,
          end_date: endDateIso,
          price: whiteOffPeakPrice,
          hour_slots: offPeakSlots,
          day_type: "white",
        },
        {
          contract: "edf-tempo",
          price_type: "consumption",
          currency: "euro",
          start_date: startDateIso,
          end_date: endDateIso,
          price: whitePeakPrice,
          hour_slots: peakSlots,
          day_type: "white",
        },
        // Red day prices
        {
          contract: "edf-tempo",
          price_type: "consumption",
          currency: "euro",
          start_date: startDateIso,
          end_date: endDateIso,
          price: redOffPeakPrice,
          hour_slots: offPeakSlots,
          day_type: "red",
        },
        {
          contract: "edf-tempo",
          price_type: "consumption",
          currency: "euro",
          start_date: startDateIso,
          end_date: endDateIso,
          price: redPeakPrice,
          hour_slots: peakSlots,
          day_type: "red",
        },
      ];

      // Initialize array for this subscribed power if it doesn't exist
      if (!result[subscribedPower]) {
        result[subscribedPower] = [];
      }

      // Add all 6 price objects to the appropriate subscribed power group
      result[subscribedPower].push(...priceObjects);
    }

    return result;
  } catch (error) {
    console.error("Error processing Option_Tempo.csv:", error.message);
    throw error;
  }
}

module.exports = processTempoOptions;
