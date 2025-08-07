const path = require("path");
const c = require("codama");
const { rootNodeFromAnchor } = require("@codama/nodes-from-anchor");
const { renderVisitor: renderRustVisitor } = require("@codama/renderers-rust");

// Paths.
const clientDir = path.join(__dirname, "..", "clients");
const idlDir = path.join(__dirname, "..", "idls");

// Load the IDL and create Codama instance
const idl = require(path.join(idlDir, "token_metadata.json"));
const codama = c.createFromRoot(rootNodeFromAnchor(idl));

codama.update(
  c.updateProgramsVisitor({
    tokenMetadata: {
      name: "mplTokenMetadata",
    },
  })
);

// Update Accounts.
const metadataSeeds = [
  c.constantPdaSeedNodeFromString("metadata"),
  c.programIdPdaSeedNode(),
  c.variablePdaSeedNode(
    "mint",
    c.publicKeyTypeNode(),
    "The address of the mint account"
  ),
];
codama.update(
  c.updateAccountsVisitor({
    metadata: {
      size: null,
      seeds: metadataSeeds,
    },
    masterEditionV1: {
      size: null,
      name: "deprecatedMasterEditionV1",
      seeds: [...metadataSeeds, c.constantPdaSeedNodeFromString("edition")],
    },
    masterEditionV2: {
      size: null,
      name: "masterEdition",
      seeds: [...metadataSeeds, c.constantPdaSeedNodeFromString("edition")],
    },
    editionMarker: {
      seeds: [
        ...metadataSeeds,
        c.constantPdaSeedNodeFromString("edition"),
        c.variablePdaSeedNode(
          "editionMarker",
          c.stringTypeNode({ size: c.remainderSizeNode() }),
          "The floor of the edition number divided by 248 as a string. I.e. ⌊edition/248⌋."
        ),
      ],
    },
    editionMarkerV2: {
      seeds: [
        ...metadataSeeds,
        c.constantPdaSeedNodeFromString("edition"),
        c.constantPdaSeedNodeFromString("marker"),
      ],
    },
    tokenRecord: {
      size: 80,
      seeds: [
        ...metadataSeeds,
        c.constantPdaSeedNodeFromString("token_record"),
        c.variablePdaSeedNode(
          "token",
          c.publicKeyTypeNode(),
          "The address of the token account (ata or not)"
        ),
      ],
    },
    metadataDelegateRecord: {
      size: 98,
      seeds: [
        ...metadataSeeds,
        c.variablePdaSeedNode(
          "delegateRole",
          c.definedTypeLinkNode("metadataDelegateRoleSeed", "hooked"),
          "The role of the metadata delegate"
        ),
        c.variablePdaSeedNode(
          "updateAuthority",
          c.publicKeyTypeNode(),
          "The address of the metadata's update authority"
        ),
        c.variablePdaSeedNode(
          "delegate",
          c.publicKeyTypeNode(),
          "The address of the delegate authority"
        ),
      ],
    },
    collectionAuthorityRecord: {
      seeds: [
        ...metadataSeeds,
        c.constantPdaSeedNodeFromString("collection_authority"),
        c.variablePdaSeedNode(
          "collectionAuthority",
          c.publicKeyTypeNode(),
          "The address of the collection authority"
        ),
      ],
    },
    holderDelegateRecord: {
      size: 98,
      seeds: [
        ...metadataSeeds,
        c.variablePdaSeedNode(
          "delegateRole",
          c.definedTypeLinkNode("holderDelegateRoleSeed", "hooked"),
          "The role of the holder delegate"
        ),
        c.variablePdaSeedNode(
          "owner",
          c.publicKeyTypeNode(),
          "The address of the owner of the token"
        ),
        c.variablePdaSeedNode(
          "delegate",
          c.publicKeyTypeNode(),
          "The address of the delegate authority"
        ),
      ],
    },
    useAuthorityRecord: {
      seeds: [
        ...metadataSeeds,
        c.constantPdaSeedNodeFromString("user"),
        c.variablePdaSeedNode(
          "useAuthority",
          c.publicKeyTypeNode(),
          "The address of the use authority"
        ),
      ],
    },
    // Deprecated nodes.
    "mplTokenMetadata.ReservationListV1": { delete: true },
    "mplTokenMetadata.ReservationListV2": { delete: true },
  })
);

