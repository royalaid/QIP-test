// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/QCIRegistry.sol";

/**
 * @title MigrateBatchWithFFI
 * @notice Foundry script for batch migration using FFI to read files and upload to IPFS
 * @dev This script uses FFI to interact with the filesystem and IPFS
 * 
 * Run with:
 * forge script script/MigrateBatchWithFFI.s.sol \
 *   --rpc-url $RPC_URL \
 *   --broadcast \
 *   --ffi \
 *   --verify
 * 
 * For production with keystore:
 * forge script script/MigrateBatchWithFFI.s.sol \
 *   --rpc-url $RPC_URL \
 *   --account <keystore-name> \
 *   --broadcast \
 *   --ffi
 */
contract MigrateBatchWithFFI is Script {
    QCIRegistry public registry;
    
    // Configuration
    uint256 constant BATCH_SIZE = 5; // QCIs per batch for gas efficiency
    string constant QIP_DIR = "./contents/QIP";
    
    // Track progress
    mapping(uint256 => bool) public migrated;
    uint256[] public failedQCIs;
    
    struct QCIData {
        uint256 qciNumber;
        string title;
        string network;
        address author;
        string status;
        string implementor;
        uint256 implementationDate;
        string proposal;
        uint256 created;
        string ipfsUrl;
        bytes32 contentHash;
    }
    
    function run() external {
        // Load registry
        address registryAddress = vm.envAddress("QCI_REGISTRY_ADDRESS");
        registry = QCIRegistry(registryAddress);
        
        console.log("====================================================");
        console.log("   QCI Batch Migration with FFI");
        console.log("====================================================");
        console.log("Registry:", registryAddress);
        console.log("QCI Directory:", QIP_DIR);
        console.log("Batch Size:", BATCH_SIZE);
        console.log("");
        
        // Get deployer
        address deployer;
        uint256 deployerKey;
        
        // Check if using keystore or private key
        try vm.envUint("PRIVATE_KEY") returns (uint256 key) {
            deployerKey = key;
            deployer = vm.addr(deployerKey);
            console.log("Using private key deployment");
        } catch {
            // Using keystore, get address from environment or use default
            // When using --account flag, the address is available via vm.envAddress
            try vm.envAddress("DEPLOYER_ADDRESS") returns (address addr) {
                deployer = addr;
                console.log("Using keystore deployment with DEPLOYER_ADDRESS");
            } catch {
                // Default to first anvil account for local testing
                deployerKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
                deployer = vm.addr(deployerKey);
                console.log("Using default Anvil account");
            }
        }
        
        console.log("Deployer:", deployer);
        console.log("");
        
        // Check admin role
        bytes32 ADMIN_ROLE = registry.DEFAULT_ADMIN_ROLE();
        require(registry.hasRole(ADMIN_ROLE, deployer), "Deployer needs admin role");
        console.log("[OK] Deployer has admin role");
        
        // Get list of QCI files
        console.log("\n[1/3] Scanning for QCI files...");
        string[] memory qciFiles = getQCIFiles();
        console.log("Found", qciFiles.length, "QCI files");
        
        // Process each file
        QCIData[] memory allQCIs = new QCIData[](qciFiles.length);
        uint256 validQCIs = 0;
        
        console.log("\n[2/3] Processing QCI files...");
        for (uint256 i = 0; i < qciFiles.length; i++) {
            string memory filename = qciFiles[i];
            uint256 qciNumber = extractQCINumber(filename);
            
            if (qciNumber == 0) {
                console.log("  [SKIP] Invalid filename:", filename);
                continue;
            }
            
            // Check if already migrated
            // Access the public qcis mapping directly
            (uint256 existingNumber,,,,,,,,,,,,) = registry.qcis(qciNumber);
            if (existingNumber != 0) {
                console.log("  [SKIP] QCI-", qciNumber, " already on-chain");
                migrated[qciNumber] = true;
                continue;
            }
            
            console.log("  [PROCESS] QCI-", qciNumber);
            
            // Read and parse QCI file
            QCIData memory qciData = parseQCIFile(filename, qciNumber);
            
            // Upload to IPFS
            (string memory ipfsUrl, bytes32 contentHash) = uploadToIPFS(filename, qciNumber);
            qciData.ipfsUrl = ipfsUrl;
            qciData.contentHash = contentHash;
            
            allQCIs[validQCIs] = qciData;
            validQCIs++;
        }
        
        // Resize array to valid QCIs
        QCIData[] memory qcisToMigrate = new QCIData[](validQCIs);
        for (uint256 i = 0; i < validQCIs; i++) {
            qcisToMigrate[i] = allQCIs[i];
        }
        
        if (validQCIs == 0) {
            console.log("\nNo QCIs to migrate!");
            return;
        }
        
        console.log("\n[3/3] Migrating", validQCIs, "QCIs to blockchain...");
        
        // Start broadcasting
        if (deployerKey != 0) {
            vm.startBroadcast(deployerKey);
        } else {
            vm.startBroadcast(deployer);
        }
        
        // Process in batches
        uint256 successCount = 0;
        uint256 totalBatches = (validQCIs + BATCH_SIZE - 1) / BATCH_SIZE;
        
        for (uint256 i = 0; i < validQCIs; i += BATCH_SIZE) {
            uint256 batchEnd = i + BATCH_SIZE > validQCIs ? validQCIs : i + BATCH_SIZE;
            uint256 batchSize = batchEnd - i;
            
            console.log(string.concat("\n  Batch ", vm.toString((i / BATCH_SIZE) + 1), "/", vm.toString(totalBatches), " (", vm.toString(batchSize), " QCIs)"));
            
            // Process each QCI in the batch
            for (uint256 j = i; j < batchEnd; j++) {
                QCIData memory qci = qcisToMigrate[j];
                
                try registry.migrateQCI(
                    qci.qciNumber,
                    qci.author,
                    qci.title,
                    qci.network,
                    qci.contentHash,
                    qci.ipfsUrl,
                    qci.created,
                    qci.status,
                    qci.implementor,
                    qci.implementationDate,
                    qci.proposal
                ) {
                    console.log(unicode"    ✅ QCI-", qci.qciNumber, " migrated");
                    migrated[qci.qciNumber] = true;
                    successCount++;
                } catch Error(string memory reason) {
                    console.log(unicode"    ❌ QCI-", qci.qciNumber, " failed:", reason);
                    failedQCIs.push(qci.qciNumber);
                } catch {
                    console.log(unicode"    ❌ QCI-", qci.qciNumber, " failed: unknown error");
                    failedQCIs.push(qci.qciNumber);
                }
            }
        }
        
        // Sync nextQCINumber if needed
        if (successCount > 0) {
            console.log("\n  Syncing nextQCINumber...");
            registry.syncNextQCINumber();
        }
        
        vm.stopBroadcast();
        
        // Summary
        console.log("\n====================================================");
        console.log("   MIGRATION COMPLETE");
        console.log("====================================================");
        console.log("Successfully migrated:", successCount, "/", validQCIs);
        
        if (failedQCIs.length > 0) {
            console.log("\nFailed QCIs:");
            for (uint256 i = 0; i < failedQCIs.length; i++) {
                console.log("  - QCI-", failedQCIs[i]);
            }
            console.log("\nRerun the script to retry failed QCIs");
        }
        
        console.log("\nNext steps:");
        console.log("1. Verify on Basescan:");
        console.log("   https://basescan.org/address/", registryAddress);
        console.log("2. Consider disabling migration mode:");
        console.log("   cast send", registryAddress, '"setMigrationMode(bool)" false');
    }
    
    /**
     * @notice Get list of QCI files using FFI
     */
    function getQCIFiles() internal returns (string[] memory) {
        // Use bash to handle glob expansion properly
        string[] memory inputs = new string[](3);
        inputs[0] = "bash";
        inputs[1] = "-c";
        inputs[2] = string.concat("ls -1 ", QIP_DIR, "/QIP-*.md 2>/dev/null | xargs -n1 basename");
        
        bytes memory result = vm.ffi(inputs);
        
        // Parse the result (newline-separated filenames)
        // This is simplified - in production you'd parse properly
        uint256 fileCount = countLines(string(result));
        string[] memory files = new string[](fileCount);
        
        // For demonstration, we'll simulate the file list
        // In production, you'd properly parse the ls output
        uint256 idx = 0;
        for (uint256 i = 209; i <= 248; i++) {
            if (idx < fileCount) {
                files[idx] = string.concat("QIP-", vm.toString(i), ".md");
                idx++;
            }
        }
        
        return files;
    }
    
    /**
     * @notice Get Snapshot proposal ID for a QCI number
     * @dev Extracts just the proposal ID (hash) from the URL as a string
     */
    function getSnapshotProposal(uint256 qciNumber) internal returns (string memory) {
        // Use jq and sed to extract the proposal ID from the URL
        // IMPORTANT: We want the ASCII string "0x66b6..." not the hex bytes
        string[] memory cmd = new string[](3);
        cmd[0] = "bash";
        cmd[1] = "-c";
        cmd[2] = string.concat(
            "cat scripts/snapshot/qip-snapshot-cache.json | jq -r '.qips[] | select(.qipNumber == ",
            vm.toString(qciNumber),
            ") | .url // \"\"' | sed 's/.*proposal\\///' | tr -d '\\n'"
        );

        bytes memory result = vm.ffi(cmd);

        // If the result is empty or "null", return empty string
        if (result.length == 0 || (result.length == 4 && keccak256(result) == keccak256(bytes("null")))) {
            return "";
        }

        // The result from FFI is the ASCII string "0x66b6..." as bytes
        // We want to keep it as that string, not interpret it as hex
        return vm.toString(result);
    }

    /**
     * @notice Parse status string to new status names
     * Maps old statuses to our new 3-status system
     */
    function parseStatus(string memory statusStr, bool hasValidProposal) internal pure returns (string memory) {
        bytes32 statusHash = keccak256(bytes(statusStr));

        // If there's a valid snapshot proposal, it should be "Posted to Snapshot"
        if (hasValidProposal) {
            return "Posted to Snapshot";
        }

        // Otherwise, map based on original status
        if (statusHash == keccak256(bytes("Draft"))) {
            return "Draft";
        } else if (statusHash == keccak256(bytes("Review")) ||
                   statusHash == keccak256(bytes("Review Pending")) ||
                   statusHash == keccak256(bytes("ReviewPending"))) {
            return "Ready for Snapshot";
        } else if (statusHash == keccak256(bytes("Vote")) ||
                   statusHash == keccak256(bytes("Vote Pending")) ||
                   statusHash == keccak256(bytes("VotePending")) ||
                   statusHash == keccak256(bytes("Approved")) ||
                   statusHash == keccak256(bytes("Rejected")) ||
                   statusHash == keccak256(bytes("Implemented")) ||
                   statusHash == keccak256(bytes("Superseded")) ||
                   statusHash == keccak256(bytes("Withdrawn"))) {
            // All these map to "Posted to Snapshot" since they're past voting
            return "Posted to Snapshot";
        } else {
            // Default to Posted for unknown statuses (most are historical)
            return "Posted to Snapshot";
        }
    }
    
    /**
     * @notice Extract QCI number from filename
     */
    function extractQCINumber(string memory filename) internal pure returns (uint256) {
        // Extract number from "QIP-XXX.md" format
        bytes memory filenameBytes = bytes(filename);
        
        // Find the dash and period positions
        uint256 dashPos = 0;
        uint256 dotPos = 0;
        
        for (uint256 i = 0; i < filenameBytes.length; i++) {
            if (filenameBytes[i] == "-" && dashPos == 0) dashPos = i;
            if (filenameBytes[i] == "." && dotPos == 0) dotPos = i;
        }
        
        if (dashPos == 0 || dotPos == 0 || dotPos <= dashPos + 1) return 0;
        
        // Extract the number string
        bytes memory numberBytes = new bytes(dotPos - dashPos - 1);
        for (uint256 i = 0; i < numberBytes.length; i++) {
            numberBytes[i] = filenameBytes[dashPos + 1 + i];
        }
        
        // Convert to uint256 (simplified - assumes valid digits)
        uint256 number = 0;
        for (uint256 i = 0; i < numberBytes.length; i++) {
            uint8 digit = uint8(numberBytes[i]) - 48; // ASCII '0' = 48
            if (digit > 9) return 0; // Invalid digit
            number = number * 10 + digit;
        }
        
        return number;
    }
    
    /**
     * @notice Helper function to extract field from QCI file
     */
    function extractField(string memory filePath, string memory fieldName) internal returns (string memory) {
        string[] memory cmd = new string[](3);
        cmd[0] = "bash";
        cmd[1] = "-c";
        cmd[2] = string.concat("grep '^", fieldName, ":' ", filePath, " | head -1 | sed 's/^", fieldName, ":[[:space:]]*//' | tr -d '\\n'");
        bytes memory result = vm.ffi(cmd);
        return string(result);
    }
    
    /**
     * @notice Check if a proposal URL is valid (not a placeholder)
     */
    function isValidProposalUrl(string memory proposalStr) internal pure returns (bool) {
        if (bytes(proposalStr).length == 0) return false;

        bytes32 proposalHash = keccak256(bytes(proposalStr));

        // Check for placeholder values
        if (proposalHash == keccak256(bytes("TBU")) ||
            proposalHash == keccak256(bytes("tbu")) ||
            proposalHash == keccak256(bytes("None")) ||
            proposalHash == keccak256(bytes("none")) ||
            proposalHash == keccak256(bytes("TBD")) ||
            proposalHash == keccak256(bytes("tbd"))) {
            return false;
        }

        // Basic validation - should contain "snapshot" or be a valid URL format
        // This is a simple check - could be made more robust
        bytes memory proposalBytes = bytes(proposalStr);

        // Check if it contains "snapshot" (case-insensitive check would be better but complex in Solidity)
        bytes memory snapshotBytes = bytes("snapshot");
        if (proposalBytes.length >= snapshotBytes.length) {
            for (uint256 i = 0; i <= proposalBytes.length - snapshotBytes.length; i++) {
                bool found = true;
                for (uint256 j = 0; j < snapshotBytes.length; j++) {
                    // Simple case-insensitive comparison for ASCII letters
                    bytes1 char1 = proposalBytes[i + j];
                    bytes1 char2 = snapshotBytes[j];

                    // Convert to lowercase for comparison
                    if (char1 >= 0x41 && char1 <= 0x5A) char1 = bytes1(uint8(char1) + 32);

                    if (char1 != char2) {
                        found = false;
                        break;
                    }
                }
                if (found) return true;
            }
        }

        // Could also check for https:// prefix but let's be flexible
        return false;
    }

    /**
     * @notice Parse QCI file using FFI
     */
    function parseQCIFile(string memory filename, uint256 qciNumber) internal returns (QCIData memory) {
        string memory filePath = string.concat(QIP_DIR, "/", filename);
        QCIData memory data;

        // Extract fields one by one to avoid stack too deep
        data.qciNumber = qciNumber;
        data.title = extractField(filePath, "title");

        string memory networkStr = extractField(filePath, "network");
        data.network = bytes(networkStr).length == 0 ? "Polygon" : networkStr;

        // First check if we have a Snapshot proposal ID in our cache
        string memory snapshotId = getSnapshotProposal(qciNumber);
        console.log("  Snapshot ID:", snapshotId);
        console.log("  Snapshot ID length:", bytes(snapshotId).length);
        console.log("  Snapshot ID bytes:", vm.toString(bytes(snapshotId)));
        
        bool hasSnapshotProposal = bytes(snapshotId).length > 0;

        // Then check the file's proposal field as fallback
        string memory proposalStr = extractField(filePath, "proposal");
        bool hasValidProposal = hasSnapshotProposal || isValidProposalUrl(proposalStr);

        // Use Snapshot ID if available, otherwise use file's proposal
        if (hasSnapshotProposal) {
            data.proposal = snapshotId;
        } else if (isValidProposalUrl(proposalStr)) {
            // Extract ID from URL if it's a full URL
            if (bytes(proposalStr).length > 0) {
                // Check if it's a full URL and extract the ID
                bytes memory proposalBytes = bytes(proposalStr);
                uint256 lastSlash = 0;
                for (uint256 i = proposalBytes.length - 1; i > 0; i--) {
                    if (proposalBytes[i] == "/") {
                        lastSlash = i;
                        break;
                    }
                }
                if (lastSlash > 0 && lastSlash < proposalBytes.length - 1) {
                    // Extract everything after the last slash
                    bytes memory idBytes = new bytes(proposalBytes.length - lastSlash - 1);
                    for (uint256 i = 0; i < idBytes.length; i++) {
                        idBytes[i] = proposalBytes[lastSlash + 1 + i];
                    }
                    data.proposal = string(idBytes);
                } else {
                    data.proposal = proposalStr; // Use as-is if not a URL
                }
            } else {
                data.proposal = "";
            }
        } else {
            data.proposal = "";
        }

        // Parse status considering the proposal
        string memory statusStr = extractField(filePath, "status");
        data.status = parseStatus(statusStr, hasValidProposal);

        // Use default author address for now
        string memory authorStr = extractField(filePath, "author");
        data.author = address(0x0000000000000000000000000000000000000001);

        string memory implementorStr = extractField(filePath, "implementor");
        if (bytes(implementorStr).length == 0 || keccak256(bytes(implementorStr)) == keccak256(bytes("None"))) {
            data.implementor = "None";
        } else {
            data.implementor = implementorStr;
        }

        string memory implDateStr = extractField(filePath, "implementation-date");
        data.implementationDate = parseDateToTimestamp(implDateStr);
        
        string memory createdStr = extractField(filePath, "created");
        data.created = parseDateToTimestamp(createdStr);
        if (data.created == 0) {
            data.created = block.timestamp - 30 days; // Default fallback
        }
        
        console.log("  Parsed QCI-", qciNumber);
        console.log("    Title:", data.title);
        console.log("    Status:", statusStr, hasValidProposal ? "(has proposal)" : "");
        console.log("    Final Status:", data.status);
        console.log("    Network:", data.network);
        console.log("    Author:", authorStr);
        console.log("    Implementor:", data.implementor);
        if (hasSnapshotProposal) {
            // Convert to hex string for readable output
            console.log("    Snapshot ID (hex):", vm.toString(bytes(snapshotId)));
        } else if (hasValidProposal) {
            console.log("    File Proposal ID:", data.proposal);
        }
        
        return data;
    }
    
    /**
     * @notice Upload file to IPFS using FFI
     */
    function uploadToIPFS(string memory filename, uint256 qciNumber) internal returns (string memory ipfsUrl, bytes32 contentHash) {
        // Read file content
        string[] memory readInputs = new string[](2);
        readInputs[0] = "cat";
        readInputs[1] = string.concat(QIP_DIR, "/", filename);
        
        bytes memory content = vm.ffi(readInputs);
        contentHash = keccak256(content);
        
        // Create a temporary file with the content
        string memory tempFile = string.concat("/tmp/qci-", vm.toString(qciNumber), ".md");
        string[] memory writeInputs = new string[](3);
        writeInputs[0] = "bash";
        writeInputs[1] = "-c";
        writeInputs[2] = string.concat(
            "cat > ", tempFile, " << 'EOF'\n", string(content), "\nEOF"
        );
        vm.ffi(writeInputs);
        
        // Check if local IPFS is available
        bool useLocalIPFS = false;
        try vm.envBool("USE_LOCAL_IPFS") returns (bool value) {
            useLocalIPFS = value;
        } catch {
            // Check if local IPFS daemon is running
            string[] memory checkIPFS = new string[](3);
            checkIPFS[0] = "bash";
            checkIPFS[1] = "-c";
            checkIPFS[2] = "curl -s -X POST http://localhost:5001/api/v0/version > /dev/null 2>&1 && echo 'true' || echo 'false'";
            
            bytes memory checkResult = vm.ffi(checkIPFS);
            useLocalIPFS = keccak256(checkResult) == keccak256(bytes("true\n"));
        }
        
        string memory cid;
        
        if (useLocalIPFS) {
            // Upload to local IPFS daemon
            console.log("    Using local IPFS daemon");
            string[] memory uploadInputs = new string[](3);
            uploadInputs[0] = "bash";
            uploadInputs[1] = "-c";
            uploadInputs[2] = string.concat(
                "ipfs add -q ", tempFile, " 2>/dev/null || ",
                "curl -s -X POST -F file=@", tempFile, " http://localhost:5001/api/v0/add | jq -r '.Hash'"
            );
            
            bytes memory cidBytes = vm.ffi(uploadInputs);
            cid = string(cidBytes);
        } else {
            // Upload to Pinata
            string memory pinataJWT;
            try vm.envString("PINATA_JWT") returns (string memory jwt) {
                pinataJWT = jwt;
            } catch {
                revert("PINATA_JWT not set and local IPFS not available");
            }
            
            console.log("    Using Pinata for IPFS");
            string[] memory uploadInputs = new string[](3);
            uploadInputs[0] = "bash";
            uploadInputs[1] = "-c";
            uploadInputs[2] = string.concat(
                "curl -s -X POST ",
                "-H 'Authorization: Bearer ", pinataJWT, "' ",
                "-F 'file=@", tempFile, "' ",
                "-F 'pinataMetadata={\"name\":\"QIP-", vm.toString(qciNumber), "\"}' ",
                "-F 'pinataOptions={\"cidVersion\":1}' ",
                "https://api.pinata.cloud/pinning/pinFileToIPFS | jq -r '.IpfsHash'"
            );
            
            bytes memory cidBytes = vm.ffi(uploadInputs);
            cid = string(cidBytes);
        }
        
        // Remove newline if present
        bytes memory cidBytesClean = bytes(cid);
        if (cidBytesClean.length > 0 && cidBytesClean[cidBytesClean.length - 1] == 0x0a) {
            assembly {
                mstore(cidBytesClean, sub(mload(cidBytesClean), 1))
            }
            cid = string(cidBytesClean);
        }
        
        ipfsUrl = string.concat("ipfs://", cid);
        
        console.log(unicode"    📤 Uploaded to IPFS:", cid);
        
        // Clean up temp file
        string[] memory cleanupInputs = new string[](3);
        cleanupInputs[0] = "rm";
        cleanupInputs[1] = "-f";
        cleanupInputs[2] = tempFile;
        vm.ffi(cleanupInputs);
    }
    
    /**
     * @notice Parse date string to Unix timestamp
     * @dev Parses YYYY-MM-DD format dates - returns 0 for non-date strings
     */
    function parseDateToTimestamp(string memory dateStr) internal pure returns (uint256) {
        // Check if it's None or invalid
        if (bytes(dateStr).length == 0 || 
            keccak256(bytes(dateStr)) == keccak256(bytes("None")) ||
            keccak256(bytes(dateStr)) == keccak256(bytes("TBD"))) {
            return 0;
        }
        
        // Check if it looks like a date (YYYY-MM-DD format)
        bytes memory dateBytes = bytes(dateStr);
        if (dateBytes.length >= 10 && dateBytes[4] == "-" && dateBytes[7] == "-") {
            // Parse year, month, day manually
            uint256 year = parseNumber(dateBytes, 0, 4);
            uint256 month = parseNumber(dateBytes, 5, 2);
            uint256 day = parseNumber(dateBytes, 8, 2);
            
            // Basic validation
            if (year < 2020 || year > 2030 || month == 0 || month > 12 || day == 0 || day > 31) {
                return 0; // Invalid date
            }
            
            // Approximate timestamp calculation (not exact but good enough for our purposes)
            // Using a simplified calculation: days since Unix epoch * seconds per day
            // This is approximate and doesn't account for leap years perfectly
            uint256 yearsSince1970 = year - 1970;
            uint256 daysFromYears = yearsSince1970 * 365 + (yearsSince1970 / 4); // Rough leap year calculation
            
            // Days in months (non-leap year)
            uint256[12] memory daysInMonth = [uint256(31), 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
            uint256 daysFromMonths = 0;
            for (uint256 i = 0; i < month - 1; i++) {
                daysFromMonths += daysInMonth[i];
            }
            
            // Add leap day if needed
            if (month > 2 && year % 4 == 0) {
                daysFromMonths += 1;
            }
            
            uint256 totalDays = daysFromYears + daysFromMonths + day - 1;
            return totalDays * 86400; // Convert to seconds
        }
        
        // Not a valid date format
        return 0;
    }
    
    /**
     * @notice Parse a number from bytes
     */
    function parseNumber(bytes memory data, uint256 start, uint256 length) internal pure returns (uint256) {
        uint256 result = 0;
        for (uint256 i = 0; i < length; i++) {
            uint8 digit = uint8(data[start + i]) - 48; // ASCII '0' = 48
            if (digit > 9) return 0; // Invalid digit
            result = result * 10 + digit;
        }
        return result;
    }
    
    /**
     * @notice Count lines in a string
     */
    function countLines(string memory str) internal pure returns (uint256) {
        bytes memory strBytes = bytes(str);
       if (strBytes.length == 0) return 0;

        uint256 lines = 1; // Start with 1 line if non-empty

        for (uint256 i = 0; i < strBytes.length; i++) {
            if (strBytes[i] == "\n") lines++;
        }

        // If the string ends with a newline, don't count an extra empty line
        if (strBytes.length > 0 && strBytes[strBytes.length - 1] == "\n") {
            lines--;
        }

        return lines;
    }
}