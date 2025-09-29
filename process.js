const fs = require("fs");
const path = require("path");

/**
 * Recursively finds all convert.js files in the contracts directory
 * @param {string} dir - Directory to search in
 * @param {Array} results - Array to store results
 * @returns {Array} - Array of convert.js file paths
 */
function findConvertFiles(dir, results = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Recursively search subdirectories
      findConvertFiles(filePath, results);
    } else if (file === "convert.js") {
      results.push(filePath);
    }
  }

  return results;
}

/**
 * Generates a key from the file path
 * @param {string} filePath - Full path to the convert.js file
 * @param {string} contractsDir - Base contracts directory path
 * @returns {string} - Key for the result object
 */
function generateKey(filePath, contractsDir) {
  // Get relative path from contracts directory
  const relativePath = path.relative(contractsDir, filePath);
  // Remove the 'convert.js' filename and get the directory path
  const dirPath = path.dirname(relativePath);
  // Replace path separators with dashes
  return dirPath.replace(/[/\\]/g, "-");
}

/**
 * Main function to process all convert.js files
 */
function processAllContracts() {
  const contractsDir = path.join(__dirname, "contracts");
  const convertFiles = findConvertFiles(contractsDir);

  const results = {};

  for (const filePath of convertFiles) {
    try {
      console.log(`Processing: ${filePath}`);

      // Generate key from path
      const key = generateKey(filePath, contractsDir);

      // Require and execute the convert function
      const convertFunction = require(filePath);
      const data = convertFunction();

      results[key] = data;

      console.log(`✓ Successfully processed ${key}`);
    } catch (error) {
      console.error(`✗ Error processing ${filePath}:`, error.message);
    }
  }

  return results;
}

// Run the processing
const allContracts = processAllContracts();

// Write results to contracts.json file
const outputPath = path.join(__dirname, "contracts.json");
fs.writeFileSync(outputPath, JSON.stringify(allContracts, null, 2));

console.log('\n=== FINAL RESULTS ===');
console.log(`✓ Contracts data written to ${outputPath}`);
console.log(`Total contract types processed: ${Object.keys(allContracts).length}`);
