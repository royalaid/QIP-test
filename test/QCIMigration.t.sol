// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../contracts/QCIRegistry.sol";

contract QCIMigrationTest is Test {
    QCIRegistry public registry;

    address public admin = makeAddr("admin");
    address public editor = makeAddr("editor");
    address public author = makeAddr("author");

    // Events to monitor
    event MigrationWarning(uint256 indexed qciNumber, string warning);
    event QCIStatusChanged(uint256 indexed qciNumber, bytes32 oldStatus, bytes32 newStatus);

    function setUp() public {
        // Deploy registry with migration mode enabled
        registry = new QCIRegistry(209, admin);

        // Grant editor role for migrations
        vm.prank(admin);
        registry.setEditor(editor, true);
    }

    function test_MigrateQCIWithProposalForcesStatus() public {
        vm.startPrank(editor);

        // Try to migrate a QCI with "Draft" status but has a proposal URL
        string memory proposalUrl = "https://snapshot.org/#/qidao.eth/proposal/0x123";

        // Expect warning event since status doesn't match proposal existence
        vm.expectEmit(true, false, false, true);
        emit MigrationWarning(
            210,
            "Status/proposal mismatch - has proposal but not 'Posted to Snapshot' status"
        );

        registry.migrateQCI(
            210,
            author,
            "Test QCI with Proposal",
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
        (,,,,,,,, bytes32 status,,,,) = registry.qcis(210);
        assertEq(status, keccak256(bytes("Posted to Snapshot")));
    }

    function test_MigrateQCIWithoutProposalKeepsStatus() public {
        vm.startPrank(editor);

        // Migrate a QCI with "Draft" status and no proposal
        registry.migrateQCI(
            211,
            author,
            "Test QCI Draft",
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
        (,,,,,,,, bytes32 status,,,,) = registry.qcis(211);
        assertEq(status, keccak256(bytes("Draft")));
    }

    function test_MigrateQCIWithProposalCorrectStatus() public {
        vm.startPrank(editor);

        // Migrate a QCI with correct "Posted to Snapshot" status and proposal
        string memory proposalUrl = "https://snapshot.org/#/qidao.eth/proposal/0x456";

        // Should not emit warning since status matches
        vm.recordLogs();

        registry.migrateQCI(
            212,
            author,
            "Test QCI Correct",
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
        (,,,,,,,, bytes32 status,,, string memory storedProposal,) = registry.qcis(212);
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
        registry.migrateQCI(
            240, author, "Failed QCI", "Polygon",
            keccak256("fail"), "ipfs://fail", block.timestamp,
            "Draft", "None", 0, ""
        );
    }

    // Migration reporting functions tests removed since the functions were removed
    // from the contract to reduce size below the 24KB limit
}