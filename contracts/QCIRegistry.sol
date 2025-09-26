// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {AccessControl} from "@openzeppelin/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/utils/Pausable.sol";
import "./EditableEnumLib.sol";

/**
 * @title QCIRegistry
 * @notice On-chain registry for Qidao Community Ideas stored on IPFS
 * @dev Manages QCI metadata, versioning, and status transitions
 */
contract QCIRegistry is AccessControl, Pausable {
    using EditableEnumLib for EditableEnumLib.Data;

    error TitleRequired();
    error ChainRequired();
    error InvalidContentHash();
    error IPFSURLRequired();
    error ContentAlreadyExists();
    error QCISlotAlreadyUsed();
    error QCIDoesNotExist();
    error AlreadySubmittedToSnapshot();
    error InvalidStatus();
    error SnapshotAlreadyLinked();
    error InvalidSnapshotID();
    error QCIMustBeReadyForSnapshot();
    error NoSnapshotIDToClear();
    error InvalidAddress();
    error OnlyAuthorOrEditor();
    error MigrationModeDisabled();
    error QCIAlreadyExists();
    error OnlyPlaceholderCanBeCleared();

    bytes32 public constant EDITOR_ROLE = keccak256("EDITOR_ROLE");

    bytes32 internal constant STATUS_DRAFT = keccak256("Draft");
    bytes32 internal constant STATUS_READY_SNAPSHOT = keccak256("Ready for Snapshot");
    bytes32 internal constant STATUS_POSTED_SNAPSHOT = keccak256("Posted to Snapshot");
    struct QCI {
        uint256 qciNumber;
        address author;
        string title;
        string chain;
        bytes32 contentHash;   
        string ipfsUrl;         
        uint256 createdAt;
        uint256 lastUpdated;
        bytes32 status;         
        string implementor;
        uint256 implementationDate;
        string snapshotProposalId;
        uint256 version;        
    }

    struct QCIVersion {
        bytes32 contentHash;
        string ipfsUrl;
        uint256 timestamp;
        string changeNote;
    }

    struct QCIExportData {
        uint256 qciNumber;
        address author;
        string title;
        string chain;
        bytes32 contentHash;
        string ipfsUrl;
        uint256 createdAt;
        uint256 lastUpdated;
        string statusName;  
        string implementor;
        uint256 implementationDate;
        string snapshotProposalId;
        uint256 version;
        QCIVersion[] versions;
        uint256 totalVersions;
    }


    mapping(uint256 => QCI) public qcis;
    mapping(uint256 => mapping(uint256 => QCIVersion)) public qciVersions;
    mapping(uint256 => uint256) public qciVersionCount;
    mapping(bytes32 => uint256) public contentHashToQCI;
    mapping(address => uint256[]) private authorQCIs;

    EditableEnumLib.Data private _statuses;

    uint256 public nextQCINumber;
    bool public migrationMode = true;

    event QCICreated(
        uint256 indexed qciNumber,
        address indexed author,
        string title,
        string network,
        bytes32 contentHash,
        string ipfsUrl
    );

    event QCIUpdated(
        uint256 indexed qciNumber,
        uint256 version,
        bytes32 newContentHash,
        string newIpfsUrl,
        string changeNote
    );

    event QCIStatusChanged(
        uint256 indexed qciNumber,
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
        uint256 indexed qciNumber,
        string snapshotProposalId
    );

    event MigrationWarning(
        uint256 indexed qciNumber,
        string warning
    );

    event DebugUpdateAttempt(
        uint256 indexed qciNumber,
        address caller,
        string stage
    );

    event DebugValidation(
        uint256 indexed qciNumber,
        string check,
        bool passed,
        string reason
    );

    event DebugStorage(
        uint256 indexed qciNumber,
        bytes32 oldHash,
        bytes32 newHash,
        uint256 version
    );

    modifier onlyAuthorOrEditor(uint256 _qciNumber) {
        if (!(qcis[_qciNumber].author == msg.sender ||
            hasRole(EDITOR_ROLE, msg.sender) ||
            hasRole(DEFAULT_ADMIN_ROLE, msg.sender))) {
            revert OnlyAuthorOrEditor();
        }
        _;
    }

    constructor(uint256 _startingQCINumber, address _initialAdmin) {
        nextQCINumber = _startingQCINumber;

        _grantRole(DEFAULT_ADMIN_ROLE, _initialAdmin);
        _grantRole(EDITOR_ROLE, _initialAdmin);

        _initializeStatus("Draft");               
        _initializeStatus("Ready for Snapshot");   
        _initializeStatus("Posted to Snapshot");  
    }

    function _initializeStatus(string memory statusName) private {
        bytes32 statusId = keccak256(bytes(statusName));
        _statuses.add(statusId);
    }

    /**
     * @dev Create a new QCI
     * @param _title QCI title
     * @param _chain Target network (Polygon, Ethereum, Base, etc.)
     * @param _contentHash keccak256 hash of the full proposal content
     * @param _ipfsUrl IPFS URL where content is stored
     */
    function createQCI(
        string memory _title,
        string memory _chain,
        bytes32 _contentHash,
        string memory _ipfsUrl
    ) external whenNotPaused returns (uint256) {
        if (bytes(_title).length == 0) revert TitleRequired();
        if (bytes(_chain).length == 0) revert ChainRequired();
        if (_contentHash == bytes32(0)) revert InvalidContentHash();
        if (bytes(_ipfsUrl).length == 0) revert IPFSURLRequired();
        if (contentHashToQCI[_contentHash] != 0) revert ContentAlreadyExists();


        while (qcis[nextQCINumber].qciNumber != 0) {
            unchecked { nextQCINumber++; }
        }
        uint256 qciNumber = nextQCINumber++;
        if (qcis[qciNumber].qciNumber != 0) revert QCISlotAlreadyUsed();
        
        qcis[qciNumber] = QCI({
            qciNumber: qciNumber,
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
        
        qciVersions[qciNumber][1] = QCIVersion({
            contentHash: _contentHash,
            ipfsUrl: _ipfsUrl,
            timestamp: block.timestamp,
            changeNote: "Initial version"
        });
        qciVersionCount[qciNumber] = 1;
        
        contentHashToQCI[_contentHash] = qciNumber;
        authorQCIs[msg.sender].push(qciNumber);
        
        emit QCICreated(
            qciNumber,
            msg.sender,
            _title,
            _chain,
            _contentHash,
            _ipfsUrl
        );
        
        return qciNumber;
    }

    /**
     * @dev Pause new QCI creation. Editors and admins may still manage existing QCIs.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @dev Unpause new QCI creation.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /**
     * @dev Update QCI content (only allowed before snapshot submission)
     */
    function updateQCI(
        uint256 _qciNumber,
        string memory _title,
        string memory _chain,
        string memory _implementor,
        bytes32 _newContentHash,
        string memory _newIpfsUrl,
        string memory _changeNote
    ) external onlyAuthorOrEditor(_qciNumber) {
        emit DebugUpdateAttempt(_qciNumber, msg.sender, "start");

        QCI storage qci = qcis[_qciNumber];
        if (qci.qciNumber == 0) {
            emit DebugValidation(_qciNumber, "exists", false, "QCI does not exist");
            revert QCIDoesNotExist();
        }

        emit DebugValidation(_qciNumber, "exists", true, "QCI found");

        if (!(qci.status == STATUS_DRAFT || qci.status == STATUS_READY_SNAPSHOT)) {
            emit DebugValidation(_qciNumber, "status", false, "Invalid status for update");
            revert AlreadySubmittedToSnapshot();
        }

        emit DebugValidation(_qciNumber, "status", true, "Status allows update");

        if (bytes(qci.snapshotProposalId).length != 0) {
            emit DebugValidation(_qciNumber, "snapshot", false, "Has snapshot ID");
            revert AlreadySubmittedToSnapshot();
        }

        if (_newContentHash == bytes32(0)) {
            emit DebugValidation(_qciNumber, "contentHash", false, "Empty content hash");
            revert InvalidContentHash();
        }

        if (contentHashToQCI[_newContentHash] != 0) {
            emit DebugValidation(_qciNumber, "uniqueHash", false, "Content hash exists");
            revert ContentAlreadyExists();
        }

        emit DebugUpdateAttempt(_qciNumber, msg.sender, "validation_passed");


        delete contentHashToQCI[qci.contentHash];
        contentHashToQCI[_newContentHash] = _qciNumber;

        qci.title = _title;
        qci.chain = _chain;
        qci.implementor = _implementor;
        qci.contentHash = _newContentHash;
        qci.ipfsUrl = _newIpfsUrl;
        qci.lastUpdated = block.timestamp;
        qci.version++;

        emit DebugStorage(_qciNumber, oldHash, _newContentHash, qci.version);

        qciVersions[_qciNumber][qci.version] = QCIVersion({
            contentHash: _newContentHash,
            ipfsUrl: _newIpfsUrl,
            timestamp: block.timestamp,
            changeNote: _changeNote
        });
        qciVersionCount[_qciNumber] = qci.version;

        emit DebugUpdateAttempt(_qciNumber, msg.sender, "storage_complete");

        emit QCIUpdated(
            _qciNumber,
            qci.version,
            _newContentHash,
            _newIpfsUrl,
            _changeNote
        );
    }

    /**
     * @dev Update QCI status using status string
     */
    function updateStatus(uint256 _qciNumber, string memory _newStatus)
        external
        onlyRole(EDITOR_ROLE)
    {
        QCI storage qci = qcis[_qciNumber];
        if (qci.qciNumber == 0) revert QCIDoesNotExist();

        bytes32 newStatusId = keccak256(bytes(_newStatus));
        if (!_statuses.exists(newStatusId)) revert InvalidStatus();

        bytes32 oldStatus = qci.status;
        qci.status = newStatusId;
        qci.lastUpdated = block.timestamp;

        emit QCIStatusChanged(_qciNumber, oldStatus, newStatusId);
    }

    /**
     * @dev Link Snapshot proposal ID
     */
    function linkSnapshotProposal(
        uint256 _qciNumber, 
        string memory _snapshotProposalId
    ) external onlyAuthorOrEditor(_qciNumber) {
        QCI storage qci = qcis[_qciNumber];
        if (qci.qciNumber == 0) revert QCIDoesNotExist();
        if (bytes(qci.snapshotProposalId).length != 0) revert SnapshotAlreadyLinked();
        if (bytes(_snapshotProposalId).length == 0) revert InvalidSnapshotID();

        if (keccak256(bytes(_snapshotProposalId)) == keccak256(bytes("TBU")) ||
            keccak256(bytes(_snapshotProposalId)) == keccak256(bytes("tbu")) ||
            keccak256(bytes(_snapshotProposalId)) == keccak256(bytes("None"))) {
            revert InvalidSnapshotID();
        }

        if (qci.status != STATUS_READY_SNAPSHOT) revert QCIMustBeReadyForSnapshot();

        qci.snapshotProposalId = _snapshotProposalId;
        qci.status = STATUS_POSTED_SNAPSHOT;
        qci.lastUpdated = block.timestamp;

        emit SnapshotProposalLinked(_qciNumber, _snapshotProposalId);
        emit QCIStatusChanged(_qciNumber, STATUS_READY_SNAPSHOT, STATUS_POSTED_SNAPSHOT);
    }

    /**
     * @dev Clear invalid snapshot ID (admin only)
     * This allows fixing QCIs that have placeholder values like "TBU" stored
     */
    function clearInvalidSnapshotId(uint256 _qciNumber) 
        external 
        onlyRole(DEFAULT_ADMIN_ROLE) 
    {
        QCI storage qci = qcis[_qciNumber];
        require(qci.qciNumber > 0, "QCI does not exist");
        require(bytes(qci.snapshotProposalId).length > 0, "No snapshot ID to clear");
        
        require(
            keccak256(bytes(qci.snapshotProposalId)) == keccak256(bytes("TBU")) ||
            keccak256(bytes(qci.snapshotProposalId)) == keccak256(bytes("tbu")) ||
            keccak256(bytes(qci.snapshotProposalId)) == keccak256(bytes("None")) ||
            keccak256(bytes(qci.snapshotProposalId)) == keccak256(bytes("TBD")),
            "Can only clear placeholder values"
        );
        
        qci.snapshotProposalId = "";
        if (qci.status == STATUS_POSTED_SNAPSHOT) {
            qci.status = STATUS_READY_SNAPSHOT;
            emit QCIStatusChanged(_qciNumber, STATUS_POSTED_SNAPSHOT, STATUS_READY_SNAPSHOT);
        }
        qci.lastUpdated = block.timestamp;
        
        emit SnapshotProposalLinked(_qciNumber, "");
    }

    /**
     * @dev Set implementor and implementation date
     */
    function setImplementation(
        uint256 _qciNumber,
        string memory _implementor,
        uint256 _implementationDate
    ) external onlyRole(EDITOR_ROLE) {
        QCI storage qci = qcis[_qciNumber];
        require(qci.qciNumber > 0, "QCI does not exist");
        
        qci.implementor = _implementor;
        qci.implementationDate = _implementationDate;
        qci.lastUpdated = block.timestamp;
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
     * @dev Disable migration mode (after migrating existing QCIs)
     */
    function disableMigrationMode() external onlyRole(DEFAULT_ADMIN_ROLE) {
        migrationMode = false;
    }

    /**
     * @dev Migrate existing QCI (only during migration mode)
     */
    function migrateQCI(
        uint256 _qciNumber,
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
        require(qcis[_qciNumber].qciNumber == 0, "QCI already exists");

        bytes32 statusId = keccak256(bytes(_status));
        bool hasProposal = bytes(_snapshotProposalId).length > 0;

        if (hasProposal && statusId != STATUS_POSTED_SNAPSHOT) {
            emit MigrationWarning(
                _qciNumber,
                "Status/proposal mismatch - has proposal but not 'Posted to Snapshot' status"
            );
            statusId = STATUS_POSTED_SNAPSHOT;
        }

        if (!_statuses.exists(statusId)) {
            _statuses.add(statusId);
        }

        qcis[_qciNumber] = QCI({
            qciNumber: _qciNumber,
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
        
        qciVersions[_qciNumber][1] = QCIVersion({
            contentHash: _contentHash,
            ipfsUrl: _ipfsUrl,
            timestamp: _createdAt,
            changeNote: "Migrated from GitHub"
        });
        qciVersionCount[_qciNumber] = 1;
        
        contentHashToQCI[_contentHash] = _qciNumber;
        authorQCIs[_author].push(_qciNumber);

        if (_qciNumber >= nextQCINumber) {
            nextQCINumber = _qciNumber + 1;
        }
    }

    /**
     * @dev Synchronize nextQCINumber to the next unused index after migrations
     */
    function syncNextQCINumber() external onlyRole(DEFAULT_ADMIN_ROLE) {
        uint256 candidate = nextQCINumber;
        while (qcis[candidate].qciNumber != 0) {
            unchecked { candidate++; }
        }
        nextQCINumber = candidate;
    }

    /**
     * @dev Get QCIs by author
     */
    function getQCIsByAuthor(address _author) external view returns (uint256[] memory) {
        return authorQCIs[_author];
    }

    /**
     * @dev Get QCI with all versions
     */
    function getQCIWithVersions(uint256 _qciNumber) external view returns (
        QCI memory qci,
        QCIVersion[] memory versions
    ) {
        require(qcis[_qciNumber].qciNumber > 0, "QCI does not exist");
        
        qci = qcis[_qciNumber];
        uint256 versionCount = qciVersionCount[_qciNumber];
        versions = new QCIVersion[](versionCount);
        
        for (uint256 i = 1; i <= versionCount; i++) {
            versions[i - 1] = qciVersions[_qciNumber][i];
        }
    }

    /**
     * @dev Verify content hash matches QCI
     */
    function verifyContent(
        uint256 _qciNumber,
        string memory _content
    ) external view returns (bool) {
        require(qcis[_qciNumber].qciNumber > 0, "QCI does not exist");
        return keccak256(bytes(_content)) == qcis[_qciNumber].contentHash;
    }

    /**
     * @dev Get active QCIs by status string
     */
    function getQCIsByStatus(string memory _status) external view returns (uint256[] memory) {
        bytes32 statusId = keccak256(bytes(_status));
        uint256 count = 0;

        for (uint256 i = 1; i < nextQCINumber; i++) {
            if (qcis[i].qciNumber > 0 && qcis[i].status == statusId) {
                count++;
            }
        }

        uint256[] memory result = new uint256[](count);
        uint256 index = 0;

        for (uint256 i = 1; i < nextQCINumber; i++) {
            if (qcis[i].qciNumber > 0 && qcis[i].status == statusId) {
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

    /**
     * @dev Get human-readable status name from status ID
     */
    function getStatusName(bytes32 _statusId) public pure returns (string memory) {
        if (_statusId == STATUS_DRAFT) return "Draft";
        if (_statusId == STATUS_READY_SNAPSHOT) return "Ready for Snapshot";
        if (_statusId == STATUS_POSTED_SNAPSHOT) return "Posted to Snapshot";

        return "Custom Status";
    }

    /**
     * @dev Export complete QCI data including all versions
     * @param _qciNumber The QCI number to export
     * @return QCIExportData Complete QCI data with version history
     */
    function exportQCI(uint256 _qciNumber) external view returns (QCIExportData memory) {
        if (qcis[_qciNumber].qciNumber == 0) revert QCIDoesNotExist();

        QCI storage qci = qcis[_qciNumber];
        uint256 versionCount = qciVersionCount[_qciNumber];

        QCIVersion[] memory versions = new QCIVersion[](versionCount);
        for (uint256 i = 1; i <= versionCount; i++) {
            versions[i - 1] = qciVersions[_qciNumber][i];
        }

        string memory statusName = getStatusName(qci.status);

        return QCIExportData({
            qciNumber: qci.qciNumber,
            author: qci.author,
            title: qci.title,
            chain: qci.chain,
            contentHash: qci.contentHash,
            ipfsUrl: qci.ipfsUrl,
            createdAt: qci.createdAt,
            lastUpdated: qci.lastUpdated,
            statusName: statusName,
            implementor: qci.implementor,
            implementationDate: qci.implementationDate,
            snapshotProposalId: qci.snapshotProposalId,
            version: qci.version,
            versions: versions,
            totalVersions: versionCount
        });
    }
}