// Set default values for instruction accounts.
codama.update(
  c.setInstructionAccountDefaultValuesVisitor([
    {
      account: "updateAuthority",
      ignoreIfOptional: true,
      defaultValue: c.identityValueNode(),
    },
    {
      account: "metadata",
      ignoreIfOptional: true,
      defaultValue: c.pdaValueNode("metadata"),
    },
    {
      account: "tokenRecord",
      ignoreIfOptional: true,
      defaultValue: c.pdaValueNode("tokenRecord"),
    },
    {
      account: /^edition|masterEdition$/,
      ignoreIfOptional: true,
      defaultValue: c.pdaValueNode("masterEdition"),
    },
    {
      account: "authorizationRulesProgram",
      defaultValue: c.conditionalValueNode({
        condition: c.accountValueNode("authorizationRules"),
        ifTrue: c.publicKeyValueNode(
          "auth9SigNpDKz4sJJ1DfCTuZrZNSAgh9sFD3rboVmgg",
          "mplTokenAuthRules"
        )
      }),
    },
  ])
);

// Update Instructions.
const ataPdaDefault = (mint = "mint", owner = "owner") =>
  c.pdaValueNode(c.pdaLinkNode("associatedToken", "mplToolbox"), [
    c.pdaSeedValueNode("mint", c.accountValueNode(mint)),
    c.pdaSeedValueNode("owner", c.accountValueNode(owner))
  ]);
