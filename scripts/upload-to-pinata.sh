#!/bin/bash

# Simple script to upload QCI files to Pinata
# Usage: ./scripts/upload-to-pinata.sh [QCI-number]
# Example: ./scripts/upload-to-pinata.sh 248
# Or upload all: ./scripts/upload-to-pinata.sh all

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Load environment
if [ -f .env ]; then
    source .env
fi

# Check for Pinata JWT
if [ -z "$PINATA_JWT" ]; then
    echo -e "${RED}❌ PINATA_JWT not set in .env${NC}"
    echo "Please add PINATA_JWT to your .env file"
    exit 1
fi

echo -e "${CYAN}📤 Pinata QCI Uploader${NC}"
echo "========================"

# Function to upload a single QCI file
upload_qip() {
    local qip_number=$1
    local file_path="contents/QCI/QCI-${qip_number}.md"

    if [ ! -f "$file_path" ]; then
        echo -e "${YELLOW}⚠️  QCI-${qip_number} not found${NC}"
        return 1
    fi

    echo -e "${BLUE}Uploading QCI-${qip_number}...${NC}"

    # Upload raw markdown file to Pinata with CIDv0 (Qm... format)
    # Remove cidVersion option to get default CIDv0
    response=$(curl -s -X POST \
        -H "Authorization: Bearer ${PINATA_JWT}" \
        -F "file=@${file_path}" \
        -F "pinataMetadata={\"name\":\"QCI-${qip_number}\"}" \
        -F "pinataOptions={\"cidVersion\":0}" \
        "https://api.pinata.cloud/pinning/pinFileToIPFS")

    # Check if upload was successful
    if echo "$response" | grep -q "IpfsHash"; then
        cid=$(echo "$response" | jq -r '.IpfsHash')
        echo -e "${GREEN}✅ QCI-${qip_number} uploaded: ${cid}${NC}"
        echo "   IPFS URL: ipfs://${cid}"
        echo "   Gateway: https://gateway.pinata.cloud/ipfs/${cid}"
        echo ""
        return 0
    else
        echo -e "${RED}❌ Failed to upload QCI-${qip_number}${NC}"
        echo "   Error: $response"
        echo ""
        return 1
    fi
}

# Main logic
if [ "$1" == "all" ]; then
    # Upload all QCI files
    echo -e "${YELLOW}Uploading all QCI files...${NC}"
    echo ""

    success_count=0
    fail_count=0

    for file in contents/QCI/QCI-*.md; do
        if [ -f "$file" ]; then
            qip_num=$(echo "$file" | grep -oE 'QCI-([0-9]+)' | cut -d'-' -f2)
            if upload_qip "$qip_num"; then
                ((success_count++))
            else
                ((fail_count++))
            fi
        fi
    done

    echo "========================"
    echo -e "${GREEN}✅ Uploaded: ${success_count}${NC}"
    if [ $fail_count -gt 0 ]; then
        echo -e "${RED}❌ Failed: ${fail_count}${NC}"
    fi

elif [ -z "$1" ]; then
    # No argument provided
    echo "Usage: $0 [QCI-number|all]"
    echo ""
    echo "Examples:"
    echo "  $0 248        # Upload QCI-248"
    echo "  $0 all        # Upload all QCI files"
    exit 1

else
    # Upload single QCI
    upload_qip "$1"
fi