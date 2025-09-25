#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Clear any stale environment variables from previous runs
unset QCI_REGISTRY_ADDRESS
unset VITE_QCI_REGISTRY_ADDRESS
unset GATSBY_QCI_REGISTRY_ADDRESS
unset DEPLOYER_ADDRESS
unset PRIVATE_KEY

echo -e "${YELLOW}Cleared stale environment variables${NC}"

# Parse command line arguments
MIGRATE_QCIS=false
KEYSTORE_ACCOUNT=""
USE_KEYSTORE=false

echo -e "${BLUE}Parsing arguments: $@${NC}"

while [[ $# -gt 0 ]]; do
    echo -e "${YELLOW}Processing argument: $1${NC}"
    case $1 in
        --migrate)
            MIGRATE_QCIS=true
            echo -e "${GREEN}  → Migration enabled${NC}"
            shift
            ;;
        --keystore=*)
            KEYSTORE_ACCOUNT="${1#*=}"
            USE_KEYSTORE=true
            echo -e "${GREEN}  → Keystore account (=): $KEYSTORE_ACCOUNT${NC}"
            shift
            ;;
        --keystore)
            shift
            KEYSTORE_ACCOUNT="$1"
            USE_KEYSTORE=true
            echo -e "${GREEN}  → Keystore account: $KEYSTORE_ACCOUNT${NC}"
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo "Options:"
            echo "  --migrate                    Run migration script to populate QCIs 209-248 from existing files"
            echo "  --keystore <account>         Use keystore account for deployment (e.g., deployer, devwallet)"
            echo "  --keystore=<account>         Alternative syntax for keystore"
            echo "  --help                       Show this help message"
            echo ""
            echo "Examples:"
            echo "  $0 --migrate                        # Use default private key"
            echo "  $0 --keystore deployer --migrate    # Use keystore account (space)"
            echo "  $0 --keystore=deployer --migrate    # Use keystore account (equals)"
            echo ""
            echo "Available keystore accounts:"
            cast wallet list 2>/dev/null || echo "  (run 'cast wallet list' to see available accounts)"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

echo -e "${BLUE}🚀 Starting QCIs Local Development Environment (Vite)${NC}"
echo "================================================"

# Validate keystore account if specified and get the address
if [ "$USE_KEYSTORE" = true ]; then
    if ! cast wallet list 2>/dev/null | grep -q "$KEYSTORE_ACCOUNT"; then
        echo -e "${RED}❌ Error: Keystore account '$KEYSTORE_ACCOUNT' not found${NC}"
        echo "Available accounts:"
        cast wallet list 2>/dev/null || echo "No keystore accounts found. Create one with: cast wallet import <name> --interactive"
        exit 1
    fi
    
    # Get the address for the keystore account
    KEYSTORE_ADDRESS=$(cast wallet address --account $KEYSTORE_ACCOUNT 2>/dev/null)
    if [ -z "$KEYSTORE_ADDRESS" ]; then
        echo -e "${RED}❌ Error: Could not retrieve address for keystore account '$KEYSTORE_ACCOUNT'${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Using keystore account: $KEYSTORE_ACCOUNT${NC}"
    echo -e "${GREEN}   Address: $KEYSTORE_ADDRESS${NC}"
fi

# Set deployment method
if [ "$USE_KEYSTORE" = true ]; then
    DEPLOY_METHOD="keystore"
    echo -e "${BLUE}Using keystore for deterministic deployment${NC}"
else
    DEPLOY_METHOD="privatekey"
    echo -e "${BLUE}Using default Anvil account for deployment${NC}"
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    if [ ! -z "$ANVIL_PID" ]; then
        kill $ANVIL_PID 2>/dev/null
        echo "Stopped Anvil (PID: $ANVIL_PID)"
    fi
    if [ ! -z "$VITE_PID" ]; then
        kill $VITE_PID 2>/dev/null
        echo "Stopped Vite (PID: $VITE_PID)"
    fi
    if [ ! -z "$IPFS_PID" ]; then
        kill $IPFS_PID 2>/dev/null
        echo "Stopped IPFS (PID: $IPFS_PID)"
    fi
    exit
}

# Set trap to cleanup on script exit
trap cleanup EXIT INT TERM

# Check dependencies
if ! command -v anvil &> /dev/null; then
    echo -e "${RED}❌ Anvil not found. Please install Foundry first.${NC}"
    exit 1
fi

if ! command -v forge &> /dev/null; then
    echo -e "${RED}❌ Forge not found. Please install Foundry first.${NC}"
    exit 1
fi

if ! command -v bun &> /dev/null; then
    echo -e "${RED}❌ Bun not found. Please install Bun first.${NC}"
    exit 1
fi

# Load environment variables from .env.local if it exists
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | xargs)
fi

# Kill any existing Anvil/Vite processes
echo -e "${YELLOW}Stopping any existing processes...${NC}"
pkill -f anvil 2>/dev/null
pkill -f vite 2>/dev/null
sleep 2