codama.update(
  c.updateInstructionsVisitor({
    create: {
      byteDeltas: [
        c.instructionByteDeltaNode(
          c.numberValueNode(
            82 + // Mint account.
            679 + // Metadata account.
            282 + // Master edition account.
            128 * 3 // 3 account headers.
          ),
          { withHeader: false }
        ),
      ],
      accounts: {
        mint: { isSigner: "either" },
        updateAuthority: {
          isSigner: "either",
          defaultValue: c.accountValueNode("authority"),
        },
        splTokenProgram: {
          defaultValue: c.conditionalValueNode({
            condition: c.resolverValueNode(
              "resolveIsNonFungibleOrIsMintSigner",
              {
                dependsOn: [
                  c.accountValueNode("mint"),
                  c.argumentValueNode("tokenStandard"),
                ],
              }
            ),
            ifTrue: c.publicKeyValueNode(
              "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              "splToken"
            ),
          }),
        },
      },
    },
    mint: {
      byteDeltas: [
        c.instructionByteDeltaNode(
          c.numberValueNode(
            165 + // Token account.
            47 + // Token Record account.
            128 * 2 // 2 account headers.
          ),
          { withHeader: false }
        ),
      ],
      accounts: {
        masterEdition: {
          defaultValue: c.conditionalValueNode({
            condition: c.resolverValueNode("resolveIsNonFungible", {
              dependsOn: [c.argumentValueNode("tokenStandard")],
            }),
            ifTrue: c.pdaValueNode("masterEdition"),
          }),
        },
        tokenOwner: {
          defaultValue: c.resolverValueNode("resolveOptionalTokenOwner"),
        },
        token: {
          defaultValue: ataPdaDefault("mint", "tokenOwner"),
        },
        tokenRecord: {
          defaultValue: c.conditionalValueNode({
            condition: c.argumentValueNode("tokenStandard"),
            value: c.enumValueNode("TokenStandard", "ProgrammableNonFungible"),
            ifTrue: c.pdaValueNode("tokenRecord"),
          }),
        },
      },
      arguments: {
        tokenStandard: { type: c.definedTypeLinkNode("tokenStandard") },
      },
    },
    transfer: {
      accounts: {
        token: {
          defaultValue: ataPdaDefault("mint", "tokenOwner"),
        },
        tokenOwner: {
          defaultValue: c.identityValueNode(),
        },
        edition: {
          defaultValue: c.conditionalValueNode({
            condition: c.argumentValueNode("tokenStandard"),
            value: c.enumValueNode("TokenStandard", "ProgrammableNonFungible"),
            ifTrue: c.pdaValueNode("masterEdition"),
          }),
        },
        ownerTokenRecord: {
          name: "tokenRecord",
          defaultValue: c.conditionalValueNode({
            condition: c.argumentValueNode("tokenStandard"),
            value: c.enumValueNode("TokenStandard", "ProgrammableNonFungible"),
            ifTrue: c.pdaValueNode("tokenRecord"),
          }),
        },
        destination: {
          name: "destinationToken",
          defaultValue: ataPdaDefault("mint", "destinationOwner"),
        },
        destinationTokenRecord: {
          defaultValue: c.conditionalValueNode({
            condition: c.argumentValueNode("tokenStandard"),
            value: c.enumValueNode("TokenStandard", "ProgrammableNonFungible"),
            ifTrue: c.pdaValueNode("tokenRecord", [
              c.pdaSeedValueNode(
                "token",
                c.accountValueNode("destinationToken")
              ),
            ]),
          }),
        },
      },
      arguments: {
        tokenStandard: { type: c.definedTypeLinkNode("tokenStandard") },
      },
    },
    delegate: {
      accounts: {
        masterEdition: {
          defaultValue: c.conditionalValueNode({
            condition: c.resolverValueNode("resolveIsNonFungible", {
              dependsOn: [c.argumentValueNode("tokenStandard")],
            }),
            ifTrue: c.pdaValueNode("masterEdition"),
          }),
        },
      },
      arguments: {
        tokenStandard: {
          type: c.definedTypeLinkNode("tokenStandard"),
        },
      },
    },
    revoke: {
      accounts: {
        masterEdition: {
          defaultValue: c.conditionalValueNode({
            condition: c.resolverValueNode("resolveIsNonFungible", {
              dependsOn: [c.argumentValueNode("tokenStandard")],
            }),
            ifTrue: c.pdaValueNode("masterEdition"),
          }),
        },
      },
      arguments: {
        tokenStandard: {
          type: c.definedTypeLinkNode("tokenStandard"),
        },
      },
    },
    lock: {
      accounts: {
        tokenOwner: {
          defaultValue: c.resolverValueNode("resolveOptionalTokenOwner"),
        },
        token: {
          defaultValue: ataPdaDefault("mint", "tokenOwner"),
        },
        edition: {
          defaultValue: c.conditionalValueNode({
            condition: c.resolverValueNode("resolveIsNonFungible", {
              dependsOn: [c.argumentValueNode("tokenStandard")],
            }),
            ifTrue: c.pdaValueNode("masterEdition"),
          }),
        },
        tokenRecord: {
          defaultValue: c.conditionalValueNode({
            condition: c.argumentValueNode("tokenStandard"),
            value: c.enumValueNode("TokenStandard", "ProgrammableNonFungible"),
            ifTrue: c.pdaValueNode("tokenRecord"),
          }),
        },
        splTokenProgram: {
          defaultValue: c.conditionalValueNode({
            condition: c.argumentValueNode("tokenStandard"),
            value: c.enumValueNode("TokenStandard", "ProgrammableNonFungible"),
            ifFalse: c.publicKeyValueNode(
              "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              "splToken"
            ),
          }),
        },
      },
      arguments: {
        tokenStandard: { type: c.definedTypeLinkNode("tokenStandard") },
      },
    },
    unlock: {
      accounts: {
        tokenOwner: {
          defaultValue: c.resolverValueNode("resolveOptionalTokenOwner"),
        },
        token: {
          defaultValue: ataPdaDefault("mint", "tokenOwner"),
        },
        edition: {
          defaultValue: c.conditionalValueNode({
            condition: c.resolverValueNode("resolveIsNonFungible", {
              dependsOn: [c.argumentValueNode("tokenStandard")],
            }),
            ifTrue: c.pdaValueNode("masterEdition"),
          }),
        },
        tokenRecord: {
          defaultValue: c.conditionalValueNode({
            condition: c.argumentValueNode("tokenStandard"),
            value: c.enumValueNode("TokenStandard", "ProgrammableNonFungible"),
            ifTrue: c.pdaValueNode("tokenRecord"),
          }),
        },
        splTokenProgram: {
          defaultValue: c.conditionalValueNode({
            condition: c.argumentValueNode("tokenStandard"),
            value: c.enumValueNode("TokenStandard", "ProgrammableNonFungible"),
            ifFalse: c.publicKeyValueNode(
              "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
              "splToken"
            ),
          }),
        },
      },
      arguments: {
        tokenStandard: { type: c.definedTypeLinkNode("tokenStandard") },
      },
    },
    burn: {
      accounts: {
        token: {
          isOptional: false,
          defaultValue: c.pdaValueNode(
            c.pdaLinkNode("associatedToken", "mplToolbox"),
            [
              c.pdaSeedValueNode("mint", c.accountValueNode("mint")),
              c.pdaSeedValueNode("owner", c.argumentValueNode("tokenOwner")),
            ]
          ),
        },
        edition: {
          defaultValue: c.conditionalValueNode({
            condition: c.resolverValueNode("resolveIsNonFungible", {
              dependsOn: [c.argumentValueNode("tokenStandard")],
            }),
            ifTrue: c.pdaValueNode("masterEdition"),
          }),
        },
        masterEdition: {
          defaultValue: c.conditionalValueNode({
            condition: c.accountValueNode("masterEditionMint"),
            ifTrue: c.pdaValueNode("masterEdition", [
              c.pdaSeedValueNode(
                "mint",
                c.accountValueNode("masterEditionMint")
              ),
            ]),
          }),
        },
        tokenRecord: {
          defaultValue: c.conditionalValueNode({
            condition: c.argumentValueNode("tokenStandard"),
            value: c.enumValueNode("TokenStandard", "ProgrammableNonFungible"),
            ifTrue: c.pdaValueNode("tokenRecord"),
          }),
        },
      },
      arguments: {
        tokenOwner: {
          type: c.publicKeyTypeNode(),
          defaultValue: c.identityValueNode(),
        },
        tokenStandard: { type: c.definedTypeLinkNode("tokenStandard") },
      },
    },
    print: {
      accounts: {
        editionMint: { isSigner: "either" },
        editionTokenAccountOwner: { defaultValue: c.identityValueNode() },
        editionMetadata: {
          defaultValue: c.pdaValueNode("metadata", [
            c.pdaSeedValueNode("mint", c.accountValueNode("editionMint")),
          ]),
        },
        edition: {
          defaultValue: c.pdaValueNode("masterEdition", [
            c.pdaSeedValueNode("mint", c.accountValueNode("editionMint")),
          ]),
        },
        editionTokenAccount: {
          defaultValue: ataPdaDefault("editionMint", "editionTokenAccountOwner"),
        },
        masterTokenAccount: {
          defaultValue: c.pdaValueNode(
            c.pdaLinkNode("associatedToken", "mplToolbox"),
            [
              c.pdaSeedValueNode(
                "mint",
                c.argumentValueNode("masterEditionMint")
              ),
              c.pdaSeedValueNode(
                "owner",
                c.accountValueNode("masterTokenAccountOwner")
              ),
            ]
          ),
        },
        masterMetadata: {
          defaultValue: c.pdaValueNode("metadata", [
            c.pdaSeedValueNode(
              "mint",
              c.argumentValueNode("masterEditionMint")
            ),
          ]),
        },
        masterEdition: {
          defaultValue: c.pdaValueNode("masterEdition", [
            c.pdaSeedValueNode(
              "mint",
              c.argumentValueNode("masterEditionMint")
            ),
          ]),
        },
        editionTokenRecord: {
          defaultValue: c.conditionalValueNode({
            condition: c.argumentValueNode("tokenStandard"),
            value: c.enumValueNode("TokenStandard", "ProgrammableNonFungible"),
            ifTrue: c.pdaValueNode("tokenRecord", [
              c.pdaSeedValueNode(
                "mint",
                c.accountValueNode("editionMint")
              ),
              c.pdaSeedValueNode(
                "token",
                c.accountValueNode("editionTokenAccount")
              ),
            ])
          }),
        },
      },
      arguments: {
        masterEditionMint: { type: c.publicKeyTypeNode() },
        tokenStandard: { type: c.definedTypeLinkNode("tokenStandard") },
      },
    },
    updateMetadataAccountV2: {
      arguments: { updateAuthority: { name: "newUpdateAuthority" } },
    },
    // Deprecated instructions.
    createMetadataAccount: { delete: true },
    createMetadataAccountV2: { delete: true },
    createMasterEdition: { delete: true },
    updateMetadataAccount: { delete: true },
    deprecatedCreateReservationList: { delete: true },
    deprecatedSetReservationList: { delete: true },
    deprecatedCreateMasterEdition: { delete: true },
    deprecatedMintPrintingTokens: { delete: true },
    deprecatedMintPrintingTokensViaToken: { delete: true },
  })
);

