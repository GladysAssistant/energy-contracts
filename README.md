# Gladys Energy Contracts

A Node.js project that processes energy contract pricing data from CSV files and generates structured JSON output for use in Gladys Assistant.

## Overview

This project processes energy contract pricing data from any energy providers and converts it into a standardized JSON format. It supports multiple contract types with different pricing structures.

### Data Fields

- **contract**: Contract type identifier
- **price_type**: Always "consumption" for energy consumption pricing
- **currency**: "euro", "usd"
- **start_date**: Start date of the pricing period (ISO format YYYY-MM-DD)
- **end_date**: End date of the pricing period (ISO format YYYY-MM-DD, null for open-ended)
- **price**: Price in currency (multiplied by 10000 for integer precision)
- **hour_slots**: Time slots when the price applies (contract-specific format)
- **day_type**: Day classification for Tempo contracts ("blue", "white", "red")

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd gladys-energy-contracts

# Install dependencies
npm install
```

## Usage

### Generate Contracts Data

```bash
# Generate contracts.json file
npm run build
```

### Run Tests

```bash
# Run validation tests
npm test
```

### Development

The project uses a modular structure where each contract type has its own `convert.js` file that processes the corresponding CSV data. The main `process.js` script automatically discovers and executes all converter functions.

To add a new contract type:

1. Create new directory under `contracts/`, this directory should have your provider name (i.e. `electricite-de-strasbourg`)
2. Create new subfolder with contract's name (i.e. `tarif-bleu`) followed by the period name (i.e. `base`, `peak-off-peak`, `tempo`), results should be like: `tarif-bleu-base` or `tarif-bleu-peak-off-peak`or `tarif-bleu-tempo`. It is important to have the right ending for good translation in Gladys
3. Add your CSV data file or json data file (based on the other contracts)
4. Create a `convert.js` file that exports a function returning the processed data
5. The main process will automatically include it

Folders' hierarchy to follow:
```text
contracts/
└── new-provider/
    ├── new-tariff-base/
    ├── new-tariff-peak-off-peak/
    └── new-tariff-tempo/
```

### Contract names (`template.json`, format v2)

`npm run build` writes two files, both published in each release:

- `contracts.json`, by `process.js`: the price rows above (format v1);
- `contracts-v2.json`, by `process-v2.js`: the same contracts in the template format of Gladys
  (format v2). Gladys uses it instead of `contracts.json` when the release carries it.

`contracts-v2.json` is built from the v1 data with the translation Gladys applies to `contracts.json`
(`lib/gladys/convertPriceRows.js`, copied from Gladys), with one fix: the subscription of the latest
prices starts at their date, so a contract starting before them does not pay two subscriptions (Gladys
v5.3.3 does). Where no older price applies (before the first known price, or a gap between two), the
latest subscription applies, as the latest energy prices do. The keys do not change, so the contracts users already created keep their template. What
v2 adds is a readable name:

| Without `template.json`                       | With `template.json`                            |
| --------------------------------------------- | ----------------------------------------------- |
| `electricite-de-strasbourg-tarif-bleu-tempo 6 kVA` | `ÉS Tarif Bleu (réglementé) – Tempo – 6 kVA` |

To name a contract, add a `template.json` next to its `convert.js`:

```json
{
  "name": {
    "en": "ÉS Tarif Bleu (regulated) – Tempo",
    "fr": "ÉS Tarif Bleu (réglementé) – Tempo"
  },
  "description": {
    "en": "One sentence on the contract.",
    "fr": "Une phrase sur le contrat."
  }
}
```

- `name` is required, `en` included; `fr`, `de` and `es` are optional. 55 characters at most: the
  subscribed power is appended (` – 6 kVA`).
- `description` is optional, 512 characters at most per language.
- The template `version` is the start date of the latest prices.

A contract without `template.json` keeps its current name. Every contract of the catalogue has one:
add one with each new contract, in the same form, `<Provider> <Offer> – <Option>`, the option being
`Base` / `Heures Creuses` / `Tempo` in French, `Base` / `Off-peak hours` / `Tempo` in English, `Base` /
`Nebenzeit` / `Tempo` in German and `Base` / `Horas valle` / `Tempo` in Spanish.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes (a new contract comes with its `template.json`)
4. Run build: `npm run build`
5. Ensure tests pass: `npm test`
6. Submit a pull request

The CI/CD pipeline will automatically validate your changes before they can be merged.
