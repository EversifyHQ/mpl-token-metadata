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

// Unwrap types and structs.
codama.update(c.unwrapDefinedTypesVisitor(["AssetData"]));
codama.update(c.unwrapTypeDefinedLinksVisitor(["metadata.data"]));
codama.update(
  c.flattenStructVisitor({
    Metadata: ["data"],
    "CreateArgs.V1": ["assetData"],
  })
);

// Render Rust client.
const crateDir = path.join(clientDir, "rust");
const rustDir = path.join(clientDir, "rust", "src", "generated");
codama.accept(
  renderRustVisitor(rustDir, {
    formatCode: true,
    crateFolder: crateDir,
  })
);