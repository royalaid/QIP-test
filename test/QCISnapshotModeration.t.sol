// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../contracts/QCIRegistry.sol";

contract QCISnapshotModerationTest is Test {
    QCIRegistry public registry;
    address public admin = address(0x1);
    address public editor = address(0x2);
    address public author = address(0x3);
    address public user = address(0x4);

    function setUp() public {
        registry = new QCIRegistry(1, admin);

        vm.prank(admin);
        registry.setEditor(editor, true);
    }

    function testAuthorCanLinkSnapshotOnce() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(editor);
        registry.updateStatus(qciNumber, "Ready for Snapshot");

        vm.prank(author);
        registry.linkSnapshotProposal(qciNumber, "0xproposal123");

        (,,,,,,,,,,,string memory snapshotId,) = registry.qcis(qciNumber);
        assertEq(snapshotId, "0xproposal123");

        vm.prank(author);
        vm.expectRevert(QCIRegistry.SnapshotAlreadyLinked.selector);
        registry.linkSnapshotProposal(qciNumber, "0xproposal456");
    }

    function testEditorCanUpdateSnapshotForModeration() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(editor);
        registry.updateStatus(qciNumber, "Ready for Snapshot");

        vm.prank(author);
        registry.linkSnapshotProposal(qciNumber, "0xproposal123");

        vm.prank(editor);
        vm.expectEmit(true, true, false, true);
        emit QCIRegistry.SnapshotProposalUpdated(
            qciNumber,
            "0xproposal123",
            "0xproposal456",
            editor,
            "Incorrect proposal linked - updating to correct one"
        );

        registry.updateSnapshotProposal(
            qciNumber,
            "0xproposal456",
            "Incorrect proposal linked - updating to correct one"
        );

        (,,,,,,,,,,,string memory snapshotId,) = registry.qcis(qciNumber);
        assertEq(snapshotId, "0xproposal456");
    }

    function testOnlyEditorCanUpdateSnapshot() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(editor);
        registry.updateStatus(qciNumber, "Ready for Snapshot");

        vm.prank(author);
        registry.linkSnapshotProposal(qciNumber, "0xproposal123");

        vm.prank(user);
        vm.expectRevert();
        registry.updateSnapshotProposal(
            qciNumber,
            "0xproposal456",
            "Trying to update"
        );

        vm.prank(author);
        vm.expectRevert();
        registry.updateSnapshotProposal(
            qciNumber,
            "0xproposal456",
            "Trying to update"
        );
    }

    function testCannotUpdateToInvalidProposalIds() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(editor);
        registry.updateStatus(qciNumber, "Ready for Snapshot");

        vm.prank(author);
        registry.linkSnapshotProposal(qciNumber, "0xproposal123");

        vm.startPrank(editor);
        vm.expectRevert(QCIRegistry.InvalidSnapshotID.selector);
        registry.updateSnapshotProposal(qciNumber, "", "Test");

        vm.expectRevert(QCIRegistry.InvalidSnapshotID.selector);
        registry.updateSnapshotProposal(qciNumber, "TBU", "Test");

        vm.expectRevert(QCIRegistry.InvalidSnapshotID.selector);
        registry.updateSnapshotProposal(qciNumber, "None", "Test");

        vm.expectRevert(QCIRegistry.InvalidSnapshotID.selector);
        registry.updateSnapshotProposal(qciNumber, "TBD", "Test");

        vm.stopPrank();
    }

    function testUpdateSetsStatusToPostedToSnapshot() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(editor);
        registry.updateStatus(qciNumber, "Draft");

        vm.prank(editor);
        registry.updateSnapshotProposal(
            qciNumber,
            "0xproposal123",
            "Directly linking proposal"
        );

        (,,,,,,,,bytes32 status,,,,) = registry.qcis(qciNumber);
        assertEq(status, keccak256("Posted to Snapshot"));
    }

    function testEditorCanUpdateMultipleTimes() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(editor);
        registry.updateStatus(qciNumber, "Ready for Snapshot");

        vm.prank(author);
        registry.linkSnapshotProposal(qciNumber, "0xproposal123");

        vm.prank(editor);
        registry.updateSnapshotProposal(
            qciNumber,
            "0xproposal456",
            "First update for moderation"
        );

        vm.prank(editor);
        registry.updateSnapshotProposal(
            qciNumber,
            "0xproposal789",
            "Second update for moderation"
        );

        (,,,,,,,,,,,string memory snapshotId,) = registry.qcis(qciNumber);
        assertEq(snapshotId, "0xproposal789");
    }
}