// Set account discriminators.
const key = (name) => ({
  field: "key",
  value: c.enumValueNode("Key", name),
});
codama.update(
  c.setAccountDiscriminatorFromFieldVisitor({
    Edition: key("EditionV1"),
    Metadata: key("MetadataV1"),
    MasterEdition: key("MasterEditionV2"),
    EditionMarker: key("EditionMarker"),
    UseAuthorityRecord: key("UseAuthorityRecord"),
    CollectionAuthorityRecord: key("CollectionAuthorityRecord"),
    TokenOwnedEscrow: key("TokenOwnedEscrow"),
    TokenRecord: key("TokenRecord"),
    MetadataDelegate: key("MetadataDelegate"),
    DeprecatedMasterEditionV1: key("MasterEditionV1"),
    HolderDelegate: key("HolderDelegate"),
  })
);

// Wrap leaves.
codama.update(
  c.setNumberWrappersVisitor({
    "AssetData.sellerFeeBasisPoints": {
      kind: "Amount",
      decimals: 2,
      unit: "%",
    },
  })
);

// Set struct default values.
codama.update(
  c.setStructDefaultValuesVisitor({
    assetData: {
      symbol: c.stringValueNode(""),
      isMutable: c.booleanValueNode(true),
      primarySaleHappened: c.booleanValueNode(false),
      collection: c.noneValueNode(),
      uses: c.noneValueNode(),
      collectionDetails: c.noneValueNode(),
      ruleSet: c.noneValueNode(),
    },
    "updateArgs.AsUpdateAuthorityV2": { tokenStandard: c.noneValueNode() },
    "updateArgs.AsAuthorityItemDelegateV2": {
      tokenStandard: c.noneValueNode(),
    },
  })
);

