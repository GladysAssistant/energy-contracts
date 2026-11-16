const fs = require("fs");
const os = require("os");
const path = require("path");
const { execSync } = require("child_process");
const { readMetadata } = require("./process-v2");

// -----------------------------------------------------------------------------
// Tests of process-v2.js and contracts-v2.json, as process.test.js tests
// process.js and contracts.json. `npm test` runs both.
// -----------------------------------------------------------------------------

/**
 * The engine adds up every fixed component whose conditions match: two
 * components of the same charge (`subscription`, `subscription-<start>`, …)
 * must never cover the same date, or the contract pays it twice.
 */
function checkFixedComponentsDoNotOverlap(t, where) {
  const byCharge = {};
  for (const c of t.tariff.components.filter((c) => c.kind === "fixed")) {
    const charge = c.key.replace(/-\d{4}-\d{2}-\d{2}$/, "");
    const dates = (c.when && c.when.dates) || {};
    (byCharge[charge] = byCharge[charge] || []).push({
      key: c.key,
      from: dates.from || "0000-00-00",
      to: dates.to || "9999-99-99",
    });
  }
  for (const [charge, ranges] of Object.entries(byCharge)) {
    ranges.sort((a, b) => (a.from < b.from ? -1 : 1));
    for (let i = 1; i < ranges.length; i += 1) {
      if (ranges[i - 1].to >= ranges[i].from) {
        throw new Error(
          `${where}: "${ranges[i - 1].key}" and "${ranges[i].key}" both charge ${charge} on ${ranges[i].from}`,
        );
      }
    }
  }
}

/**
 * Checks contracts-v2.json (process-v2.js): one template per contract and power,
 * the same keys as contracts.json, and the names of the template.json files.
 * @param {Object} contractsData - The content of contracts.json
 */
function validateCatalogueV2(contractsData) {
  console.log("\n📋 Validating contracts-v2.json...");
  const v2Path = path.join(__dirname, "contracts-v2.json");
  if (!fs.existsSync(v2Path)) {
    throw new Error("contracts-v2.json file was not created");
  }
  const v2 = JSON.parse(fs.readFileSync(v2Path, "utf-8"));
  if (!Array.isArray(v2.templates) || !Array.isArray(v2.calendars)) {
    throw new Error("contracts-v2.json must contain templates and calendars arrays");
  }

  // One template per contract key and subscribed power, nothing more.
  const expected = Object.entries(contractsData).flatMap(([key, powers]) =>
    Object.keys(powers)
      .filter((power) => powers[power].length > 0)
      .map((power) => `${key} ${power}`),
  );
  const actual = v2.templates.map((t) => `${t.key} ${t.variant}`);
  if (JSON.stringify([...expected].sort()) !== JSON.stringify([...actual].sort())) {
    throw new Error("contracts-v2.json does not list one template per contract and power");
  }

  for (const t of v2.templates) {
    const where = `${t.key} ${t.variant} kVA`;
    for (const field of ["key", "variant", "name", "country", "currency", "timezone", "pricing_mode", "version", "tariff"]) {
      if (t[field] === undefined) {
        throw new Error(`${where}: missing "${field}" in contracts-v2.json`);
      }
    }
    if (typeof t.name.en !== "string" || Object.values(t.name).some((n) => n.length > 64)) {
      throw new Error(`${where}: the name needs an "en" text of 64 characters at most`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t.version)) {
      throw new Error(`${where}: the version must be the date of the latest prices`);
    }
    if (t.tariff.tariff_version !== 1 || !Array.isArray(t.tariff.components)) {
      throw new Error(`${where}: invalid tariff`);
    }
    const energy = t.tariff.components.find((c) => c.kind === "consumption");
    if (!energy || !energy.fallback) {
      throw new Error(`${where}: the consumption component needs a fallback`);
    }
    checkFixedComponentsDoNotOverlap(t, where);
  }

  // Every template.json gives its name to all the powers of its contract.
  const named = v2.templates.filter((t) => t.name.en !== `${t.key} ${t.variant} kVA`);
  for (const t of named) {
    if (!t.name.en.endsWith(` – ${t.variant} kVA`)) {
      throw new Error(`${t.key}: the template.json name must end with the subscribed power`);
    }
  }
  const tempo6 = v2.templates.find(
    (t) => t.key === "electricite-de-strasbourg-tarif-bleu-tempo" && t.variant === "6",
  );
  if (!tempo6 || tempo6.name.fr !== "ÉS Tarif Bleu (réglementé) – Tempo – 6 kVA") {
    throw new Error("electricite-de-strasbourg-tarif-bleu-tempo: template.json name not applied");
  }

  console.log(
    `✅ contracts-v2.json: ${v2.templates.length} templates, ${named.length} with a template.json name`,
  );
}

/**
 * A malformed template.json stops the build with an error naming the file.
 */
function checkMalformedTemplateJson() {
  console.log("\n📋 Checking the errors of a malformed template.json...");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "energy-contracts-"));
  try {
    fs.writeFileSync(path.join(dir, "template.json"), '{ "name": { "en": "x" }, }');
    let message = null;
    try {
      readMetadata(dir);
    } catch (error) {
      message = error.message;
    }
    if (message === null || !message.includes("template.json")) {
      throw new Error(`a malformed template.json must be named in the error, got: ${message}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  console.log("✅ The error names the template.json file");
}

/**
 * Main test function
 */
function runTests() {
  console.log("🧪 Starting process-v2.test.js");
  console.log("=".repeat(50));

  try {
    // Step 1: Run the build (process.js writes contracts.json, then calls process-v2.js)
    console.log("📋 Step 1: Running process.js script...");
    execSync("node process.js", { stdio: "ignore" });
    console.log("✅ process.js executed successfully");

    // Step 2: contracts-v2.json against contracts.json
    const contractsPath = path.join(__dirname, "contracts.json");
    if (!fs.existsSync(contractsPath)) {
      throw new Error("contracts.json file was not created");
    }
    const contractsData = JSON.parse(fs.readFileSync(contractsPath, "utf-8"));
    validateCatalogueV2(contractsData);

    // Step 3: template.json errors
    checkMalformedTemplateJson();

    console.log("\n🎉 ALL TESTS PASSED!");
    console.log("=".repeat(50));
  } catch (error) {
    console.error("\n❌ TEST FAILED:");
    console.error(error.message);
    console.log("=".repeat(50));
    process.exit(1);
  }
}

// Run the tests
runTests();