# Default to using local IPFS for local development unless explicitly disabled
if [ -z "$USE_LOCAL_IPFS" ]; then
    USE_LOCAL_IPFS="true"
    echo -e "${BLUE}Defaulting to local IPFS for development${NC}"
fi

# Check if IPFS should be started
if [ "$USE_LOCAL_IPFS" = "true" ]; then
    echo -e "${YELLOW}Checking IPFS (required for local development)...${NC}"
    
    # Check if IPFS is installed
    if ! command -v ipfs &> /dev/null; then
        echo -e "${RED}❌ IPFS not found. IPFS is required for local development.${NC}"
        echo ""
        echo "To install IPFS:"
        echo "  macOS: brew install ipfs"
        echo "  Other: https://docs.ipfs.tech/install/"
        echo ""
        echo "After installation, run: ./scripts/setup-ipfs.sh"
        exit 1
    fi
    
    # Initialize IPFS if not already initialized
    if [ ! -d ~/.ipfs ]; then
        echo -e "${YELLOW}Initializing IPFS...${NC}"
        ipfs init
        if [ $? -ne 0 ]; then
            echo -e "${RED}❌ Failed to initialize IPFS${NC}"
            exit 1
        fi
    fi
    
    # Configure IPFS for local development
    echo -e "${YELLOW}Configuring IPFS for local development...${NC}"
    ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["http://localhost:3000", "http://localhost:8080", "http://127.0.0.1:3000", "*"]' 2>/dev/null
    ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["GET", "POST", "PUT", "DELETE"]' 2>/dev/null
    ipfs config --json API.HTTPHeaders.Access-Control-Allow-Headers '["Content-Type", "Authorization"]' 2>/dev/null
    ipfs config --json API.HTTPHeaders.Access-Control-Allow-Credentials '["true"]' 2>/dev/null
    
    # Configure garbage collection and storage limits
    ipfs config --json Datastore.GCPeriod '"1h"' 2>/dev/null
    ipfs config --json Datastore.StorageMax '"10GB"' 2>/dev/null
    
    # Kill any existing IPFS process
    pkill -f "ipfs daemon" 2>/dev/null
    sleep 2
    
    # Start IPFS daemon if not running
    if ! pgrep -f "ipfs daemon" > /dev/null; then
        echo -e "${YELLOW}Starting IPFS daemon...${NC}"
        ipfs daemon > /tmp/ipfs.log 2>&1 &
        IPFS_PID=$!
        echo "IPFS PID: $IPFS_PID"
        
        # Wait for IPFS to start with timeout
        echo -e "${YELLOW}Waiting for IPFS to start...${NC}"
        MAX_IPFS_RETRIES=30
        IPFS_RETRY_COUNT=0
        IPFS_STARTED=false
        
        while [ $IPFS_RETRY_COUNT -lt $MAX_IPFS_RETRIES ]; do
            if curl -s -X POST http://localhost:5001/api/v0/version > /dev/null 2>&1; then
                IPFS_STARTED=true
                break
            fi
            IPFS_RETRY_COUNT=$((IPFS_RETRY_COUNT + 1))
            sleep 1
            echo -n "."
        done
        echo ""
        
        if [ "$IPFS_STARTED" = false ]; then
            echo -e "${RED}❌ IPFS failed to start. This is required for local development.${NC}"
            echo -e "${YELLOW}Please check /tmp/ipfs.log for errors:${NC}"
            echo "----------------------------------------"
            tail -n 20 /tmp/ipfs.log
            echo "----------------------------------------"
            echo ""
            echo "Common solutions:"
            echo "1. Kill existing IPFS processes: pkill -f ipfs"
            echo "2. Check if port 5001 is in use: lsof -i :5001"
            echo "3. Reinitialize IPFS: rm -rf ~/.ipfs && ipfs init"
            exit 1
        fi
    else
        echo -e "${GREEN}✅ IPFS daemon already running${NC}"
    fi
    
    # Verify IPFS is working by testing upload/download
    echo -e "${YELLOW}Testing IPFS functionality...${NC}"
    TEST_CONTENT="QCIs IPFS test - $(date)"
    TEST_CID=$(echo "$TEST_CONTENT" | ipfs add -q 2>/dev/null)
    
    if [ -z "$TEST_CID" ]; then
        echo -e "${RED}❌ IPFS upload test failed${NC}"
        echo "IPFS daemon is running but not functioning properly"
        exit 1
    fi
    
    # Test retrieval
    RETRIEVED_CONTENT=$(ipfs cat "$TEST_CID" 2>/dev/null)
    if [ "$RETRIEVED_CONTENT" != "$TEST_CONTENT" ]; then
        echo -e "${RED}❌ IPFS retrieval test failed${NC}"
        echo "Content uploaded but could not be retrieved"
        exit 1
    fi
    
    echo -e "${GREEN}✅ IPFS daemon is running and functional${NC}"
    echo -e "${GREEN}   API: http://localhost:5001${NC}"
    echo -e "${GREEN}   Gateway: http://localhost:8080${NC}"
    echo -e "${GREEN}   Test CID: $TEST_CID${NC}"
    # Set flag that IPFS is available locally
    LOCAL_IPFS_AVAILABLE=true
    # Export VITE variables for local IPFS
    export VITE_USE_LOCAL_IPFS=true
    export VITE_LOCAL_IPFS_API="http://localhost:5001"
    export VITE_LOCAL_IPFS_GATEWAY="http://localhost:8080"
