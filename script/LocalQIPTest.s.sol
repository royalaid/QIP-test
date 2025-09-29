// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import {QCIRegistry} from "../contracts/QCIRegistry.sol";

contract LocalQCITest is Script {
    QCIRegistry public registry;
    
    // Test accounts from Anvil's default mnemonic
    address constant GOVERNANCE = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address constant EDITOR = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address constant AUTHOR1 = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    address constant AUTHOR2 = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;
    address constant AUTHOR3 = 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65;
    
    function run() public {
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        
        // Get registry address from environment variable
        address registryAddress = vm.envAddress("QCI_REGISTRY_ADDRESS");
        registry = QCIRegistry(registryAddress);
        console.log("Using QCIRegistry at:", address(registry));
        
        vm.startBroadcast(deployerPrivateKey);
        
        // Setup roles (governance account should already have permissions)
        registry.setEditor(EDITOR, true);
        console.log("Editor role granted to:", EDITOR);
        
        vm.stopBroadcast();
        
        // Create test QCIs as different authors
        _createTestQCIs();
        
        // Don't create fake historical QCIs - we have real ones from migration
        // _migrateHistoricalQCIs();
        
        // Simulate QCI lifecycle
        _simulateQCILifecycle();
        
        console.log("\n=== Local QCI Test Setup Complete ===");
        console.log("Registry Address:", address(registry));
        console.log("Governance:", GOVERNANCE);
        console.log("Editor:", EDITOR);
        console.log("Test Authors:", AUTHOR1, AUTHOR2, AUTHOR3);
        console.log("\nNext QCI Number:", registry.nextQCINumber());
    }
    
    function _createTestQCIs() internal {
        // Check if we need to create test QCIs or if they already exist
        uint256 currentNextQCI = registry.nextQCINumber();
        
        // With the new setup, we start at 209, so test QCIs would be created at 209, 210, 211
        // But we want to preserve 209-248 for migration, so let's create test QCIs at 249+
        if (currentNextQCI > 252) {
            console.log("Test QCIs already exist, skipping creation");
            console.log("Current nextQCINumber:", currentNextQCI);
            return;
        }
        
        // If we're starting fresh at 209, we need to skip to 249 for test QCIs
        if (currentNextQCI < 249) {
            console.log("Registry starts at", currentNextQCI, "- will create test QCIs at 249+");
            // We'll use migrateQCI to create them at specific numbers
            return;
        }
        
        // Use governance account to migrate test QCIs at specific numbers
        vm.startBroadcast(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80);
        
        // Check if QCI-249 already exists
        try registry.qcis(249) returns (uint256 qciNum, address, string memory, string memory, bytes32, string memory, uint256, uint256, bytes32, string memory, uint256, string memory, uint256) {
            if (qciNum == 249) {
                console.log("QCI-249 already exists, skipping test QCI creation");
                vm.stopBroadcast();
                return;
            }
        } catch {
            // QCI doesn't exist, continue with creation
        }
        
        // Migrate test QCIs at specific numbers with real IPFS content
        registry.migrateQCI(
            249,
            AUTHOR1,
            "Implement Dynamic Interest Rates",
            "Polygon",
            keccak256("QCI-249: Dynamic Interest Rate Model Implementation"),
            "ipfs://QmWYqKxQPcsAkTLvkGZmZP9oWAEeCYP8J7X5XvKeEHEeC1",
            block.timestamp,
            "Draft",
            "None",
            0,
            ""
        );
        console.log("Created QCI-249 (Draft) by AUTHOR1");
        
        registry.migrateQCI(
            250,
            AUTHOR2,
            "Add Support for New Collateral Types",
            "Base",
            keccak256("QCI-250: Multi-Collateral Support"),
            "ipfs://QmXRwXY9QBdAnu3r6hWCaCYKv2Xn5jtB8ZzyS53dQzHDuo",
            block.timestamp,
            "Draft",
            "None",
            0,
            ""
        );
        console.log("Created QCI-250 (Draft) by AUTHOR2");
        
        registry.migrateQCI(
            251,
            AUTHOR3,
            "Governance Token Staking Rewards",
            "Ethereum",
            keccak256("QCI-251: Staking Rewards Program"),
            "ipfs://QmUJcCwZBKtgF5PjbwSEBVT9royDfpwtt6FRE36N42km1M",
            block.timestamp,
            "Draft",
            "None",
            0,
            ""
        );
        console.log("Created QCI-251 (Draft) by AUTHOR3");
        
        vm.stopBroadcast();
    }
    
    // Removed _migrateHistoricalQCIs - we use real QCIs from migration instead
    
    function _simulateQCILifecycle() internal {
        // Check if test QCI-249 exists before trying to simulate lifecycle
        try registry.qcis(249) returns (uint256 qciNum, address, string memory, string memory, bytes32, string memory, uint256, uint256, bytes32, string memory, uint256, string memory, uint256) {
            if (qciNum != 249) {
                console.log("QCI-249 does not exist, skipping lifecycle simulation");
                return;
            }
        } catch {
            console.log("QCI-249 does not exist, skipping lifecycle simulation");
            return;
        }
        
        // Only simulate lifecycle if QCI-249 exists and is in Draft status
        (, , , , , , , , bytes32 status249, , , ,) = registry.qcis(249);
        if (status249 != keccak256("Draft")) {
            console.log("QCI-249 is not in Draft status, skipping lifecycle simulation");
            return;
        }
        
        // Move QCI-249 through lifecycle (use governance account for editor operations)
        vm.startBroadcast(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80);
        
        registry.updateStatus(249, "Ready for Snapshot");
        console.log("\nQCI-249: Draft -> Ready for Snapshot");
        
        vm.stopBroadcast();
        
        // Author updates the QCI content
        vm.startBroadcast(0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d);
        
        registry.updateQCI(
            249,
            "Implement Dynamic Interest Rates (Revised)",
            "Polygon",
            "Core Team",
            keccak256("QCI-249: Dynamic Interest Rate Model Implementation v2"),
            "ipfs://QmWYqKxQPcsAkTLvkGZmZP9oWAEeCYP8J7X5XvKeEHEeC1", // Using same CID for simplicity
            "Added more detailed implementation specs"
        );
        console.log("QCI-249: Updated to version 2");
        
        // Link to Snapshot
        registry.linkSnapshotProposal(249, "snapshot.org/#/qidao.eth/proposal/0x249test");
        console.log("QCI-249: Linked to Snapshot (auto-status: VotePending)");
        
        vm.stopBroadcast();
        
        // Editor approves after vote passes (use governance account for editor operations)
        vm.startBroadcast(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80);
        
        registry.updateStatus(249, "Posted to Snapshot");
        console.log("QCI-249: Ready for Snapshot -> Posted to Snapshot");
        
        // Set implementation details
        registry.setImplementation(249, "Core Team", block.timestamp + 7 days);
        console.log("QCI-249: Implementation scheduled");
        
        
        // Move QCI-250 to voting
        registry.updateStatus(250, "Ready for Snapshot");
        console.log("\nQCI-250: Draft -> Ready for Snapshot");
        
        vm.stopBroadcast();
        
        // Disable migration mode
        vm.startBroadcast(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80);
        registry.disableMigrationMode();
        console.log("\nMigration mode disabled");
        vm.stopBroadcast();
    }
}