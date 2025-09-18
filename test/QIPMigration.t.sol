// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../contracts/QIPRegistry.sol";

contract QIPMigrationTest is Test {
    QIPRegistry public registry;

    address public admin = makeAddr("admin");
    address public editor = makeAddr("editor");
    address public author = makeAddr("author");

    // Events to monitor
    event MigrationWarning(uint256 indexed qipNumber, string warning);
    event QIPStatusChanged(uint256 indexed qipNumber, bytes32 oldStatus, bytes32 newStatus);

    function setUp() public {
        // Deploy registry with migration mode enabled
        registry = new QIPRegistry(209, admin);

        // Grant editor role for migrations
        vm.prank(admin);
        registry.setEditor(editor, true);
    }

    function test_MigrateQIPWithProposalForcesStatus() public {
        vm.startPrank(editor);

        // Try to migrate a QIP with "Draft" status but has a proposal URL
        string memory proposalUrl = "https://snapshot.org/#/qidao.eth/proposal/0x123";

        // Expect warning event since status doesn't match proposal existence
        vm.expectEmit(true, false, false, true);
        emit MigrationWarning(
            210,
            "Status/proposal mismatch - has proposal but not 'Posted to Snapshot' status"
        );

        registry.migrateQIP(
            210,
            author,
            "Test QIP with Proposal",
            "Polygon",
            keccak256("content"),
            "ipfs://test",
            block.timestamp > 30 days ? block.timestamp - 30 days : 1,
            "Draft", // Wrong status - should be "Posted to Snapshot"
            "None",
            0,
            proposalUrl
        );

        // Verify status was forced to "Posted to Snapshot"
        (,,,,,,,, bytes32 status,,,,) = registry.qips(210);
        assertEq(status, keccak256(bytes("Posted to Snapshot")));
    }

    function test_MigrateQIPWithoutProposalKeepsStatus() public {
        vm.startPrank(editor);

        // Migrate a QIP with "Draft" status and no proposal
        registry.migrateQIP(
            211,
            author,
            "Test QIP Draft",
            "Ethereum",
            keccak256("draft content"),
            "ipfs://draft",
            block.timestamp > 20 days ? block.timestamp - 20 days : 1,
            "Draft",
            "None",
            0,
            "" // No proposal
        );

        // Verify status remains "Draft"
        (,,,,,,,, bytes32 status,,,,) = registry.qips(211);
        assertEq(status, keccak256(bytes("Draft")));
    }

    function test_MigrateQIPWithProposalCorrectStatus() public {
        vm.startPrank(editor);

        // Migrate a QIP with correct "Posted to Snapshot" status and proposal
        string memory proposalUrl = "https://snapshot.org/#/qidao.eth/proposal/0x456";

        // Should not emit warning since status matches
        vm.recordLogs();

        registry.migrateQIP(
            212,
            author,
            "Test QIP Correct",
            "Base",
            keccak256("correct content"),
            "ipfs://correct",
            block.timestamp > 10 days ? block.timestamp - 10 days : 1,
            "Posted to Snapshot", // Correct status
            "Dev Team",
            block.timestamp > 5 days ? block.timestamp - 5 days : 1,
            proposalUrl
        );

        // Check no warning was emitted
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i = 0; i < logs.length; i++) {
            // MigrationWarning event signature
            if (logs[i].topics[0] == keccak256("MigrationWarning(uint256,string)")) {
                fail("Should not emit MigrationWarning for correct status/proposal pair");
            }
        }

        // Verify status is correctly set
        (,,,,,,,, bytes32 status,,, string memory storedProposal,) = registry.qips(212);
        assertEq(status, keccak256(bytes("Posted to Snapshot")));
        assertEq(storedProposal, proposalUrl);
    }

    function test_DisableMigrationMode() public {
        vm.startPrank(admin);

        // Disable migration mode
        registry.disableMigrationMode();
        assertFalse(registry.migrationMode());

        // Try to migrate after disabling - should fail
        vm.startPrank(editor);
        vm.expectRevert("Migration mode disabled");
        registry.migrateQIP(
            240, author, "Failed QIP", "Polygon",
            keccak256("fail"), "ipfs://fail", block.timestamp,
            "Draft", "None", 0, ""
        );
    }

    // Migration reporting functions tests removed since the functions were removed
    // from the contract to reduce size below the 24KB limit
}