else
    echo -e "${YELLOW}📡 Using external IPFS provider (Mai API or Pinata)${NC}"
    echo "Local IPFS daemon will not be started"
    LOCAL_IPFS_AVAILABLE=false
fi

# Load environment variables
echo -e "${GREEN}Loading local environment...${NC}"
if [ -f .env.local ]; then
    # Export both VITE_ and GATSBY_ prefixes for compatibility
    while IFS='=' read -r key value; do
        # Skip comments and empty lines
        [[ $key =~ ^#.*$ ]] || [[ -z $key ]] && continue
        
        # Export original variable
        export "$key=$value"
        
        # If it's a GATSBY_ variable, also export as VITE_
        if [[ $key == GATSBY_* ]]; then
            VITE_KEY="VITE_${key#GATSBY_}"
            export "$VITE_KEY=$value"
        fi
    done < .env.local
fi

# Install forge-std if needed
if [ ! -d "dependencies/forge-std" ]; then
    echo -e "${YELLOW}Installing forge-std...${NC}"
    forge install foundry-rs/forge-std
fi

# Start Anvil
echo -e "\n${GREEN}1. Starting Anvil (Base fork)...${NC}"

# Standard Anvil command without impersonation
ANVIL_CMD="anvil --fork-url https://mainnet.base.org --accounts 10 --balance 10000 --block-time 2 --port 8545 --code-size-limit 50000"

# Start Anvil
eval "$ANVIL_CMD > /tmp/anvil.log 2>&1 &"

ANVIL_PID=$!
echo "Anvil PID: $ANVIL_PID"

# Wait for Anvil to start
echo -e "${YELLOW}Waiting for Anvil to start...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if curl -s -X POST -H "Content-Type: application/json" \
        --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
        http://localhost:8545 > /dev/null 2>&1; then
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}❌ Anvil failed to start${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Anvil is running on http://localhost:8545${NC}"

# Deploy contracts using deterministic CREATE2 deployment
echo -e "\n${GREEN}2. Deploying QCI Registry contract (deterministic)...${NC}"

# First, check if CREATE2 factory exists at expected address
CREATE2_FACTORY="0x4e59b44847b379578588920cA78FbF26c0B4956C"
echo -e "${BLUE}DEBUG: Checking CREATE2 factory at $CREATE2_FACTORY${NC}"
FACTORY_CODE=$(cast code $CREATE2_FACTORY --rpc-url http://localhost:8545 2>/dev/null || echo "0x")
if [ "$FACTORY_CODE" = "0x" ] || [ -z "$FACTORY_CODE" ]; then
    echo -e "${YELLOW}⚠️  CREATE2 factory not found at standard address${NC}"
    echo -e "${YELLOW}   This is expected on local Anvil fork${NC}"
else
    echo -e "${GREEN}✅ CREATE2 factory exists${NC}"
fi

# Check if contract already exists at deterministic address
EXPECTED_DETERMINISTIC_ADDRESS="0xf5D5CdccEe171F02293337b7F3eda4D45B85B233"
echo -e "${BLUE}DEBUG: Checking for existing contract at deterministic address: $EXPECTED_DETERMINISTIC_ADDRESS${NC}"
EXISTING_CODE=$(cast code $EXPECTED_DETERMINISTIC_ADDRESS --rpc-url http://localhost:8545 2>/dev/null || echo "0x")
if [ "$EXISTING_CODE" != "0x" ] && [ ! -z "$EXISTING_CODE" ]; then
    echo -e "${YELLOW}⚠️  Contract already exists at deterministic address!${NC}"
    echo -e "${YELLOW}   Code length: ${#EXISTING_CODE} bytes${NC}"
fi

# Check for additional editor to grant role to
ADDITIONAL_EDITOR="${ADDITIONAL_EDITOR:-}"
if [ ! -z "$ADDITIONAL_EDITOR" ]; then
    echo -e "${BLUE}Will grant editor role to: $ADDITIONAL_EDITOR${NC}"
fi

if [ "$DEPLOY_METHOD" = "keystore" ]; then
    echo -e "${YELLOW}Deploying with keystore account: $KEYSTORE_ADDRESS${NC}"
    # Deploy using keystore - note: DeployLocal doesn't use keystore, fallback to CREATE2
    DEPLOY_OUTPUT=$(INITIAL_ADMIN=$KEYSTORE_ADDRESS forge script script/DeployWithStandardCreate2.s.sol:DeployWithStandardCreate2 \
        --rpc-url http://localhost:8545 \
        --account $KEYSTORE_ACCOUNT \
        --sender $KEYSTORE_ADDRESS \
        --broadcast \
        -vvv 2>&1)
else
    # Use the simplified local deployment script for non-keystore deployments
    echo -e "${YELLOW}Deploying with local deployment script...${NC}"
    echo -e "${BLUE}DEBUG: Deployer will be: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266${NC}"

    DEPLOY_OUTPUT=$(ADDITIONAL_EDITOR=$ADDITIONAL_EDITOR forge script script/DeployLocal.s.sol:DeployLocal \
        --rpc-url http://localhost:8545 \
        --broadcast \
        -vvv 2>&1)
fi

# Save deployment output for debugging
echo "$DEPLOY_OUTPUT" > /tmp/deploy_output.log

# Extract key deployment information
echo -e "${BLUE}DEBUG: Analyzing deployment output...${NC}"
echo -e "${BLUE}DEBUG: Looking for deployment patterns in output${NC}"

# Check for successful transaction
if echo "$DEPLOY_OUTPUT" | grep -q "## Broadcasting transactions"; then
    echo -e "${GREEN}✅ Found broadcasting section${NC}"
fi

# Look for transaction hashes
TX_HASHES=$(echo "$DEPLOY_OUTPUT" | grep -oE "0x[a-fA-F0-9]{64}" | head -5)
if [ ! -z "$TX_HASHES" ]; then
    echo -e "${BLUE}DEBUG: Found transaction hashes:${NC}"
    echo "$TX_HASHES" | head -3
fi

# Show key parts of the deployment output
if echo "$DEPLOY_OUTPUT" | grep -q "Error\|error\|failed\|Failed"; then
    echo -e "${YELLOW}⚠️  Deployment encountered issues. Checking output...${NC}"
    echo "$DEPLOY_OUTPUT" | grep -E "Error|error|failed|Failed" | head -5

    # Check specifically for contract size error
    if echo "$DEPLOY_OUTPUT" | grep -q "contract size limit"; then
        echo -e "${YELLOW}⚠️  Contract exceeds size limit. Will check for existing deployment...${NC}"
    fi
fi

# Extract the actual deployed address from the output
REGISTRY_ADDRESS=""

echo -e "${YELLOW}Looking for deployed contract address...${NC}"

# Debug: Show what patterns we're finding
echo -e "${BLUE}DEBUG: Searching for deployment patterns in output...${NC}"
echo "$DEPLOY_OUTPUT" | grep -i "deployed\|registry\|address\|created\|contract" | head -10

# First, check if deployment was skipped because contract already exists
if echo "$DEPLOY_OUTPUT" | grep -q "already deployed"; then
    echo -e "${YELLOW}Contract already deployed, extracting existing address...${NC}"
fi

# Look for computed address pattern from CREATE2
if echo "$DEPLOY_OUTPUT" | grep -q "Computed address:"; then
    COMPUTED_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "Computed address:" | grep -oE "0x[a-fA-F0-9]{40}" | head -1)
    echo -e "${BLUE}DEBUG: Found computed CREATE2 address: $COMPUTED_ADDRESS${NC}"

    # Verify this address has code
    CODE_CHECK=$(cast code $COMPUTED_ADDRESS --rpc-url http://localhost:8545 2>/dev/null || echo "0x")
    if [ "$CODE_CHECK" != "0x" ] && [ ! -z "$CODE_CHECK" ]; then
        echo -e "${GREEN}✅ Computed address has contract code${NC}"
        REGISTRY_ADDRESS=$COMPUTED_ADDRESS
    else
        echo -e "${YELLOW}⚠️  No code at computed address${NC}"
    fi
fi

# Try multiple patterns to extract the deployed address
if [ -z "$REGISTRY_ADDRESS" ]; then
    if echo "$DEPLOY_OUTPUT" | grep -q "QCIRegistry deployed at:"; then
        REGISTRY_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "QCIRegistry deployed at:" | grep -oE "0x[a-fA-F0-9]{40}" | head -1)
        echo -e "${BLUE}Found: QCIRegistry deployed at: $REGISTRY_ADDRESS${NC}"
    elif echo "$DEPLOY_OUTPUT" | grep -q "QCIRegistry already deployed at:"; then
        REGISTRY_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "QCIRegistry already deployed at:" | grep -oE "0x[a-fA-F0-9]{40}" | head -1)
        echo -e "${BLUE}Found: QCIRegistry already deployed at: $REGISTRY_ADDRESS${NC}"
    elif echo "$DEPLOY_OUTPUT" | grep -q "Registry deployed at:"; then
        REGISTRY_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "Registry deployed at:" | grep -oE "0x[a-fA-F0-9]{40}" | head -1)
        echo -e "${BLUE}Found: Registry deployed at: $REGISTRY_ADDRESS${NC}"
    elif echo "$DEPLOY_OUTPUT" | grep -q "Deployed QCIRegistry to:"; then
        REGISTRY_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "Deployed QCIRegistry to:" | grep -oE "0x[a-fA-F0-9]{40}" | head -1)
        echo -e "${BLUE}Found: Deployed QCIRegistry to: $REGISTRY_ADDRESS${NC}"
    fi
