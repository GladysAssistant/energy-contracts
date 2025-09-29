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

1. Create a new directory under `contracts/`
2. Add your CSV data file
3. Create a `convert.js` file that exports a function returning the processed data
4. The main process will automatically include it

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run build: `npm run build`
5. Ensure tests pass: `npm test`
6. Submit a pull request

The CI/CD pipeline will automatically validate your changes before they can be merged.
