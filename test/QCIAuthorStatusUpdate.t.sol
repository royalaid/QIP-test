// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Test.sol";
import "../contracts/QCIRegistry.sol";

contract QCIAuthorStatusUpdateTest is Test {
    QCIRegistry public registry;
    address public admin = address(0x1);
    address public editor = address(0x2);
    address public author = address(0x3);
    address public otherAuthor = address(0x4);
    address public user = address(0x5);

    function setUp() public {
        registry = new QCIRegistry(1, admin);

        vm.prank(admin);
        registry.setEditor(editor, true);
    }

    function testAuthorCanUpdateOwnQCIStatus() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(author);
        registry.updateStatus(qciNumber, "Ready for Snapshot");

        (,,,,,,,,bytes32 status,,,,) = registry.qcis(qciNumber);
        assertEq(status, keccak256("Ready for Snapshot"));

        vm.prank(author);
        registry.updateStatus(qciNumber, "Draft");

        (,,,,,,,,bytes32 newStatus,,,,) = registry.qcis(qciNumber);
        assertEq(newStatus, keccak256("Draft"));
    }

    function testAuthorCannotSetStatusToPostedToSnapshot() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(author);
        vm.expectRevert(QCIRegistry.InvalidStatus.selector);
        registry.updateStatus(qciNumber, "Posted to Snapshot");

        (,,,,,,,,bytes32 status,,,,) = registry.qcis(qciNumber);
        assertEq(status, keccak256("Draft"));
    }

    function testAuthorCannotUpdateOtherAuthorsQCI() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(otherAuthor);
        vm.expectRevert(QCIRegistry.OnlyAuthorOrEditor.selector);
        registry.updateStatus(qciNumber, "Ready for Snapshot");

        vm.prank(user);
        vm.expectRevert(QCIRegistry.OnlyAuthorOrEditor.selector);
        registry.updateStatus(qciNumber, "Ready for Snapshot");
    }

    function testEditorCanUpdateAnyQCIToAnyStatus() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(editor);
        registry.updateStatus(qciNumber, "Ready for Snapshot");

        (,,,,,,,,bytes32 status1,,,,) = registry.qcis(qciNumber);
        assertEq(status1, keccak256("Ready for Snapshot"));

        vm.prank(editor);
        registry.updateStatus(qciNumber, "Posted to Snapshot");

        (,,,,,,,,bytes32 status2,,,,) = registry.qcis(qciNumber);
        assertEq(status2, keccak256("Posted to Snapshot"));

        vm.prank(editor);
        registry.addStatus("Approved");

        vm.prank(editor);
        registry.updateStatus(qciNumber, "Approved");

        (,,,,,,,,bytes32 status3,,,,) = registry.qcis(qciNumber);
        assertEq(status3, keccak256("Approved"));
    }

    function testAuthorCanUpdateAfterPostedToSnapshot() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(editor);
        registry.updateStatus(qciNumber, "Posted to Snapshot");

        vm.prank(editor);
        registry.addStatus("Approved");
        vm.prank(editor);
        registry.addStatus("Rejected");

        vm.prank(author);
        registry.updateStatus(qciNumber, "Approved");

        (,,,,,,,,bytes32 status1,,,,) = registry.qcis(qciNumber);
        assertEq(status1, keccak256("Approved"));

        vm.prank(author);
        registry.updateStatus(qciNumber, "Rejected");

        (,,,,,,,,bytes32 status2,,,,) = registry.qcis(qciNumber);
        assertEq(status2, keccak256("Rejected"));

        vm.prank(author);
        vm.expectRevert(QCIRegistry.InvalidStatus.selector);
        registry.updateStatus(qciNumber, "Posted to Snapshot");
    }

    function testAdminHasFullStatusUpdatePermissions() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(admin);
        registry.updateStatus(qciNumber, "Posted to Snapshot");

        (,,,,,,,,bytes32 status,,,,) = registry.qcis(qciNumber);
        assertEq(status, keccak256("Posted to Snapshot"));
    }

    function testStatusUpdateEmitsCorrectEvent() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(author);
        vm.expectEmit(true, true, false, true);
        emit QCIRegistry.QCIStatusChanged(
            qciNumber,
            keccak256("Draft"),
            keccak256("Ready for Snapshot")
        );
        registry.updateStatus(qciNumber, "Ready for Snapshot");
    }

    function testAuthorCanArchiveOwnQCI() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(author);
        registry.updateStatus(qciNumber, "Archived");

        (,,,,,,,,bytes32 status,,,,) = registry.qcis(qciNumber);
        assertEq(status, keccak256("Archived"));
    }

    function testAuthorCannotUnarchiveQCI() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(author);
        registry.updateStatus(qciNumber, "Archived");

        vm.prank(author);
        vm.expectRevert(QCIRegistry.OnlyEditorCanUnarchive.selector);
        registry.updateStatus(qciNumber, "Draft");

        vm.prank(author);
        vm.expectRevert(QCIRegistry.OnlyEditorCanUnarchive.selector);
        registry.updateStatus(qciNumber, "Ready for Snapshot");

        (,,,,,,,,bytes32 status,,,,) = registry.qcis(qciNumber);
        assertEq(status, keccak256("Archived"));
    }

    function testEditorCanUnarchiveQCI() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(author);
        registry.updateStatus(qciNumber, "Archived");

        vm.prank(editor);
        registry.updateStatus(qciNumber, "Draft");

        (,,,,,,,,bytes32 status,,,,) = registry.qcis(qciNumber);
        assertEq(status, keccak256("Draft"));

        vm.prank(editor);
        registry.updateStatus(qciNumber, "Archived");

        vm.prank(editor);
        registry.updateStatus(qciNumber, "Ready for Snapshot");

        (,,,,,,,,bytes32 status2,,,,) = registry.qcis(qciNumber);
        assertEq(status2, keccak256("Ready for Snapshot"));
    }

    function testAdminCanUnarchiveQCI() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(author);
        registry.updateStatus(qciNumber, "Archived");

        vm.prank(admin);
        registry.updateStatus(qciNumber, "Draft");

        (,,,,,,,,bytes32 status,,,,) = registry.qcis(qciNumber);
        assertEq(status, keccak256("Draft"));
    }

    function testArchiveStatusTransitions() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(author);
        registry.updateStatus(qciNumber, "Archived");
        (,,,,,,,,bytes32 status1,,,,) = registry.qcis(qciNumber);
        assertEq(status1, keccak256("Archived"));

        vm.prank(editor);
        registry.updateStatus(qciNumber, "Ready for Snapshot");

        vm.prank(author);
        registry.updateStatus(qciNumber, "Archived");
        (,,,,,,,,bytes32 status2,,,,) = registry.qcis(qciNumber);
        assertEq(status2, keccak256("Archived"));

        vm.prank(editor);
        registry.updateStatus(qciNumber, "Posted to Snapshot");

        vm.prank(author);
        registry.updateStatus(qciNumber, "Archived");
        (,,,,,,,,bytes32 status3,,,,) = registry.qcis(qciNumber);
        assertEq(status3, keccak256("Archived"));
    }

    function testNonAuthorCannotArchive() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(otherAuthor);
        vm.expectRevert(QCIRegistry.OnlyAuthorOrEditor.selector);
        registry.updateStatus(qciNumber, "Archived");

        vm.prank(user);
        vm.expectRevert(QCIRegistry.OnlyAuthorOrEditor.selector);
        registry.updateStatus(qciNumber, "Archived");

        (,,,,,,,,bytes32 status,,,,) = registry.qcis(qciNumber);
        assertEq(status, keccak256("Draft"));
    }

    function testArchiveStatusEmitsCorrectEvent() public {
        vm.prank(author);
        uint256 qciNumber = registry.createQCI(
            "Test QCI",
            "Ethereum",
            keccak256("test content"),
            "ipfs://QmTest"
        );

        vm.prank(author);
        vm.expectEmit(true, true, false, true);
        emit QCIRegistry.QCIStatusChanged(
            qciNumber,
            keccak256("Draft"),
            keccak256("Archived")
        );
        registry.updateStatus(qciNumber, "Archived");

        vm.prank(editor);
        vm.expectEmit(true, true, false, true);
        emit QCIRegistry.QCIStatusChanged(
            qciNumber,
            keccak256("Archived"),
            keccak256("Draft")
        );
        registry.updateStatus(qciNumber, "Draft");
    }
}