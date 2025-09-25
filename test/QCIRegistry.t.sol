// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import {IAccessControl} from "@openzeppelin/access/IAccessControl.sol";
import "../contracts/QCIRegistry.sol";

contract QCIRegistryTest is Test {
    QCIRegistry public registry;
    
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");
    
    event QCICreated(
        uint256 indexed qciNumber,
        address indexed author,
        string title,
        string network,
        bytes32 contentHash,
        string ipfsUrl
    );
    
    function setUp() public {
        // Start QCI numbers at 209 and set this test contract as governance
        registry = new QCIRegistry(209, address(this));
    }
    
    function test_CreateQCI() public {
        vm.startPrank(alice);
        
        string memory title = "Improve QiDAO Collateral Framework";
        string memory network = "Polygon";
        bytes32 contentHash = keccak256("Full proposal content here...");
        string memory ipfsUrl = "ipfs://QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
        
        vm.expectEmit(true, true, false, true);
        emit QCICreated(209, alice, title, network, contentHash, ipfsUrl);
        
        uint256 qciNumber = registry.createQCI(title, network, contentHash, ipfsUrl);
        assertEq(qciNumber, 209);
        
        // Verify QCI details
        (
            uint256 returnedNumber,
            address author,
            string memory returnedTitle,
            string memory returnedNetwork,
            bytes32 returnedHash,
            string memory returnedUrl,,,
            bytes32 status,,,,
            uint256 version
        ) = registry.qcis(qciNumber);
        
        assertEq(returnedNumber, 209);
        assertEq(author, alice);
        assertEq(returnedTitle, title);
        assertEq(returnedNetwork, network);
        assertEq(returnedHash, contentHash);
        assertEq(returnedUrl, ipfsUrl);
        assertEq(status, keccak256(bytes("Draft")));
        assertEq(version, 1);
        
        vm.stopPrank();
    }
    
    function test_UpdateQCI() public {
        vm.startPrank(alice);
        
        // Create QCI
        uint256 qciNumber = registry.createQCI(
            "Original Title",
            "Polygon",
            keccak256("Original content"),
            "ipfs://original"
        );
        
        // Update QCI
        string memory newTitle = "Updated Title";
        bytes32 newHash = keccak256("Updated content");
        string memory newUrl = "ipfs://updated";
        
        registry.updateQCI(qciNumber, newTitle, "Polygon", "None", newHash, newUrl, "Fixed typos");
        
        // Verify update
        (,, string memory title,,bytes32 hash, string memory url,,,,,,,uint256 version) = registry.qcis(qciNumber);
        assertEq(title, newTitle);
        assertEq(hash, newHash);
        assertEq(url, newUrl);
        assertEq(version, 2);
        
        vm.stopPrank();
    }
    
    function test_RoleBasedAccess() public {
        // Grant editor role to Bob (only governance can call)
        registry.setEditor(bob, true);

        // Alice creates a QCI
        vm.startPrank(alice);
        uint256 qciNumber = registry.createQCI(
            "Test Proposal",
            "Base",
            keccak256("content"),
            "ipfs://test"
        );
        vm.stopPrank();

        // Bob (editor) can update status
        vm.startPrank(bob);
        registry.updateStatus(qciNumber, "Ready for Snapshot");
        vm.stopPrank();

        // Charlie (non-editor) cannot update status
        vm.startPrank(charlie);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                charlie,
                registry.EDITOR_ROLE()
            )
        );
        registry.updateStatus(qciNumber, "Posted to Snapshot");
        vm.stopPrank();
    }
    
    function test_MigrateExistingQCI() public {
        // Grant editor role
        registry.setEditor(alice, true);
        
        // Migrate an existing QCI
        vm.startPrank(alice);
        
        uint256 existingQipNumber = 123;
        registry.migrateQCI(
            existingQipNumber,
            bob, // original author
            "Historical QCI Title",
            "Ethereum",
            keccak256("historical content"),
            "ipfs://historical",
            1640995200, // Jan 1, 2022
            "Posted to Snapshot", // Use one of the 3 main statuses
            "Dev Team",
            1641600000, // Jan 8, 2022
            "snapshot-proposal-id"
        );

        // Verify migration
        (
            uint256 num,
            address author,
            , , , , , ,
            bytes32 status,
            , , ,
        ) = registry.qcis(existingQipNumber);
        assertEq(num, existingQipNumber);
        assertEq(author, bob);
        assertEq(status, keccak256(bytes("Posted to Snapshot")));
        
        vm.stopPrank();
    }
    
    function test_SnapshotIntegration() public {
        vm.startPrank(alice);
        
        uint256 qciNumber = registry.createQCI(
            "Snapshot Test",
            "Polygon",
            keccak256("content"),
            "ipfs://test"
        );
        
        // First update to Ready for Snapshot status
        vm.stopPrank();
        registry.setEditor(alice, true);
        vm.startPrank(alice);
        registry.updateStatus(qciNumber, "Ready for Snapshot");

        // Now link snapshot proposal
        string memory snapshotId = "0x1234567890abcdef";
        registry.linkSnapshotProposal(qciNumber, snapshotId);
        
        // Verify status changed and snapshot linked
        (,,,,,,,, bytes32 status,,, string memory linkedId,) = registry.qcis(qciNumber);
        assertEq(status, keccak256(bytes("Posted to Snapshot")));
        assertEq(linkedId, snapshotId);
        
        // Cannot update after snapshot submission
        vm.expectRevert("Cannot update after posting to Snapshot");
        registry.updateQCI(qciNumber, "New Title", "Polygon", "None", keccak256("new"), "ipfs://new", "Should fail");
        
        vm.stopPrank();
    }
    
    function test_ReviewWorkflow() public {
        // Setup editor
        registry.setEditor(bob, true);

        // Create and submit for review
        vm.startPrank(alice);
        uint256 qciNumber = registry.createQCI(
            "Review Test",
            "Base",
            keccak256("content"),
            "ipfs://test"
        );
        
        // Stop Alice prank before switching actors
        vm.stopPrank();
        // Editor moves status to ReviewPending
        vm.prank(bob);
        registry.updateStatus(qciNumber, "Ready for Snapshot");
        
        // Editor moves status to VotePending
        vm.prank(bob);
        registry.updateStatus(qciNumber, "Posted to Snapshot");
        
        // Status should now be VotePending
        (
            , , , , , , , ,
            bytes32 status,
            , , ,
        ) = registry.qcis(qciNumber);
        assertEq(status, keccak256(bytes("Posted to Snapshot")));
    }

    function test_PausePreventsCreation() public {
        // Pause by admin (DEFAULT_ADMIN_ROLE granted to this test via constructor argument)
        registry.pause();

        // Creating a QCI should revert while paused
        vm.prank(alice);
        // OZ Pausable uses custom error EnforcedPause(); expect revert on create
        vm.expectRevert();
        registry.createQCI(
            "Paused Test",
            "Base",
            keccak256("content"),
            "ipfs://paused"
        );

        // Unpause and try again
        registry.unpause();
        vm.prank(alice);
        uint256 qciNumber = registry.createQCI(
            "Unpaused Test",
            "Base",
            keccak256("content"),
            "ipfs://ok"
        );
        assertEq(qciNumber, 209);
    }
}