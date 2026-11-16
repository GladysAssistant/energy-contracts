// -----------------------------------------------------------------------------
// process-v2.js writes contracts-v2.json, as process.js writes contracts.json
// (npm run build runs both): the catalogue in the template format of the Gladys
// energy contracts (docs/specs/energy-contracts.md of Gladys, section 9.4).
//
// Gladys downloads contracts-v2.json instead of contracts.json when a release
// carries it. The templates are built from the same v1 data with the very
// translation Gladys applies to contracts.json today (one template per contract
// key and subscribed power, older price ranges as dated rules), with one fix:
// the fixed components of the latest range start at that range, so a contract
// starting before it does not pay two subscriptions. What v2 adds:
//
// - a readable name and description per contract, from an optional
//   `template.json` next to its convert.js;
// - the template version: the start date of the latest price range.
//
// Without a template.json, a contract keeps the name Gladys gives it from v1:
// "<key> <power> kVA".
// -----------------------------------------------------------------------------

const fs = require("fs");
const path = require("path");
const { convertPriceRows } = require("./lib/gladys/convertPriceRows");

const LANGUAGES = ["en", "fr", "de", "es"];
const CURRENCY_MAP = {
  euro: "EUR",
  dollar: "USD",
  pound: "GBP",
  franc: "CHF",
  yen: "JPY",
};
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 512;

/** Same mapping as Gladys (migration.fromEnergyPrice.js, toIsoCurrency). */
function toIsoCurrency(currency) {
  const value = String(currency || "EUR").trim();
  const mapped = CURRENCY_MAP[value.toLowerCase()];
  if (mapped) {
    return mapped;
  }
  return /^[A-Za-z]{3}$/.test(value) ? value.toUpperCase() : "EUR";
}

/**
 * The tariff of one contract key and one power: the latest price range gives
 * the undated rules and the fallback, the older ranges become rules and fixed
 * components scoped by a `dates` condition, placed first. Same algorithm as
 * Gladys v5.3.3 (template.catalogue.js, buildVariantTariff), except that the
 * fixed components of the latest range are dated from its start.
 * @param {Array<object>} rows - Price rows of the variant.
 * @returns {object} { tariff, inputs, calendars, contractType, latestStart }.
 */
function buildVariantTariff(rows) {
  const ranges = Array.from(
    new Set(rows.map((r) => `${r.start_date}|${r.end_date || ""}`)),
  )
    .map((id) => ({
      id,
      start: id.split("|")[0],
      end: id.split("|")[1] || null,
    }))
    .sort((a, b) => (a.start < b.start ? 1 : -1));
  const energy = { key: "energy", kind: "consumption", rules: [] };
  const fixed = [];
  const inputs = [];
  let calendars = [];
  let contractType;
  ranges.forEach((range, rangeIndex) => {
    const rangeRows = rows.filter(
      (r) => `${r.start_date}|${r.end_date || ""}` === range.id,
    );
    const converted = convertPriceRows(rangeRows);
    contractType = converted.contractType;
    calendars = converted.tariff.calendars || calendars;
    converted.inputs.forEach((input) => {
      if (!inputs.some((i) => i.key === input.key)) {
        inputs.push({
          ...input,
          label: {
            en: "Off-peak hours",
            fr: "Heures creuses",
            de: "Nebenzeiten",
            es: "Horas valle",
          },
        });
      }
    });
    const isCurrent = rangeIndex === 0;
    const dates = isCurrent
      ? null
      : { from: range.start, ...(range.end ? { to: range.end } : {}) };
    converted.tariff.components.forEach((component) => {
      if (component.kind === "consumption") {
        const rules = component.rules.map((r) =>
          dates ? { ...r, when: { ...(r.when || {}), dates } } : r,
        );
        if (isCurrent) {
          energy.rules.push(...rules);
          energy.fallback = component.fallback;
        } else {
          // dated block first (first match wins), its fallback as a dated rule
          energy.rules.unshift(...rules, {
            ...component.fallback,
            when: { dates },
          });
        }
      } else if (isCurrent) {
        // From the start of the latest range only: before it, the dated
        // components of the older ranges apply, and the engine adds up every
        // fixed component that matches (Gladys v5.3.3 charges both there).
        fixed.push({ ...component, when: { dates: { from: range.start } } });
      } else {
        fixed.push({
          ...component,
          key: `${component.key}-${range.start}`,
          when: { dates },
        });
      }
    });
  });
  const tariff = { tariff_version: 1, components: [energy, ...fixed] };
  if (calendars.length > 0) {
    tariff.calendars = calendars;
  }
  return {
    tariff,
    inputs,
    calendars,
    contractType,
    latestStart: ranges[0].start,
  };
}

