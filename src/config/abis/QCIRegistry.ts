export const QCIRegistryABI = [
  {
    type: "constructor",
    inputs: [
      {
        name: "_startingQCINumber",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "_initialAdmin",
        type: "address",
        internalType: "address",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "DEFAULT_ADMIN_ROLE",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "EDITOR_ROLE",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "addStatus",
    inputs: [
      {
        name: "_statusName",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "clearInvalidSnapshotId",
    inputs: [
      {
        name: "_qciNumber",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "contentHashToQCI",
    inputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "createQCI",
    inputs: [
      {
        name: "_title",
        type: "string",
        internalType: "string",
      },
      {
        name: "_chain",
        type: "string",
        internalType: "string",
      },
      {
        name: "_contentHash",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "_ipfsUrl",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "disableMigrationMode",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "exportQCI",
    inputs: [
      {
        name: "_qciNumber",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct QCIRegistry.QCIExportData",
        components: [
          {
            name: "qciNumber",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "author",
            type: "address",
            internalType: "address",
          },
          {
            name: "title",
            type: "string",
            internalType: "string",
          },
          {
            name: "chain",
            type: "string",
            internalType: "string",
          },
          {
            name: "contentHash",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "ipfsUrl",
            type: "string",
            internalType: "string",
          },
          {
            name: "createdAt",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "lastUpdated",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "statusName",
            type: "string",
            internalType: "string",
          },
          {
            name: "implementor",
            type: "string",
            internalType: "string",
          },
          {
            name: "implementationDate",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "snapshotProposalId",
            type: "string",
            internalType: "string",
          },
          {
            name: "version",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "versions",
            type: "tuple[]",
            internalType: "struct QCIRegistry.QCIVersion[]",
            components: [
              {
                name: "contentHash",
                type: "bytes32",
                internalType: "bytes32",
              },
              {
                name: "ipfsUrl",
                type: "string",
                internalType: "string",
              },
              {
                name: "timestamp",
                type: "uint256",
                internalType: "uint256",
              },
              {
                name: "changeNote",
                type: "string",
                internalType: "string",
              },
            ],
          },
          {
            name: "totalVersions",
            type: "uint256",
            internalType: "uint256",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getQCIWithVersions",
    inputs: [
      {
        name: "_qciNumber",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "qci",
        type: "tuple",
        internalType: "struct QCIRegistry.QCI",
        components: [
          {
            name: "qciNumber",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "author",
            type: "address",
            internalType: "address",
          },
          {
            name: "title",
            type: "string",
            internalType: "string",
          },
          {
            name: "chain",
            type: "string",
            internalType: "string",
          },
          {
            name: "contentHash",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "ipfsUrl",
            type: "string",
            internalType: "string",
          },
          {
            name: "createdAt",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "lastUpdated",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "status",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "implementor",
            type: "string",
            internalType: "string",
          },
          {
            name: "implementationDate",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "snapshotProposalId",
            type: "string",
            internalType: "string",
          },
          {
            name: "version",
            type: "uint256",
            internalType: "uint256",
          },
        ],
      },
      {
        name: "versions",
        type: "tuple[]",
        internalType: "struct QCIRegistry.QCIVersion[]",
        components: [
          {
            name: "contentHash",
            type: "bytes32",
            internalType: "bytes32",
          },
          {
            name: "ipfsUrl",
            type: "string",
            internalType: "string",
          },
          {
            name: "timestamp",
            type: "uint256",
            internalType: "uint256",
          },
          {
            name: "changeNote",
            type: "string",
            internalType: "string",
          },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getQCIsByAuthor",
    inputs: [
      {
        name: "_author",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256[]",
        internalType: "uint256[]",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getQCIsByStatus",
    inputs: [
      {
        name: "_status",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256[]",
        internalType: "uint256[]",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getRoleAdmin",
    inputs: [
      {
        name: "role",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getStatusName",
    inputs: [
      {
        name: "_statusId",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    outputs: [
      {
        name: "",
        type: "string",
        internalType: "string",
      },
    ],
    stateMutability: "pure",
  },
  {
    type: "function",
    name: "grantRole",
    inputs: [
      {
        name: "role",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "account",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "hasRole",
    inputs: [
      {
        name: "role",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "account",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "linkSnapshotProposal",
    inputs: [
      {
        name: "_qciNumber",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "_snapshotProposalId",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateSnapshotProposal",
    inputs: [
      {
        name: "_qciNumber",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "_newSnapshotProposalId",
        type: "string",
        internalType: "string",
      },
      {
        name: "_reason",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "migrateQCI",
    inputs: [
      {
        name: "_qciNumber",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "_author",
        type: "address",
        internalType: "address",
      },
      {
        name: "_title",
        type: "string",
        internalType: "string",
      },
      {
        name: "_chain",
        type: "string",
        internalType: "string",
      },
      {
        name: "_contentHash",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "_ipfsUrl",
        type: "string",
        internalType: "string",
      },
      {
        name: "_createdAt",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "_status",
        type: "string",
        internalType: "string",
      },
      {
        name: "_implementor",
        type: "string",
        internalType: "string",
      },
      {
        name: "_implementationDate",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "_snapshotProposalId",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "migrationMode",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "nextQCINumber",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "pause",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "paused",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "qciVersionCount",
    inputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "qciVersions",
    inputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "contentHash",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "ipfsUrl",
        type: "string",
        internalType: "string",
      },
      {
        name: "timestamp",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "changeNote",
        type: "string",
        internalType: "string",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "qcis",
    inputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "qciNumber",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "author",
        type: "address",
        internalType: "address",
      },
      {
        name: "title",
        type: "string",
        internalType: "string",
      },
      {
        name: "chain",
        type: "string",
        internalType: "string",
      },
      {
        name: "contentHash",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "ipfsUrl",
        type: "string",
        internalType: "string",
      },
      {
        name: "createdAt",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "lastUpdated",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "status",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "implementor",
        type: "string",
        internalType: "string",
      },
      {
        name: "implementationDate",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "snapshotProposalId",
        type: "string",
        internalType: "string",
      },
      {
        name: "version",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "removeStatus",
    inputs: [
      {
        name: "_statusName",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "renounceRole",
    inputs: [
      {
        name: "role",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "callerConfirmation",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "revokeRole",
    inputs: [
      {
        name: "role",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "account",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setEditor",
    inputs: [
      {
        name: "_editor",
        type: "address",
        internalType: "address",
      },
      {
        name: "_status",
        type: "bool",
        internalType: "bool",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "setImplementation",
    inputs: [
      {
        name: "_qciNumber",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "_implementor",
        type: "string",
        internalType: "string",
      },
      {
        name: "_implementationDate",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "statusAt",
    inputs: [
      {
        name: "index",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "statusCount",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "statusExists",
    inputs: [
      {
        name: "_statusName",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "statusIndexOf",
    inputs: [
      {
        name: "_statusName",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [
      {
        name: "",
        type: "uint256",
        internalType: "uint256",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "supportsInterface",
    inputs: [
      {
        name: "interfaceId",
        type: "bytes4",
        internalType: "bytes4",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "syncNextQCINumber",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "transferAdmin",
    inputs: [
      {
        name: "newAdmin",
        type: "address",
        internalType: "address",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "unpause",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateQCI",
    inputs: [
      {
        name: "_qciNumber",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "_title",
        type: "string",
        internalType: "string",
      },
      {
        name: "_chain",
        type: "string",
        internalType: "string",
      },
      {
        name: "_implementor",
        type: "string",
        internalType: "string",
      },
      {
        name: "_newContentHash",
        type: "bytes32",
        internalType: "bytes32",
      },
      {
        name: "_newIpfsUrl",
        type: "string",
        internalType: "string",
      },
      {
        name: "_changeNote",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "updateStatus",
    inputs: [
      {
        name: "_qciNumber",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "_newStatus",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "verifyContent",
    inputs: [
      {
        name: "_qciNumber",
        type: "uint256",
        internalType: "uint256",
      },
      {
        name: "_content",
        type: "string",
        internalType: "string",
      },
    ],
    outputs: [
      {
        name: "",
        type: "bool",
        internalType: "bool",
      },
    ],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "MigrationWarning",
    inputs: [
      {
        name: "qciNumber",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "warning",
        type: "string",
        indexed: false,
        internalType: "string",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Paused",
    inputs: [
      {
        name: "account",
        type: "address",
        indexed: false,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "QCICreated",
    inputs: [
      {
        name: "qciNumber",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "author",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "title",
        type: "string",
        indexed: false,
        internalType: "string",
      },
      {
        name: "network",
        type: "string",
        indexed: false,
        internalType: "string",
      },
      {
        name: "contentHash",
        type: "bytes32",
        indexed: false,
        internalType: "bytes32",
      },
      {
        name: "ipfsUrl",
        type: "string",
        indexed: false,
        internalType: "string",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "QCIStatusChanged",
    inputs: [
      {
        name: "qciNumber",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "oldStatus",
        type: "bytes32",
        indexed: false,
        internalType: "bytes32",
      },
      {
        name: "newStatus",
        type: "bytes32",
        indexed: false,
        internalType: "bytes32",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "QCIUpdated",
    inputs: [
      {
        name: "qciNumber",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "version",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
      {
        name: "newContentHash",
        type: "bytes32",
        indexed: false,
        internalType: "bytes32",
      },
      {
        name: "newIpfsUrl",
        type: "string",
        indexed: false,
        internalType: "string",
      },
      {
        name: "changeNote",
        type: "string",
        indexed: false,
        internalType: "string",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RoleAdminChanged",
    inputs: [
      {
        name: "role",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "previousAdminRole",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "newAdminRole",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RoleGranted",
    inputs: [
      {
        name: "role",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "account",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "sender",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "RoleRevoked",
    inputs: [
      {
        name: "role",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "account",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "sender",
        type: "address",
        indexed: true,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SnapshotProposalLinked",
    inputs: [
      {
        name: "qciNumber",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "snapshotProposalId",
        type: "string",
        indexed: false,
        internalType: "string",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "SnapshotProposalUpdated",
    inputs: [
      {
        name: "qciNumber",
        type: "uint256",
        indexed: true,
        internalType: "uint256",
      },
      {
        name: "oldProposalId",
        type: "string",
        indexed: false,
        internalType: "string",
      },
      {
        name: "newProposalId",
        type: "string",
        indexed: false,
        internalType: "string",
      },
      {
        name: "updatedBy",
        type: "address",
        indexed: true,
        internalType: "address",
      },
      {
        name: "reason",
        type: "string",
        indexed: false,
        internalType: "string",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "StatusAdded",
    inputs: [
      {
        name: "statusId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "index",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "StatusRemoved",
    inputs: [
      {
        name: "statusId",
        type: "bytes32",
        indexed: true,
        internalType: "bytes32",
      },
      {
        name: "formerIndex",
        type: "uint256",
        indexed: false,
        internalType: "uint256",
      },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Unpaused",
    inputs: [
      {
        name: "account",
        type: "address",
        indexed: false,
        internalType: "address",
      },
    ],
    anonymous: false,
  },
  {
    type: "error",
    name: "AccessControlBadConfirmation",
    inputs: [],
  },
  {
    type: "error",
    name: "AccessControlUnauthorizedAccount",
    inputs: [
      {
        name: "account",
        type: "address",
        internalType: "address",
      },
      {
        name: "neededRole",
        type: "bytes32",
        internalType: "bytes32",
      },
    ],
  },
  {
    type: "error",
    name: "AlreadySubmittedToSnapshot",
    inputs: [],
  },
  {
    type: "error",
    name: "ChainRequired",
    inputs: [],
  },
  {
    type: "error",
    name: "ContentAlreadyExists",
    inputs: [],
  },
  {
    type: "error",
    name: "EnforcedPause",
    inputs: [],
  },
  {
    type: "error",
    name: "ExpectedPause",
    inputs: [],
  },
  {
    type: "error",
    name: "IPFSURLRequired",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidAddress",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidContentHash",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidSnapshotID",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidStatus",
    inputs: [],
  },
  {
    type: "error",
    name: "MigrationModeDisabled",
    inputs: [],
  },
  {
    type: "error",
    name: "NoSnapshotIDToClear",
    inputs: [],
  },
  {
    type: "error",
    name: "OnlyAuthorOrEditor",
    inputs: [],
  },
  {
    type: "error",
    name: "OnlyPlaceholderCanBeCleared",
    inputs: [],
  },
  {
    type: "error",
    name: "QCIAlreadyExists",
    inputs: [],
  },
  {
    type: "error",
    name: "QCIDoesNotExist",
    inputs: [],
  },
  {
    type: "error",
    name: "QCIMustBeReadyForSnapshot",
    inputs: [],
  },
  {
    type: "error",
    name: "QCISlotAlreadyUsed",
    inputs: [],
  },
  {
    type: "error",
    name: "SnapshotAlreadyLinked",
    inputs: [],
  },
  {
    type: "error",
    name: "TitleRequired",
    inputs: [],
  },
] as const;