// Set more struct default values dynamically.
codama.update(
  c.bottomUpTransformerVisitor([
    {
      select: "[structFieldTypeNode|instructionArgumentNode]amount",
      transform: (node) => {
        c.assertIsNode(node, [
          "structFieldTypeNode",
          "instructionArgumentNode",
        ]);
        return {
          ...node,
          defaultValueStrategy: "optional",
          defaultValue: c.numberValueNode(1),
        };
      },
    },
    {
      select: (node) => {
        const names = [
          "authorizationData",
          "decimals",
          "printSupply",
          "newUpdateAuthority",
          "data",
          "primarySaleHappened",
          "isMutable",
        ];
        return (
          c.isNode(node, ["structFieldTypeNode", "instructionArgumentNode"]) &&
          c.isNode(node.type, "optionTypeNode") &&
          names.includes(node.name)
        );
      },
      transform: (node) => {
        c.assertIsNode(node, [
          "structFieldTypeNode",
          "instructionArgumentNode",
        ]);
        return {
          ...node,
          defaultValueStrategy: "optional",
          defaultValue: c.noneValueNode()
        };
      },
    },
    {
      select: (node) => {
        const toggles = [
          "collectionToggle",
          "collectionDetailsToggle",
          "usesToggle",
          "ruleSetToggle",
        ];
        return (
          c.isNode(node, "structFieldTypeNode") &&
          c.isNode(node.type, "definedTypeLinkNode") &&
          toggles.includes(node.type.name)
        );
      },
      transform: (node) => {
        c.assertIsNode(node, "structFieldTypeNode");
        c.assertIsNode(node.type, "definedTypeLinkNode");
        return c.structFieldTypeNode({
          ...node,
          defaultValueStrategy: "optional",
          defaultValue: c.enumValueNode(node.type, "None"),
        });
      },
    },
  ])
);

// Unwrap types and structs.
codama.update(c.unwrapDefinedTypesVisitor(["AssetData"]));
codama.update(c.unwrapTypeDefinedLinksVisitor(["metadata.data"]));
codama.update(
  c.flattenStructVisitor({
    Metadata: ["data"],
    "CreateArgs.V1": ["assetData"],
  })
);

// Create versioned instructions.
codama.update(
  c.createSubInstructionsFromEnumArgsVisitor({
    burn: "burnArgs",
    create: "createArgs",
    delegate: "delegateArgs",
    lock: "lockArgs",
    mint: "mintArgs",
    print: "printArgs",
    revoke: "revokeArgs",
    transfer: "transferArgs",
    unlock: "unlockArgs",
    update: "updateArgs",
    use: "useArgs",
    verify: "verificationArgs",
    unverify: "verificationArgs",
  })
);

