#!/bin/bash

# Pure Local Development - Everything runs locally (IPFS, Blockchain, Frontend)
# No external API calls

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🏠 Starting PURE LOCAL Development Environment${NC}"
echo "================================================"
echo "This mode runs everything locally:"
echo "- Local IPFS daemon for storage"
echo "- Local Anvil for blockchain"
echo "- No external API calls"
echo ""

# Override ALL environment variables to force local mode
export VITE_USE_LOCAL_IPFS=true
export VITE_USE_MAI_API=false
export VITE_LOCAL_MODE=true

# Clear any API URLs to prevent fallback
unset VITE_IPFS_API_URL
unset VITE_MAI_API_URL

# Set local IPFS endpoints
export VITE_LOCAL_IPFS_API=http://localhost:5001
export VITE_LOCAL_IPFS_GATEWAY=http://localhost:8080

# Use local RPC
export VITE_BASE_RPC_URL=http://localhost:8545
unset VITE_BASE_RPC_URLS  # Remove multiple RPC URLs

# Clear any Mai API configuration
unset VITE_MAI_API_URL
unset VITE_USE_MAI_API

# Enable test mode for Snapshot submissions (use testdevtest space)
export VITE_SNAPSHOT_TEST_MODE=true
export VITE_SNAPSHOT_TEST_SPACE=testdevtest.eth

echo -e "${GREEN}Environment variables set for pure local mode:${NC}"
echo "  VITE_USE_LOCAL_IPFS=$VITE_USE_LOCAL_IPFS"
echo "  VITE_USE_MAI_API=$VITE_USE_MAI_API"
echo "  VITE_LOCAL_MODE=$VITE_LOCAL_MODE"
echo "  VITE_LOCAL_IPFS_API=$VITE_LOCAL_IPFS_API"
echo "  VITE_LOCAL_IPFS_GATEWAY=$VITE_LOCAL_IPFS_GATEWAY"
echo "  VITE_BASE_RPC_URL=$VITE_BASE_RPC_URL"
echo "  VITE_SNAPSHOT_TEST_MODE=$VITE_SNAPSHOT_TEST_MODE"
echo "  VITE_SNAPSHOT_TEST_SPACE=$VITE_SNAPSHOT_TEST_SPACE"
echo "  VITE_IPFS_API_URL=${VITE_IPFS_API_URL:-(unset)}"
echo "  VITE_MAI_API_URL=${VITE_MAI_API_URL:-(unset)}"
echo ""

# Now run the standard local dev script with our environment
echo -e "${YELLOW}Starting services...${NC}"
exec ./scripts/start-local-dev.sh "$@"