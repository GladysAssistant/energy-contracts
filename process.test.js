const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

/**
 * Validates the structure of a price object
 * @param {Object} priceObj - Price object to validate
 * @param {string} contractType - Contract type for context in error messages
 * @returns {boolean} - True if valid, throws error if invalid
 */
function validatePriceObject(priceObj, contractType) {
  const requiredFields = [
    "contract",
    "price_type", 
    "currency",
    "start_date",
    "price"
  ];

  // Check required fields
  for (const field of requiredFields) {
    if (!(field in priceObj)) {
      throw new Error(`Missing required field '${field}' in ${contractType} price object`);
    }
  }

  // Validate field types and values
  if (typeof priceObj.contract !== "string") {
    throw new Error(`Invalid contract type in ${contractType}: expected string, got ${typeof priceObj.contract}`);
  }

  if (priceObj.price_type !== "consumption") {
    throw new Error(`Invalid price_type in ${contractType}: expected 'consumption', got '${priceObj.price_type}'`);
  }

  if (priceObj.currency !== "euro") {
    throw new Error(`Invalid currency in ${contractType}: expected 'euro', got '${priceObj.currency}'`);
  }

  if (typeof priceObj.price !== "number" || priceObj.price < 0) {
    throw new Error(`Invalid price in ${contractType}: expected positive number, got ${priceObj.price}`);
  }

  // Validate date format (ISO format YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(priceObj.start_date)) {
    throw new Error(`Invalid start_date format in ${contractType}: expected YYYY-MM-DD, got '${priceObj.start_date}'`);
  }

  if (priceObj.end_date && !dateRegex.test(priceObj.end_date)) {
    throw new Error(`Invalid end_date format in ${contractType}: expected YYYY-MM-DD or null, got '${priceObj.end_date}'`);
  }

  return true;
}

/**
 * Validates contract-specific requirements
 * @param {Array} prices - Array of price objects
 * @param {string} contractType - Contract type
 */
function validateContractSpecificRequirements(prices, contractType) {
  for (const price of prices) {
    switch (contractType) {
      case "edf-base":
        if (price.hour_slots !== null) {
          throw new Error(`Base contract should have hour_slots = null, got '${price.hour_slots}'`);
        }
        if (price.day_type !== null) {
          throw new Error(`Base contract should have day_type = null, got '${price.day_type}'`);
        }
        break;

      case "edf-peak-off-peak":
        if (!["TO_REPLACE_PEAK", "TO_REPLACE_OFF_PEAK"].includes(price.hour_slots)) {
          throw new Error(`Peak-off-peak contract should have hour_slots as 'TO_REPLACE_PEAK' or 'TO_REPLACE_OFF_PEAK', got '${price.hour_slots}'`);
        }
        if (price.day_type !== null) {
          throw new Error(`Peak-off-peak contract should have day_type = null, got '${price.day_type}'`);
        }
        break;

      case "edf-tempo":
        if (!["blue", "white", "red"].includes(price.day_type)) {
          throw new Error(`Tempo contract should have day_type as 'blue', 'white', or 'red', got '${price.day_type}'`);
        }
        if (typeof price.hour_slots !== "string" || price.hour_slots.length === 0) {
          throw new Error(`Tempo contract should have hour_slots as non-empty string, got '${price.hour_slots}'`);
        }
        break;

      default:
        console.warn(`Unknown contract type: ${contractType}`);
    }
  }
}

/**
 * Main test function
 */
function runTests() {
  console.log("🧪 Starting process.test.js");
  console.log("=" .repeat(50));

  try {
    // Step 1: Run the process.js script
    console.log("📋 Step 1: Running process.js script...");
    execSync("node process.js", { stdio: "inherit" });
    console.log("✅ process.js executed successfully");

    // Step 2: Check if contracts.json was created
    const contractsPath = path.join(__dirname, "contracts.json");
    if (!fs.existsSync(contractsPath)) {
      throw new Error("contracts.json file was not created");
    }
    console.log("✅ contracts.json file exists");

    // Step 3: Parse and validate JSON structure
    console.log("\n📋 Step 2: Validating contracts.json structure...");
    const contractsContent = fs.readFileSync(contractsPath, "utf-8");
    let contractsData;
    
    try {
      contractsData = JSON.parse(contractsContent);
    } catch (parseError) {
      throw new Error(`Invalid JSON format: ${parseError.message}`);
    }
    console.log("✅ Valid JSON format");

    // Step 4: Validate top-level structure
    if (typeof contractsData !== "object" || contractsData === null) {
      throw new Error("contracts.json should contain an object at root level");
    }

    const contractTypes = Object.keys(contractsData);
    console.log(`✅ Found ${contractTypes.length} contract types: ${contractTypes.join(", ")}`);

    // Step 5: Validate each contract type
    console.log("\n📋 Step 3: Validating contract data structure...");
    
    for (const contractType of contractTypes) {
      const contractData = contractsData[contractType];
      
      if (typeof contractData !== "object" || contractData === null) {
        throw new Error(`Contract ${contractType} should be an object`);
      }

      const subscribedPowers = Object.keys(contractData);
      console.log(`  📊 ${contractType}: ${subscribedPowers.length} subscribed power levels`);

      for (const power of subscribedPowers) {
        const prices = contractData[power];
        
        if (!Array.isArray(prices)) {
          throw new Error(`Subscribed power ${power} in ${contractType} should contain an array of prices`);
        }

        if (prices.length === 0) {
          throw new Error(`Subscribed power ${power} in ${contractType} should not be empty`);
        }

        // Validate each price object
        for (let i = 0; i < prices.length; i++) {
          try {
            validatePriceObject(prices[i], `${contractType}[${power}][${i}]`);
          } catch (error) {
            throw new Error(`Price validation failed for ${contractType}[${power}][${i}]: ${error.message}`);
          }
        }

        // Validate contract-specific requirements
        validateContractSpecificRequirements(prices, contractType);
      }
    }

    console.log("✅ All price objects have valid structure");

    // Step 6: Validate expected contract types exist
    console.log("\n📋 Step 4: Checking expected contract types...");
    const expectedContracts = ["edf-base", "edf-peak-off-peak", "edf-tempo"];
    
    for (const expected of expectedContracts) {
      if (!contractTypes.includes(expected)) {
        throw new Error(`Expected contract type '${expected}' not found`);
      }
    }
    console.log("✅ All expected contract types are present");

    // Step 7: Summary statistics
    console.log("\n📊 SUMMARY STATISTICS:");
    console.log("=" .repeat(30));
    
    let totalPrices = 0;
    for (const contractType of contractTypes) {
      const contractData = contractsData[contractType];
      let contractPrices = 0;
      
      for (const power of Object.keys(contractData)) {
        contractPrices += contractData[power].length;
      }
      
      totalPrices += contractPrices;
      console.log(`${contractType}: ${contractPrices} price entries`);
    }
    
    console.log(`Total: ${totalPrices} price entries across all contracts`);

    console.log("\n🎉 ALL TESTS PASSED!");
    console.log("=" .repeat(50));

  } catch (error) {
    console.error("\n❌ TEST FAILED:");
    console.error(error.message);
    console.log("=" .repeat(50));
    process.exit(1);
  }
}

// Run the tests
runTests();