codama.update(
  c.bottomUpTransformerVisitor([
    {
      select: "[instructionNode]printV2",
      transform: (node) => {
        c.assertIsNode(node, [
          "instructionNode"
        ]);
        return c.instructionNode({
          ...node,
          accounts: [
            ...node.accounts,
            c.instructionAccountNode({
              name: "holderDelegateRecord",
              isOptional: true,
              docs: ["The Delegate Record authorizing escrowless edition printing"],
            }),
            c.instructionAccountNode({
              name: "delegate",
              isOptional: true,
              isSigner: true,
              docs: ["The authority printing the edition for a delegated print"],
            })
          ],
        });
      },
    },
  ])
);

// Update versioned instructions.
const tokenDelegateDefaults = {
  accounts: {
    token: {
      isOptional: false,
      defaultValue: c.pdaValueNode(
        c.pdaLinkNode("associatedToken", "mplToolbox"),
        [
          c.pdaSeedValueNode("mint", c.accountValueNode("mint")),
          c.pdaSeedValueNode("owner", c.argumentValueNode("tokenOwner")),
        ]
      ),
    },
    tokenRecord: {
      defaultValue: c.conditionalValueNode({
        condition: c.argumentValueNode("tokenStandard"),
        value: c.enumValueNode("TokenStandard", "ProgrammableNonFungible"),
        ifTrue: c.pdaValueNode("tokenRecord"),
      }),
    },
    delegateRecord: { defaultValue: c.pdaValueNode("tokenRecord") },
    splTokenProgram: {
      defaultValue: c.publicKeyValueNode(
        "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
        "splToken"
      ),
    },
  },
  arguments: {
    tokenOwner: {
      type: c.publicKeyTypeNode(),
      defaultValue: c.identityValueNode(),
    },
  },
};
const metadataDelegateDefaults = (role) => ({
  accounts: {
    delegateRecord: {
      defaultValue: c.pdaValueNode("metadataDelegateRecord", [
        c.pdaSeedValueNode(
          "delegateRole",
          c.enumValueNode("MetadataDelegateRole", role)
        ),
        c.pdaSeedValueNode(
          "updateAuthority",
          c.argumentValueNode("updateAuthority")
        ),
      ]),
    },
  },
  arguments: {
    updateAuthority: {
      type: c.publicKeyTypeNode(),
      defaultValue: c.accountValueNode("authority"),
    },
  },
});
const updateAsMetadataDelegateDefaults = (role) => ({
  accounts: {
    delegateRecord: {
      defaultValue: c.pdaValueNode("metadataDelegateRecord", [
        c.pdaSeedValueNode(
          "delegateRole",
          c.enumValueNode("MetadataDelegateRole", role)
        ),
        c.pdaSeedValueNode(
          "updateAuthority",
          c.argumentValueNode("updateAuthority")
        ),
        c.pdaSeedValueNode("delegate", c.accountValueNode("authority")),
      ]),
    },
    token:
      role === "ProgrammableConfigItem"
        ? { isOptional: false, defaultValue: null }
        : undefined,
  },
  arguments: {
    updateAuthority: {
      type: c.publicKeyTypeNode(),
      defaultValue: c.identityValueNode(),
    },
  },
});
const updateAsMetadataCollectionDelegateDefaults = (role) => ({
  accounts: {
    delegateRecord: {
      defaultValue: c.pdaValueNode("metadataDelegateRecord", [
        c.pdaSeedValueNode("mint", c.argumentValueNode("delegateMint")),
        c.pdaSeedValueNode(
          "delegateRole",
          c.enumValueNode("MetadataDelegateRole", role)
        ),
        c.pdaSeedValueNode(
          "updateAuthority",
          c.argumentValueNode("delegateUpdateAuthority")
        ),
        c.pdaSeedValueNode("delegate", c.accountValueNode("authority")),
      ]),
    },
    token:
      role === "ProgrammableConfig"
        ? { isOptional: false, defaultValue: null }
        : undefined,
  },
  arguments: {
    delegateMint: {
      type: c.publicKeyTypeNode(),
      defaultValue: c.accountValueNode("mint"),
    },
    delegateUpdateAuthority: {
      type: c.publicKeyTypeNode(),
      defaultValue: c.identityValueNode(),
    },
  },
});
const verifyCollectionDefaults = {
  accounts: {
    collectionMint: { isOptional: false, defaultValue: null },
    collectionMetadata: {
      defaultValue: c.pdaValueNode("metadata", [
        c.pdaSeedValueNode("mint", c.accountValueNode("collectionMint")),
      ]),
    },
    collectionMasterEdition: {
      defaultValue: c.pdaValueNode("masterEdition", [
        c.pdaSeedValueNode("mint", c.accountValueNode("collectionMint")),
      ]),
    },
  },
};
codama.update(
  c.updateInstructionsVisitor({
    createV1: {
      byteDeltas: [
        c.instructionByteDeltaNode(c.resolverValueNode("resolveCreateV1Bytes")),
      ],
      accounts: {
        masterEdition: {
          defaultValue: c.conditionalValueNode({
            condition: c.resolverValueNode("resolveIsNonFungible", {
              dependsOn: [c.argumentValueNode("tokenStandard")],
            }),
            ifTrue: c.pdaValueNode("masterEdition"),
          }),
        },
      },
      arguments: {
        isCollection: {
          type: c.booleanTypeNode(),
          defaultValue: c.booleanValueNode(false),
        },
        tokenStandard: {
          defaultValue: c.enumValueNode("TokenStandard", "NonFungible"),
        },
        collectionDetails: {
          defaultValue: c.resolverValueNode("resolveCollectionDetails", {
            dependsOn: [c.argumentValueNode("isCollection")],
          }),
        },
        decimals: {
          defaultValue: c.resolverValueNode("resolveDecimals", {
            dependsOn: [c.argumentValueNode("tokenStandard")],
          }),
        },
        printSupply: {
          defaultValue: c.resolverValueNode("resolvePrintSupply", {
            dependsOn: [c.argumentValueNode("tokenStandard")],
          }),
        },
        creators: {
          defaultValue: c.resolverValueNode("resolveCreators", {
            dependsOn: [c.accountValueNode("authority")],
          }),
        },
      },
    },
    printV1: {
      accounts: {
        editionMarkerPda: {
          defaultValue: c.conditionalValueNode({
            condition: c.argumentValueNode("tokenStandard"),
            value: c.enumValueNode("TokenStandard", "ProgrammableNonFungible"),
            ifTrue: c.pdaValueNode("editionMarkerV2", [
              c.pdaSeedValueNode(
                "mint",
                c.argumentValueNode("masterEditionMint")
              ),
            ]),
            ifFalse: c.pdaValueNode(
              c.pdaLinkNode("editionMarkerFromEditionNumber", "hooked"),
              [
                c.pdaSeedValueNode(
                  "mint",
                  c.argumentValueNode("masterEditionMint")
                ),
                c.pdaSeedValueNode(
                  "editionNumber",
                  c.argumentValueNode("editionNumber")
                ),
              ]
            ),
          }),
        },
        editionMintAuthority: {
          defaultValue: c.accountValueNode("masterTokenAccountOwner"),
        },
        masterTokenAccountOwner: {
          defaultValue: c.identityValueNode(),
          isSigner: true
        },
      },
      arguments: { edition: { name: "editionNumber" }, },
    },
    printV2: {
      accounts: {
        editionMarkerPda: {
          defaultValue: c.conditionalValueNode({
            condition: c.argumentValueNode("tokenStandard"),
            value: c.enumValueNode("TokenStandard", "ProgrammableNonFungible"),
            ifTrue: c.pdaValueNode("editionMarkerV2", [
              c.pdaSeedValueNode(
                "mint",
                c.argumentValueNode("masterEditionMint")
              ),
            ]),
            ifFalse: c.pdaValueNode(
              c.pdaLinkNode("editionMarkerFromEditionNumber", "hooked"),
              [
                c.pdaSeedValueNode(
                  "mint",
                  c.argumentValueNode("masterEditionMint")
                ),
                c.pdaSeedValueNode(
                  "editionNumber",
                  c.argumentValueNode("editionNumber")
                ),
              ]
            ),
          }),
        },
        editionMintAuthority: {
          defaultValue: c.conditionalValueNode({
            condition: c.accountValueNode("holderDelegateRecord"),
              ifTrue: c.conditionalValueNode({
                  condition: c.accountValueNode("delegate"),
                  ifTrue: c.accountValueNode("delegate"),
                  ifFalse: c.accountValueNode("payer"),
              }),
            ifFalse: c.identityValueNode(),
          }),
        },
        masterTokenAccountOwner: {
          defaultValue: c.conditionalValueNode({
            condition: c.accountValueNode("holderDelegateRecord"),
            ifFalse: c.identityValueNode(),
          }),
        },
      },
      arguments: { edition: { name: "editionNumber" }, },
    },
    // Update.
    updateAsAuthorityItemDelegateV2:
      updateAsMetadataDelegateDefaults("AuthorityItem"),
    updateAsCollectionDelegateV2:
      updateAsMetadataCollectionDelegateDefaults("Collection"),
    updateAsDataDelegateV2: updateAsMetadataCollectionDelegateDefaults("Data"),
    updateAsProgrammableConfigDelegateV2:
      updateAsMetadataCollectionDelegateDefaults("ProgrammableConfig"),
    updateAsDataItemDelegateV2: updateAsMetadataDelegateDefaults("DataItem"),
    updateAsCollectionItemDelegateV2:
      updateAsMetadataDelegateDefaults("CollectionItem"),
    updateAsProgrammableConfigItemDelegateV2: updateAsMetadataDelegateDefaults(
      "ProgrammableConfigItem"
    ),
    // Delegate.
    delegateCollectionV1: metadataDelegateDefaults("Collection"),
    delegateSaleV1: tokenDelegateDefaults,
    delegateTransferV1: tokenDelegateDefaults,
    delegateDataV1: metadataDelegateDefaults("Data"),
    delegateUtilityV1: tokenDelegateDefaults,
    delegateStakingV1: tokenDelegateDefaults,
    delegateStandardV1: {
      ...tokenDelegateDefaults,
      accounts: {
        ...tokenDelegateDefaults.accounts,
        tokenRecord: { defaultValue: c.programIdValueNode() },
      },
    },
    delegateLockedTransferV1: tokenDelegateDefaults,
    delegateProgrammableConfigV1:
      metadataDelegateDefaults("ProgrammableConfig"),
    delegateAuthorityItemV1: metadataDelegateDefaults("AuthorityItem"),
    delegateDataItemV1: metadataDelegateDefaults("DataItem"),
    delegateCollectionItemV1: metadataDelegateDefaults("CollectionItem"),
    delegateProgrammableConfigItemV1: metadataDelegateDefaults(
      "ProgrammableConfigItem"
    ),
    // Revoke.
    revokeCollectionV1: metadataDelegateDefaults("Collection"),
    revokeSaleV1: tokenDelegateDefaults,
    revokeTransferV1: tokenDelegateDefaults,
    revokeDataV1: metadataDelegateDefaults("Data"),
    revokeUtilityV1: tokenDelegateDefaults,
    revokeStakingV1: tokenDelegateDefaults,
    revokeStandardV1: {
      ...tokenDelegateDefaults,
      accounts: {
        ...tokenDelegateDefaults.accounts,
        tokenRecord: { defaultValue: c.programIdValueNode() },
      },
    },
    revokeLockedTransferV1: tokenDelegateDefaults,
    revokeProgrammableConfigV1: metadataDelegateDefaults("ProgrammableConfig"),
    revokeMigrationV1: tokenDelegateDefaults,
    revokeAuthorityItemV1: metadataDelegateDefaults("AuthorityItem"),
    revokeDataItemV1: metadataDelegateDefaults("DataItem"),
    revokeCollectionItemV1: metadataDelegateDefaults("CollectionItem"),
    revokeProgrammableConfigItemV1: metadataDelegateDefaults(
      "ProgrammableConfigItem"
    ),
    // Verify collection.
    verifyCollectionV1: verifyCollectionDefaults,
    unverifyCollectionV1: verifyCollectionDefaults,
  })
);

// Render Rust.
const crateDir = path.join(clientDir, "rust");
const rustDir = path.join(clientDir, "rust", "src", "generated");
codama.accept(
  renderRustVisitor(rustDir, {
    formatCode: true,
    crateFolder: crateDir,
  })
);
