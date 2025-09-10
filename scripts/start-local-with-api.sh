#!/bin/bash

# Local Frontend with Remote API - Hybrid mode
# Local blockchain and frontend, but uses remote Mai API for IPFS

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}🌐 Starting LOCAL + API Development Environment${NC}"
echo "================================================"
echo "This mode runs:"
echo "- Local Anvil for blockchain"
echo "- Local frontend"
echo "- Remote Mai API for IPFS storage and QIP fetching"
echo ""

# Force API mode - explicitly set all variables
export VITE_USE_LOCAL_IPFS=false
export VITE_USE_MAI_API=true
export VITE_USE_MAI_API_FOR_QIPS=true
export VITE_LOCAL_MODE=false

# Set API endpoints
export VITE_IPFS_API_URL=https://api.mai.finance/v2/ipfs-upload
export VITE_MAI_API_URL=https://staging-api.mai.finance

# Clear local IPFS settings to avoid confusion
unset VITE_LOCAL_IPFS_API
unset VITE_LOCAL_IPFS_GATEWAY

# Use local blockchain
export VITE_BASE_RPC_URL=http://localhost:8545
unset VITE_BASE_RPC_URLS  # Clear multiple RPC URLs

echo -e "${GREEN}Environment variables set for API mode:${NC}"
echo "  VITE_USE_LOCAL_IPFS=false"
echo "  VITE_USE_MAI_API=true"
echo "  VITE_USE_MAI_API_FOR_QIPS=true"
echo "  VITE_IPFS_API_URL=https://api.mai.finance/v2/ipfs-upload"
echo "  VITE_MAI_API_URL=https://staging-api.mai.finance"
echo "  VITE_BASE_RPC_URL=http://localhost:8545"
echo "  VITE_LOCAL_IPFS_API=(unset)"
echo "  VITE_LOCAL_IPFS_GATEWAY=(unset)"
echo ""

# Skip IPFS checks since we're using the API
export USE_LOCAL_IPFS=false

echo -e "${YELLOW}Starting services (without local IPFS)...${NC}"
exec ./scripts/start-local-dev.sh "$@"