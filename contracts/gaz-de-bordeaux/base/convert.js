const fs = require("fs");
const path = require("path");

/**
 * Reads and processes the contract.json and subscription.json files to return pricing data for all subscribed power levels
 * @returns {Object} - Object with subscribed power as keys and arrays of price objects as values
 */
function processBaseOptions() {
  try {
    // Read the contract.json file (consumption prices)
    const contractPath = path.join(__dirname, "contract.json");
    const contractContent = fs.readFileSync(contractPath, "utf-8");
    const contractData = JSON.parse(contractContent);

    // Read the subscription.json file (subscription prices per power level)
    const subscriptionPath = path.join(__dirname, "subscription.json");
    const subscriptionContent = fs.readFileSync(subscriptionPath, "utf-8");
    const subscriptionData = JSON.parse(subscriptionContent);

    // Get power levels from subscription data
    const subscribedPowers = Object.keys(subscriptionData);

    // Create result object with pricing data for each subscribed power
    const result = {};

    subscribedPowers.forEach((power) => {
      // Add consumption prices (same for all power levels)
      const consumptionPrices = contractData.map((priceEntry) => ({
        ...priceEntry,
      }));

      // Add subscription prices for this power level
      const subscriptionPrices = subscriptionData[power] || [];

      result[power] = [...consumptionPrices, ...subscriptionPrices];
    });

    return result;
  } catch (error) {
    console.error("Error processing contract.json:", error.message);
    throw error;
  }
}

module.exports = processBaseOptions;
