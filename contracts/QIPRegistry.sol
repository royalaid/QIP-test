// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/utils/Pausable.sol";
import "./EditableEnumLib.sol";

/**
 * @title QIPRegistry
 * @notice On-chain registry for QiDAO Improvement Proposals stored on IPFS
 * @dev Manages QIP metadata, versioning, and status transitions
 */
contract QIPRegistry is AccessControl, Pausable {
    using EditableEnumLib for EditableEnumLib.Data;

    bytes32 public constant EDITOR_ROLE = keccak256("EDITOR_ROLE");

    // Pre-hashed identifiers for the three canonical statuses
    bytes32 internal constant STATUS_DRAFT = keccak256("Draft");
    bytes32 internal constant STATUS_READY_SNAPSHOT = keccak256("Ready for Snapshot");
    bytes32 internal constant STATUS_POSTED_SNAPSHOT = keccak256("Posted to Snapshot");
    struct QIP {
        uint256 qipNumber;
        address author;
        string title;
        string chain;
        bytes32 contentHash;    // keccak256 of the full proposal content
        string ipfsUrl;         // IPFS CID in format: ipfs://Qm...
        uint256 createdAt;
        uint256 lastUpdated;
        bytes32 status;         // Status as bytes32 using EditableEnum
        string implementor;
        uint256 implementationDate;
        string snapshotProposalId;
        uint256 version;        // Version number for tracking edits
    }

    struct QIPVersion {
        bytes32 contentHash;
        string ipfsUrl;
        uint256 timestamp;
        string changeNote;
    }

    mapping(uint256 => QIP) public qips;
    mapping(uint256 => mapping(uint256 => QIPVersion)) public qipVersions;
    mapping(uint256 => uint256) public qipVersionCount;
    mapping(bytes32 => uint256) public contentHashToQIP;
    mapping(address => uint256[]) private authorQIPs;

    // Editable status system
    EditableEnumLib.Data private _statuses;

    uint256 public nextQIPNumber;
    // No persistent governance address; rely on roles
    bool public migrationMode = true;

    event QIPCreated(
        uint256 indexed qipNumber,
        address indexed author,
        string title,
        string network,
        bytes32 contentHash,
        string ipfsUrl
    );

    event QIPUpdated(
        uint256 indexed qipNumber,
        uint256 version,
        bytes32 newContentHash,
        string newIpfsUrl,
        string changeNote
    );

    event QIPStatusChanged(
        uint256 indexed qipNumber,
        bytes32 oldStatus,
        bytes32 newStatus
    );

    event StatusAdded(
        bytes32 indexed statusId,
        uint256 index
    );

    event StatusRemoved(
        bytes32 indexed statusId,
        uint256 formerIndex
    );

    event SnapshotProposalLinked(
        uint256 indexed qipNumber,
        string snapshotProposalId
    );

    event MigrationWarning(
        uint256 indexed qipNumber,
        string warning
    );

    modifier onlyAuthorOrEditor(uint256 _qipNumber) {
        require(
            qips[_qipNumber].author == msg.sender ||
            hasRole(EDITOR_ROLE, msg.sender) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender),
            "Only author or editor"
        );
        _;
    }

    constructor(uint256 _startingQIPNumber, address _initialAdmin) {
        nextQIPNumber = _startingQIPNumber;

        _grantRole(DEFAULT_ADMIN_ROLE, _initialAdmin);
        _grantRole(EDITOR_ROLE, _initialAdmin);

        // Initialize the 3 core statuses
        _initializeStatus("Draft");               // 0
        _initializeStatus("Ready for Snapshot");  // 1
        _initializeStatus("Posted to Snapshot");  // 2
    }

    function _initializeStatus(string memory statusName) private {
        bytes32 statusId = keccak256(bytes(statusName));
        _statuses.add(statusId);
    }

    /**
     * @dev Create a new QIP
     * @param _title QIP title
     * @param _chain Target network (Polygon, Ethereum, Base, etc.)
     * @param _contentHash keccak256 hash of the full proposal content
     * @param _ipfsUrl IPFS URL where content is stored
     */
    function createQIP(
        string memory _title,
        string memory _chain,
        bytes32 _contentHash,
        string memory _ipfsUrl
    ) external whenNotPaused returns (uint256) {
        require(bytes(_title).length > 0, "Title required");
        require(bytes(_chain).length > 0, "Chain required");
        require(_contentHash != bytes32(0), "Invalid content hash");
        require(bytes(_ipfsUrl).length > 0, "IPFS URL required");
        require(contentHashToQIP[_contentHash] == 0, "Content already exists");
        
        
        while (qips[nextQIPNumber].qipNumber != 0) {
            unchecked { nextQIPNumber++; }
        }
        uint256 qipNumber = nextQIPNumber++;
        require(qips[qipNumber].qipNumber == 0, "QIP slot already used");
        
        qips[qipNumber] = QIP({
            qipNumber: qipNumber,
            author: msg.sender,
            title: _title,
            chain: _chain,
            contentHash: _contentHash,
            ipfsUrl: _ipfsUrl,
            createdAt: block.timestamp,
            lastUpdated: block.timestamp,
            status: STATUS_DRAFT,
            implementor: "None",
            implementationDate: 0,
            snapshotProposalId: "",
            version: 1
        });
        
        // Store initial version
        qipVersions[qipNumber][1] = QIPVersion({
            contentHash: _contentHash,
            ipfsUrl: _ipfsUrl,
            timestamp: block.timestamp,
            changeNote: "Initial version"
        });
        qipVersionCount[qipNumber] = 1;
        
        contentHashToQIP[_contentHash] = qipNumber;
        authorQIPs[msg.sender].push(qipNumber);
        
        emit QIPCreated(
            qipNumber,
            msg.sender,
            _title,
            _chain,
            _contentHash,
            _ipfsUrl
        );
        
        return qipNumber;
    }

    /**
     * @dev Pause new QIP creation. Editors and admins may still manage existing QIPs.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause new QIP creation.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Update QIP content (only allowed before snapshot submission)
     */
    function updateQIP(
        uint256 _qipNumber,
        string memory _title,
        string memory _chain,
        string memory _implementor,
        bytes32 _newContentHash,
        string memory _newIpfsUrl,
        string memory _changeNote
    ) external onlyAuthorOrEditor(_qipNumber) {
        QIP storage qip = qips[_qipNumber];
        require(qip.qipNumber > 0, "QIP does not exist");
        require(
            qip.status == STATUS_DRAFT || qip.status == STATUS_READY_SNAPSHOT,
            "Cannot update after posting to Snapshot"
        );
        require(bytes(qip.snapshotProposalId).length == 0, "Already submitted to Snapshot");
        require(_newContentHash != bytes32(0), "Invalid content hash");
        require(contentHashToQIP[_newContentHash] == 0, "Content already exists");

        // Update content hash mapping
        delete contentHashToQIP[qip.contentHash];
        contentHashToQIP[_newContentHash] = _qipNumber;

        // Update QIP fields
        qip.title = _title;
        qip.chain = _chain;
        qip.implementor = _implementor;
        qip.contentHash = _newContentHash;
        qip.ipfsUrl = _newIpfsUrl;
        qip.lastUpdated = block.timestamp;
        qip.version++;

        // Store new version
        qipVersions[_qipNumber][qip.version] = QIPVersion({
            contentHash: _newContentHash,
            ipfsUrl: _newIpfsUrl,
            timestamp: block.timestamp,
            changeNote: _changeNote
        });
        qipVersionCount[_qipNumber] = qip.version;

        emit QIPUpdated(
            _qipNumber,
            qip.version,
            _newContentHash,
            _newIpfsUrl,
            _changeNote
        );
    }

    /**
     * @dev Update QIP status using status string
     */
    function updateStatus(uint256 _qipNumber, string memory _newStatus)
        external
        onlyRole(EDITOR_ROLE)
    {
        QIP storage qip = qips[_qipNumber];
        require(qip.qipNumber > 0, "QIP does not exist");

        bytes32 newStatusId = keccak256(bytes(_newStatus));
        require(_statuses.exists(newStatusId), "Invalid status");

        bytes32 oldStatus = qip.status;
        qip.status = newStatusId;
        qip.lastUpdated = block.timestamp;

        emit QIPStatusChanged(_qipNumber, oldStatus, newStatusId);
    }

    /**
     * @dev Link Snapshot proposal ID
     */
    function linkSnapshotProposal(
        uint256 _qipNumber, 
        string memory _snapshotProposalId
    ) external onlyAuthorOrEditor(_qipNumber) {
        QIP storage qip = qips[_qipNumber];
        require(qip.qipNumber > 0, "QIP does not exist");
        require(bytes(qip.snapshotProposalId).length == 0, "Snapshot already linked");
        require(bytes(_snapshotProposalId).length > 0, "Invalid snapshot ID");
        
        // Reject placeholder values
        require(
            keccak256(bytes(_snapshotProposalId)) != keccak256(bytes("TBU")) &&
            keccak256(bytes(_snapshotProposalId)) != keccak256(bytes("tbu")) &&
            keccak256(bytes(_snapshotProposalId)) != keccak256(bytes("None")),
            "Invalid snapshot ID: placeholder value"
        );
        
        // Require status to be "Ready for Snapshot"
        require(qip.status == STATUS_READY_SNAPSHOT, "QIP must be Ready for Snapshot");

        qip.snapshotProposalId = _snapshotProposalId;
        qip.status = STATUS_POSTED_SNAPSHOT;
        qip.lastUpdated = block.timestamp;

        emit SnapshotProposalLinked(_qipNumber, _snapshotProposalId);
        emit QIPStatusChanged(_qipNumber, STATUS_READY_SNAPSHOT, STATUS_POSTED_SNAPSHOT);
    }

    /**
     * @dev Clear invalid snapshot ID (admin only)
     * This allows fixing QIPs that have placeholder values like "TBU" stored
     */
    function clearInvalidSnapshotId(uint256 _qipNumber) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        QIP storage qip = qips[_qipNumber];
        require(qip.qipNumber > 0, "QIP does not exist");
        require(bytes(qip.snapshotProposalId).length > 0, "No snapshot ID to clear");
        
        // Only clear if it's a placeholder value
        require(
            keccak256(bytes(qip.snapshotProposalId)) == keccak256(bytes("TBU")) ||
            keccak256(bytes(qip.snapshotProposalId)) == keccak256(bytes("tbu")) ||
            keccak256(bytes(qip.snapshotProposalId)) == keccak256(bytes("None")) ||
            keccak256(bytes(qip.snapshotProposalId)) == keccak256(bytes("TBD")),
            "Can only clear placeholder values"
        );
        
        // Clear the snapshot ID and reset status to Ready for Snapshot if it was Posted
        qip.snapshotProposalId = "";
        if (qip.status == STATUS_POSTED_SNAPSHOT) {
            qip.status = STATUS_READY_SNAPSHOT;
            emit QIPStatusChanged(_qipNumber, STATUS_POSTED_SNAPSHOT, STATUS_READY_SNAPSHOT);
        }
        qip.lastUpdated = block.timestamp;
        
        emit SnapshotProposalLinked(_qipNumber, "");
    }

    /**
     * @dev Set implementor and implementation date
     */
    function setImplementation(
        uint256 _qipNumber,
        string memory _implementor,
        uint256 _implementationDate
    ) external onlyRole(EDITOR_ROLE) {
        QIP storage qip = qips[_qipNumber];
        require(qip.qipNumber > 0, "QIP does not exist");
        
        qip.implementor = _implementor;
        qip.implementationDate = _implementationDate;
        qip.lastUpdated = block.timestamp;
    }

    /**
     * @dev Add or remove editor
     */
    function setEditor(address _editor, bool _status) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_status) {
            _grantRole(EDITOR_ROLE, _editor);
        } else {
            _revokeRole(EDITOR_ROLE, _editor);
        }
    }

    /**
     * @dev Transfer admin/editor privileges from the caller to a new admin.
     */
    function transferAdmin(address newAdmin) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(newAdmin != address(0), "Invalid address");
        address oldAdmin = msg.sender;
        _grantRole(DEFAULT_ADMIN_ROLE, newAdmin);
        _revokeRole(DEFAULT_ADMIN_ROLE, oldAdmin);
        _grantRole(EDITOR_ROLE, newAdmin);
        _revokeRole(EDITOR_ROLE, oldAdmin);
    }

    /**
     * @dev Disable migration mode (after migrating existing QIPs)
     */
    function disableMigrationMode() external onlyRole(DEFAULT_ADMIN_ROLE) {
        migrationMode = false;
    }

    /**
     * @dev Migrate existing QIP (only during migration mode)
     */
    function migrateQIP(
        uint256 _qipNumber,
        address _author,
        string memory _title,
        string memory _chain,
        bytes32 _contentHash,
        string memory _ipfsUrl,
        uint256 _createdAt,
        string memory _status,
        string memory _implementor,
        uint256 _implementationDate,
        string memory _snapshotProposalId
    ) external onlyRole(EDITOR_ROLE) {
        require(migrationMode, "Migration mode disabled");
        require(qips[_qipNumber].qipNumber == 0, "QIP already exists");

        // Validate status/proposal consistency
        bytes32 statusId = keccak256(bytes(_status));
        bool hasProposal = bytes(_snapshotProposalId).length > 0;

        // If there's a valid snapshot proposal, status should be "Posted to Snapshot"
        if (hasProposal && statusId != STATUS_POSTED_SNAPSHOT) {
            // Log warning but continue - historical data may have inconsistencies
            emit MigrationWarning(
                _qipNumber,
                "Status/proposal mismatch - has proposal but not 'Posted to Snapshot' status"
            );
            // Force status to "Posted to Snapshot" when proposal exists
            statusId = STATUS_POSTED_SNAPSHOT;
        }

        // Ensure the status exists (add if needed during migration)
        if (!_statuses.exists(statusId)) {
            _statuses.add(statusId);
        }

        qips[_qipNumber] = QIP({
            qipNumber: _qipNumber,
            author: _author,
            title: _title,
            chain: _chain,
            contentHash: _contentHash,
            ipfsUrl: _ipfsUrl,
            createdAt: _createdAt,
            lastUpdated: _createdAt,
            status: statusId,
            implementor: _implementor,
            implementationDate: _implementationDate,
            snapshotProposalId: _snapshotProposalId,
            version: 1
        });
        
        // Store initial version
        qipVersions[_qipNumber][1] = QIPVersion({
            contentHash: _contentHash,
            ipfsUrl: _ipfsUrl,
            timestamp: _createdAt,
            changeNote: "Migrated from GitHub"
        });
        qipVersionCount[_qipNumber] = 1;
        
        contentHashToQIP[_contentHash] = _qipNumber;
        authorQIPs[_author].push(_qipNumber);

        // Keep nextQIPNumber pointing to the next unused index
        if (_qipNumber >= nextQIPNumber) {
            nextQIPNumber = _qipNumber + 1;
        }
    }

    /**
     * @dev Synchronize nextQIPNumber to the next unused index after migrations
     */
    function syncNextQIPNumber() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 candidate = nextQIPNumber;
        while (qips[candidate].qipNumber != 0) {
            unchecked { candidate++; }
        }
        nextQIPNumber = candidate;
    }

    /**
     * @dev Get QIPs by author
     */
    function getQIPsByAuthor(address _author) external view returns (uint256[] memory) {
        return authorQIPs[_author];
    }

    /**
     * @dev Get QIP with all versions
     */
    function getQIPWithVersions(uint256 _qipNumber) external view returns (
        QIP memory qip,
        QIPVersion[] memory versions
    ) {
        require(qips[_qipNumber].qipNumber > 0, "QIP does not exist");
        
        qip = qips[_qipNumber];
        uint256 versionCount = qipVersionCount[_qipNumber];
        versions = new QIPVersion[](versionCount);
        
        for (uint256 i = 1; i <= versionCount; i++) {
            versions[i - 1] = qipVersions[_qipNumber][i];
        }
    }

    /**
     * @dev Verify content hash matches QIP
     */
    function verifyContent(
        uint256 _qipNumber,
        string memory _content
    ) external view returns (bool) {
        require(qips[_qipNumber].qipNumber > 0, "QIP does not exist");
        return keccak256(bytes(_content)) == qips[_qipNumber].contentHash;
    }

    /**
     * @dev Get active QIPs by status string
     */
    function getQIPsByStatus(string memory _status) external view returns (uint256[] memory) {
        bytes32 statusId = keccak256(bytes(_status));
        uint256 count = 0;

        // First count matching QIPs
        for (uint256 i = 1; i < nextQIPNumber; i++) {
            if (qips[i].qipNumber > 0 && qips[i].status == statusId) {
                count++;
            }
        }

        // Then populate array
        uint256[] memory result = new uint256[](count);
        uint256 index = 0;

        for (uint256 i = 1; i < nextQIPNumber; i++) {
            if (qips[i].qipNumber > 0 && qips[i].status == statusId) {
                result[index++] = i;
            }
        }

        return result;
    }

    /**
     * @dev Add a new status (editor only)
     */
    function addStatus(string memory _statusName)
        external
        onlyRole(EDITOR_ROLE)
        returns (uint256)
    {
        bytes32 statusId = keccak256(bytes(_statusName));
        uint256 idx = _statuses.add(statusId);
        emit StatusAdded(statusId, idx);
        return idx;
    }

    /**
     * @dev Remove a status (editor only)
     */
    function removeStatus(string memory _statusName) external onlyRole(EDITOR_ROLE) {
        bytes32 statusId = keccak256(bytes(_statusName));
        uint256 idx = _statuses.remove(statusId);
        emit StatusRemoved(statusId, idx);
    }

    /**
     * @dev Get count of statuses
     */
    function statusCount() external view returns (uint256) {
        return _statuses.length();
    }

    /**
     * @dev Get status at index
     */
    function statusAt(uint256 index) external view returns (bytes32) {
        return _statuses.at(index);
    }

    /**
     * @dev Check if status exists
     */
    function statusExists(string memory _statusName)
        external
        view
        returns (bool)
    {
        return _statuses.exists(keccak256(bytes(_statusName)));
    }

    /**
     * @dev Get status index
     */
    function statusIndexOf(string memory _statusName)
        external
        view
        returns (uint256)
    {
        return _statuses.indexOf(keccak256(bytes(_statusName)));
    }

    // Migration reporting functions removed to reduce contract size
    // These can be implemented off-chain or in a separate contract if needed
}