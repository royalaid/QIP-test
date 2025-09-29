// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import "forge-std/Script.sol";
import {QCIRegistry} from "../contracts/QCIRegistry.sol";

/**
 * @title Deploy Local QCI Registry
 * @notice Simple deployment for local development
 */
contract DeployLocal is Script {
    function run() public returns (address) {
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

        // Get additional editor address from environment variable (if set)
        address additionalEditor = vm.envOr("ADDITIONAL_EDITOR", address(0));

        vm.startBroadcast(deployerPrivateKey);

        // The deployer address from the private key
        address deployer = vm.addr(deployerPrivateKey);

        // Deploy QCIRegistry with deployer as initial admin
        QCIRegistry registry = new QCIRegistry(209, deployer);

        console.log("QCIRegistry deployed at:", address(registry));
        console.log("Admin set to:", deployer);

        // Grant editor role to additional address if provided
        if (additionalEditor != address(0)) {
            bytes32 EDITOR_ROLE = keccak256("EDITOR_ROLE");
            registry.grantRole(EDITOR_ROLE, additionalEditor);
            console.log("Editor role granted to:", additionalEditor);
        }

        vm.stopBroadcast();

        return address(registry);
    }
}