fi

# If we still don't have an address, check if deployment actually happened
if [ -z "$REGISTRY_ADDRESS" ]; then
    echo -e "${YELLOW}No deployment message found. Checking for transaction receipts...${NC}"
    
    # Look for contract creation in broadcast logs
    if echo "$DEPLOY_OUTPUT" | grep -q "Contract Address:"; then
        REGISTRY_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "Contract Address:" | head -1 | awk '{print $3}')
        echo -e "${BLUE}Found in transaction: Contract Address: $REGISTRY_ADDRESS${NC}"
    elif echo "$DEPLOY_OUTPUT" | grep -q "Deployed to:"; then
        REGISTRY_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep "Deployed to:" | head -1 | awk '{print $3}')
        echo -e "${BLUE}Found: Deployed to: $REGISTRY_ADDRESS${NC}"
    else
        # Last resort: find any address in output
        REGISTRY_ADDRESS=$(echo "$DEPLOY_OUTPUT" | grep -oE '0x[a-fA-F0-9]{40}' | tail -1)
        if [ ! -z "$REGISTRY_ADDRESS" ]; then
            echo -e "${YELLOW}Using last address found in output: $REGISTRY_ADDRESS${NC}"
        fi
    fi
fi

# If still no address, try the deterministic address as last resort
if [ -z "$REGISTRY_ADDRESS" ]; then
    echo -e "${YELLOW}No address found in output. Checking deterministic address...${NC}"
    echo -e "${BLUE}DEBUG: Checking $EXPECTED_DETERMINISTIC_ADDRESS${NC}"

    DETERMINISTIC_CODE=$(cast code $EXPECTED_DETERMINISTIC_ADDRESS --rpc-url http://localhost:8545 2>/dev/null || echo "0x")
    if [ "$DETERMINISTIC_CODE" != "0x" ] && [ ! -z "$DETERMINISTIC_CODE" ]; then
        echo -e "${GREEN}✅ Found contract at deterministic address!${NC}"
        REGISTRY_ADDRESS=$EXPECTED_DETERMINISTIC_ADDRESS

        # Double-check it's actually the QCIRegistry by checking a known function
        echo -e "${BLUE}DEBUG: Verifying contract is QCIRegistry...${NC}"
        NEXT_QCI=$(cast call $EXPECTED_DETERMINISTIC_ADDRESS "nextQCINumber()(uint256)" --rpc-url http://localhost:8545 2>/dev/null || echo "failed")
        if [ "$NEXT_QCI" != "failed" ]; then
            echo -e "${GREEN}✅ Verified: Contract responds to nextQCINumber()${NC}"
            echo -e "${BLUE}   Next QCI Number: $NEXT_QCI${NC}"
        else
            echo -e "${YELLOW}⚠️  Contract exists but may not be QCIRegistry${NC}"
        fi
    else
        echo -e "${YELLOW}No contract at deterministic address${NC}"
    fi
fi

# Final check - if we still don't have an address, scan for any QCIRegistry
if [ -z "$REGISTRY_ADDRESS" ]; then
    echo -e "${YELLOW}Scanning recent deployments for QCIRegistry...${NC}"

    # Get all unique addresses from the deployment output
    ALL_ADDRESSES=$(echo "$DEPLOY_OUTPUT" | grep -oE "0x[a-fA-F0-9]{40}" | sort -u)

    echo -e "${BLUE}DEBUG: Found ${#ALL_ADDRESSES[@]} unique addresses in output${NC}"

    for ADDR in $ALL_ADDRESSES; do
        echo -e "${BLUE}DEBUG: Checking $ADDR...${NC}"
        CODE_AT_ADDR=$(cast code $ADDR --rpc-url http://localhost:8545 2>/dev/null || echo "0x")
        if [ "$CODE_AT_ADDR" != "0x" ] && [ ! -z "$CODE_AT_ADDR" ]; then
            # Try to call nextQCINumber to verify it's a QCIRegistry
            QCI_CHECK=$(cast call $ADDR "nextQCINumber()(uint256)" --rpc-url http://localhost:8545 2>/dev/null || echo "failed")
            if [ "$QCI_CHECK" != "failed" ]; then
                echo -e "${GREEN}✅ Found QCIRegistry at $ADDR!${NC}"
                REGISTRY_ADDRESS=$ADDR
                break
            fi
        fi
    done
fi

if [ -z "$REGISTRY_ADDRESS" ]; then
    echo -e "${RED}❌ Could not find QCIRegistry address from deployment${NC}"
    echo -e "${RED}   Deployment failed (likely due to contract size limit)${NC}"
    echo -e "${RED}   Contract size must be under 24,576 bytes${NC}"
    exit 1
fi

# Verify the contract exists at the extracted address
echo -e "${BLUE}Verifying contract at $REGISTRY_ADDRESS...${NC}"
CODE=$(cast code $REGISTRY_ADDRESS --rpc-url http://localhost:8545 2>/dev/null || echo "0x")
if [ "$CODE" = "0x" ] || [ -z "$CODE" ]; then
    echo -e "${RED}❌ No contract found at address $REGISTRY_ADDRESS${NC}"
    echo -e "${RED}   Contract deployment failed${NC}"
    echo -e "${RED}   Check deployment logs above for details${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found contract code at $REGISTRY_ADDRESS${NC}"

# Extra verification - try to call a function
VERIFY_CALL=$(cast call $REGISTRY_ADDRESS "nextQCINumber()(uint256)" --rpc-url http://localhost:8545 2>/dev/null || echo "failed")
if [ "$VERIFY_CALL" = "failed" ]; then
    echo -e "${RED}❌ Cannot call nextQCINumber() - contract is not functioning${NC}"
    echo -e "${RED}   Contract may be corrupted or incompatible${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Contract verified - nextQCINumber: $VERIFY_CALL${NC}"
echo -e "${GREEN}✅ QCI Registry deployed at: $REGISTRY_ADDRESS${NC}"

# Export the address for other scripts
export QCI_REGISTRY_ADDRESS=$REGISTRY_ADDRESS
export VITE_QCI_REGISTRY_ADDRESS=$REGISTRY_ADDRESS
export VITE_BASE_RPC_URL="http://localhost:8545"
export GATSBY_QCI_REGISTRY_ADDRESS=$REGISTRY_ADDRESS

# Editor role is now granted in the DeployLocal script if ADDITIONAL_EDITOR is set
# No need for separate cast send command here
export GATSBY_BASE_RPC_URL="http://localhost:8545"

# Debug: Verify the exported address
echo -e "${BLUE}DEBUG: Exported QCI_REGISTRY_ADDRESS=$QCI_REGISTRY_ADDRESS${NC}"
echo -e "${BLUE}DEBUG: Verifying contract at address...${NC}"
CONTRACT_CODE=$(cast code $QCI_REGISTRY_ADDRESS --rpc-url http://localhost:8545 2>/dev/null | head -c 50)
echo -e "${BLUE}DEBUG: Contract code preview: $CONTRACT_CODE...${NC}"

# Verify deployer has admin role
if [ "$DEPLOY_METHOD" = "keystore" ]; then
    DEPLOYER_ADDRESS=$KEYSTORE_ADDRESS
else
    DEPLOYER_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
fi

echo -e "${BLUE}DEBUG: Checking admin role for deployer: $DEPLOYER_ADDRESS${NC}"
ADMIN_ROLE=$(cast call $REGISTRY_ADDRESS "DEFAULT_ADMIN_ROLE()(bytes32)" --rpc-url http://localhost:8545 2>/dev/null)
HAS_ADMIN=$(cast call $REGISTRY_ADDRESS "hasRole(bytes32,address)(bool)" $ADMIN_ROLE $DEPLOYER_ADDRESS --rpc-url http://localhost:8545 2>/dev/null)
echo -e "${BLUE}DEBUG: Deployer has admin role: $HAS_ADMIN${NC}"

# No role granting needed - the deployer is already the admin with keystore method

# Run initial data setup
echo -e "\n${GREEN}3. Setting up initial test data...${NC}"
echo -e "${BLUE}Using registry address for test data: $REGISTRY_ADDRESS${NC}"

if [ "$DEPLOY_METHOD" = "keystore" ]; then
    QCI_REGISTRY_ADDRESS=$REGISTRY_ADDRESS DEPLOYER_ADDRESS=$KEYSTORE_ADDRESS \
        forge script script/LocalQCITest.s.sol:LocalQCITest \
        --rpc-url http://localhost:8545 \
        --account $KEYSTORE_ACCOUNT \
        --sender $KEYSTORE_ADDRESS \
        --broadcast --slow > /tmp/setup.log 2>&1
else
    QCI_REGISTRY_ADDRESS=$REGISTRY_ADDRESS PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" \
        forge script script/LocalQCITest.s.sol:LocalQCITest \
        --rpc-url http://localhost:8545 \
        --broadcast --slow > /tmp/setup.log 2>&1
fi

if grep -q "Error" /tmp/setup.log; then
    echo -e "${YELLOW}⚠️  Some test data setup had errors (this is normal)${NC}"
else
    echo -e "${GREEN}✅ Test data setup complete${NC}"
fi

# Run migration if requested
if [ "$MIGRATE_QCIS" = true ]; then
    if [ "$CONTRACT_EXISTS" = false ]; then
        echo -e "\n${YELLOW}3.5. Skipping QCI Migration - no contract deployed${NC}"
        echo -e "${YELLOW}     Contract size limit prevents deployment${NC}"
    else
        echo -e "\n${GREEN}3.5. Running Batch QCI Migration (209-248)...${NC}"
        echo -e "${YELLOW}Using optimized Foundry batch migration for better performance${NC}"
    
    # Export required environment variables
    export QCI_REGISTRY_ADDRESS=$REGISTRY_ADDRESS
    export VITE_QCI_REGISTRY_ADDRESS=$REGISTRY_ADDRESS
    export VITE_BASE_RPC_URL="http://localhost:8545"
    export GATSBY_QCI_REGISTRY_ADDRESS=$REGISTRY_ADDRESS
    export BASE_RPC_URL="http://localhost:8545"
    export GATSBY_BASE_RPC_URL="http://localhost:8545"
    
    # Configure IPFS based on what's available
    # Use the flag we set earlier when checking/starting IPFS
    if [ "$LOCAL_IPFS_AVAILABLE" = true ]; then
        # Local IPFS is running, use it
        export USE_LOCAL_IPFS=true
        export VITE_USE_LOCAL_IPFS=true
        export VITE_LOCAL_IPFS_API="http://localhost:5001"
        export VITE_LOCAL_IPFS_GATEWAY="http://localhost:8080"
        export GATSBY_LOCAL_IPFS_API="http://localhost:5001"
        export GATSBY_LOCAL_IPFS_GATEWAY="http://localhost:8080"
        echo -e "${YELLOW}Using local IPFS daemon for migration${NC}"
    else
        # No local IPFS, need to use Pinata
        if [ -z "$PINATA_JWT" ]; then
            echo -e "${RED}❌ PINATA_JWT not set. Required for remote IPFS uploads.${NC}"
            echo "Please either:"
            echo "  1. Set USE_LOCAL_IPFS=true in .env.local to start local IPFS"
            echo "  2. Set PINATA_JWT in your .env.local file for Pinata uploads"
            exit 1
        fi
        export USE_LOCAL_IPFS=false
        echo -e "${YELLOW}Using Pinata for IPFS uploads${NC}"
    fi
    
    # Set deployment credentials based on method
    if [ "$DEPLOY_METHOD" = "keystore" ]; then
        # With keystore, we're already authenticated
        echo -e "${YELLOW}Using keystore account for migration: $KEYSTORE_ADDRESS${NC}"
        # Ensure no PRIVATE_KEY pollution from previous runs or sections
        unset PRIVATE_KEY
        echo -e "${BLUE}DEBUG: Unset PRIVATE_KEY to prevent conflicts${NC}"
    else
        # Use the default Anvil account private key
        echo -e "${YELLOW}Using default Anvil account for migration${NC}"
        # Don't export globally - we'll pass it inline to prevent pollution
        # export PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    fi
    
    # Use Foundry script for best performance
    echo -e "${YELLOW}Using Foundry batch migration script...${NC}"
    
    # Debug: Show what address we're passing to migration
    echo -e "${BLUE}DEBUG: Passing QCI_REGISTRY_ADDRESS=$REGISTRY_ADDRESS to migration script${NC}"
    
    # Run the Foundry migration script with FFI for file reading
    # Pass environment variable explicitly
    if [ "$DEPLOY_METHOD" = "keystore" ]; then
        echo -e "${BLUE}DEBUG: Passing DEPLOYER_ADDRESS=$KEYSTORE_ADDRESS to migration${NC}"
        QCI_REGISTRY_ADDRESS=$REGISTRY_ADDRESS DEPLOYER_ADDRESS=$KEYSTORE_ADDRESS \
            forge script script/MigrateBatchWithFFI.s.sol \
            --rpc-url http://localhost:8545 \
            --broadcast \
            --account $KEYSTORE_ACCOUNT \
            --sender $KEYSTORE_ADDRESS \
            --ffi \
            -vvv
    else
        echo -e "${BLUE}DEBUG: Using inline PRIVATE_KEY for migration${NC}"
        QCI_REGISTRY_ADDRESS=$REGISTRY_ADDRESS PRIVATE_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" \
            forge script script/MigrateBatchWithFFI.s.sol \
            --rpc-url http://localhost:8545 \
            --broadcast \
            --ffi \
            -vvv
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ QCI migration complete${NC}"
        
        # Show migration summary
        echo -e "\n${BLUE}📊 Migration Summary:${NC}"
        cast call $REGISTRY_ADDRESS "nextQCINumber()(uint256)" --rpc-url http://localhost:8545 | xargs -I {} echo "Next QCI Number: {}"
        
        # Try to get count of migrated QCIs
        MIGRATED_COUNT=$(cast call $REGISTRY_ADDRESS "nextQCINumber()(uint256)" --rpc-url http://localhost:8545 2>/dev/null || echo "0")
        if [ "$MIGRATED_COUNT" -gt "208" ]; then
            ACTUAL_MIGRATED=$((MIGRATED_COUNT - 208))
            echo "QCIs migrated: ~$ACTUAL_MIGRATED"
        fi
    else
        echo -e "${YELLOW}⚠️  QCI migration had some errors (check logs above)${NC}"
        echo "You can retry migration by running:"
        echo "  forge script script/MigrateBatchWithFFI.s.sol --rpc-url http://localhost:8545 --broadcast --ffi"
    fi
    fi  # Close the CONTRACT_EXISTS check
fi

# Start Vite in development mode
echo -e "\n${GREEN}4. Starting Vite development server...${NC}"
# Export registry address and RPC URL for Vite
export VITE_QCI_REGISTRY_ADDRESS=$REGISTRY_ADDRESS
export VITE_BASE_RPC_URL="http://localhost:8545"
# Export IPFS settings for Vite if local IPFS is available
if [ "$LOCAL_IPFS_AVAILABLE" = true ]; then
    export VITE_USE_LOCAL_IPFS=true
    export VITE_LOCAL_IPFS_API="http://localhost:5001"
    export VITE_LOCAL_IPFS_GATEWAY="http://localhost:8080"
fi
# Run Vite with environment variables
# Force local mode for this script
# Clear multiple RPCs to ensure only local Anvil is used
unset VITE_BASE_RPC_URLS
VITE_QCI_REGISTRY_ADDRESS=$REGISTRY_ADDRESS \
VITE_BASE_RPC_URL="http://localhost:8545" \
VITE_USE_LOCAL_IPFS=true \
VITE_USE_MAI_API=false \
VITE_LOCAL_MODE=true \
VITE_LOCAL_IPFS_API="http://localhost:5001" \
VITE_LOCAL_IPFS_GATEWAY="http://localhost:8080" \
bun run dev &
VITE_PID=$!
echo "Vite PID: $VITE_PID"

# Wait for Vite to start
echo -e "${YELLOW}Waiting for Vite to start...${NC}"
MAX_VITE_RETRIES=30
VITE_RETRY_COUNT=0
while [ $VITE_RETRY_COUNT -lt $MAX_VITE_RETRIES ]; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        break
    fi
    VITE_RETRY_COUNT=$((VITE_RETRY_COUNT + 1))
    sleep 2
    echo -n "."
done
echo ""

if [ $VITE_RETRY_COUNT -eq $MAX_VITE_RETRIES ]; then
    echo -e "${RED}❌ Vite failed to start${NC}"
    exit 1
fi

# Display information
echo -e "\n${GREEN}✅ Local Development Environment Ready!${NC}"
echo "================================================"
echo -e "${BLUE}📋 Services Running:${NC}"
echo "- Anvil (Blockchain): http://localhost:8545"
echo "- Vite (Frontend): http://localhost:3000"
if [ "$USE_LOCAL_IPFS" = "true" ]; then
    echo "- IPFS API: http://localhost:5001"
    echo "- IPFS Gateway: http://localhost:8080"
fi
echo ""
echo -e "${BLUE}📊 Contract Information:${NC}"
echo "- QCI Registry: $REGISTRY_ADDRESS"
echo "- Chain ID: 8453 (Base Fork)"
if [ "$DEPLOY_METHOD" = "keystore" ]; then
    echo "- Deployed by: $KEYSTORE_ADDRESS (keystore: $KEYSTORE_ACCOUNT)"
    echo "- Admin: $KEYSTORE_ADDRESS"
else
    echo "- Deployed by: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (Anvil account 0)"
    echo "- Admin: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
fi
echo ""
echo -e "${BLUE}🔑 Test Accounts:${NC}"
echo "- Governance: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
echo "- Editor: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
echo "- Author1: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
echo "- Author2: 0x90F79bf6EB2c4f870365E785982E1f101E93b906"
echo ""
echo -e "${BLUE}📝 Initial QCIs:${NC}"
if [ "$MIGRATE_QCIS" = true ]; then
    echo "- QCI-209 to QCI-248: Migrated from existing files"
fi
echo "- QCI-249: Dynamic Interest Rates (by Author1)"
echo "- QCI-250: Multi-Collateral Support (by Author2)"
echo "- QCI-251: Staking Rewards (by Author3)"
echo ""
echo -e "${YELLOW}💡 Tips:${NC}"
echo "- Connect your wallet to http://localhost:8545"
echo "- Import test accounts using private keys from Anvil"
echo "- Visit http://localhost:3000/create-proposal to create new QCIs"
echo "- All changes are local and will be reset on restart"
if [ "$MIGRATE_QCIS" = false ]; then
    echo "- Run with --migrate flag to populate QCIs 209-248 from existing files"
fi
echo ""
echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"

# Keep script running and show logs
tail -f /tmp/anvil.log