/** A multi-language text of template.json: `en` required, at most `max` characters. */
function checkText(value, field, file, max) {
  if (!value || typeof value !== "object" || typeof value.en !== "string") {
    throw new Error(`${file}: "${field}" needs at least an "en" text`);
  }
  for (const [lang, text] of Object.entries(value)) {
    if (!LANGUAGES.includes(lang)) {
      throw new Error(`${file}: "${field}.${lang}" is not one of ${LANGUAGES}`);
    }
    if (typeof text !== "string" || text.trim() === "" || text.length > max) {
      throw new Error(
        `${file}: "${field}.${lang}" must be a text of 1 to ${max} characters`,
      );
    }
  }
}

/**
 * Reads the template.json of a contract folder, if any:
 * `{ "name": { "en": …, "fr": … }, "description": { … } }`.
 * The name must leave room for the subscribed power (" – 36 kVA").
 */
function readMetadata(dir) {
  const file = path.join(dir, "template.json");
  if (!fs.existsSync(file)) {
    return null;
  }
  const relative = path.relative(process.cwd(), file);
  let metadata;
  try {
    metadata = JSON.parse(fs.readFileSync(file, "utf-8"));
  } catch (error) {
    throw new Error(`${relative}: ${error.message}`);
  }
  for (const field of Object.keys(metadata)) {
    if (!["name", "description"].includes(field)) {
      throw new Error(`${relative}: unknown field "${field}"`);
    }
  }
  checkText(metadata.name, "name", relative, MAX_NAME_LENGTH - 9);
  if (metadata.description !== undefined) {
    checkText(
      metadata.description,
      "description",
      relative,
      MAX_DESCRIPTION_LENGTH,
    );
  }
  return metadata;
}

const localize = (text, power) =>
  Object.fromEntries(
    Object.entries(text).map(([lang, value]) => [
      lang,
      `${value} – ${power} kVA`,
    ]),
  );

/**
 * The v2 catalogue: `{ templates, calendars }`.
 * @param {object} catalogue - The v1 catalogue (contracts.json content).
 * @param {object} folders - Contract key -> folder of its convert.js.
 */
function buildCatalogueV2(catalogue, folders = {}) {
  const templates = [];
  for (const key of Object.keys(catalogue)) {
    const powers = catalogue[key];
    if (powers === null || typeof powers !== "object") {
      continue;
    }
    const metadata = folders[key] ? readMetadata(folders[key]) : null;
    Object.keys(powers)
      .filter((power) => Array.isArray(powers[power]) && powers[power].length)
      .sort((a, b) => Number(a) - Number(b))
      .forEach((power) => {
        const rows = powers[power];
        const built = buildVariantTariff(rows);
        const label = `${key} ${power} kVA`;
        templates.push({
          key,
          variant: power,
          name: metadata
            ? localize(metadata.name, power)
            : { en: label, fr: label },
          ...(metadata?.description
            ? { description: metadata.description }
            : {}),
          country: "FR",
          currency: toIsoCurrency(rows[0].currency),
          timezone: "Europe/Paris",
          pricing_mode: "rules",
          version: built.latestStart,
          contract_type: built.contractType,
          subscribed_power: Number(power) || null,
          power_unit: "kVA",
          calendars: built.calendars,
          inputs: built.inputs,
          tariff: built.tariff,
        });
      });
  }
  return { templates, calendars: [] };
}

/**
 * Writes contracts-v2.json next to this file.
 * @param {object} catalogue - The v1 catalogue (contracts.json content).
 * @param {object} folders - Contract key -> folder of its convert.js.
 * @returns {object} { outputPath, count }.
 */
function writeContractsV2(catalogue, folders) {
  const outputPath = path.join(__dirname, "contracts-v2.json");
  const catalogueV2 = buildCatalogueV2(catalogue, folders);
  fs.writeFileSync(outputPath, JSON.stringify(catalogueV2, null, 2));
  return { outputPath, count: catalogueV2.templates.length };
}

module.exports = {
  writeContractsV2,
  buildCatalogueV2,
  buildVariantTariff,
  readMetadata,
  toIsoCurrency,
  LANGUAGES,
};
