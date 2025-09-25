// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import "../contracts/QCIRegistry.sol";

contract Deploy is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("Deploying contracts with account:", deployer);
        console.log("Account balance:", deployer.balance);
        
        vm.startBroadcast(deployerPrivateKey);

        // Deploy QCIRegistry with starting QCI number
        // Start at 209 to allow migration of existing QCIs (209-248)
        QCIRegistry registry = new QCIRegistry(209, deployer);
        console.log("QCIRegistry deployed to:", address(registry));
        console.log("Starting QCI number:", registry.nextQCINumber());

        // Optional: grant initial editor roles
        // vm.startBroadcast(deployerPrivateKey);
        // registry.setEditor(0xYourEditorAddress, true);
        // vm.stopBroadcast();

        vm.stopBroadcast();

        // Log deployment info for frontend
        console.log("\n=== Deployment Complete ===");
        console.log("QCI_REGISTRY_ADDRESS=", address(registry));
        console.log("\nAdd this address to your .env file");
    }
}