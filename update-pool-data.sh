#!/bin/bash

# PayPal Pool Data Update Script
# Usage: ./update-pool-data.sh <current_amount> <contributors>

if [ $# -ne 2 ]; then
    echo "Usage: $0 <current_amount> <contributors>"
    echo "Example: $0 150.25 12"
    exit 1
fi

CURRENT_AMOUNT=$1
CONTRIBUTORS=$2
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Error: .env file not found. Please copy sample.env to .env first."
    exit 1
fi

# Get the current target amount from .env file
TARGET_AMOUNT=$(grep "PAYPAL_POOL_TARGET_AMOUNT=" .env | cut -d'"' -f2)

if [ -z "$TARGET_AMOUNT" ]; then
    echo "Error: Could not find PAYPAL_POOL_TARGET_AMOUNT in .env file"
    exit 1
fi

# Update the .env file
sed -i "s/PAYPAL_POOL_CURRENT_AMOUNT=.*/PAYPAL_POOL_CURRENT_AMOUNT=\"$CURRENT_AMOUNT\"/" .env
sed -i "s/PAYPAL_POOL_CONTRIBUTORS=.*/PAYPAL_POOL_CONTRIBUTORS=\"$CONTRIBUTORS\"/" .env
sed -i "s/PAYPAL_POOL_LAST_UPDATED=.*/PAYPAL_POOL_LAST_UPDATED=\"$TIMESTAMP\"/" .env

echo "✅ PayPal pool data updated successfully!"
echo "Current Amount: €$CURRENT_AMOUNT"
echo "Target Amount: €$TARGET_AMOUNT (unchanged)"
echo "Contributors: $CONTRIBUTORS"
echo "Last Updated: $TIMESTAMP"
echo ""
echo "🔄 Restart your development server to see the changes." 