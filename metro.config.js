const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const config = getDefaultConfig(__dirname);

const elementsRoot = path.resolve(
  __dirname,
  "node_modules/@react-navigation/elements"
);
const elementsEntry = path.join(elementsRoot, "lib/module/index.js");

config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  "@react-navigation/elements": elementsRoot,
};

const nobleCrypto = {
  "@noble/hashes/crypto.js": path.resolve(__dirname, "node_modules/@noble/hashes/esm/crypto.js"),
  "@noble/hashes/crypto": path.resolve(__dirname, "node_modules/@noble/hashes/esm/crypto.js"),
  "@noble/ciphers/crypto.js": path.resolve(__dirname, "node_modules/@noble/ciphers/esm/crypto.js"),
  "@noble/ciphers/crypto": path.resolve(__dirname, "node_modules/@noble/ciphers/esm/crypto.js"),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === "@react-navigation/elements") {
    return {
      type: "sourceFile",
      filePath: elementsEntry,
    };
  }

  const noblePath = nobleCrypto[moduleName];
  if (noblePath) {
    return {
      type: "sourceFile",
      filePath: noblePath,
    };
  }

  if (moduleName === "./crypto.js" || moduleName === "./crypto") {
    const origin = context.originModulePath ?? "";
    if (origin.includes(`${path.sep}@noble${path.sep}hashes${path.sep}`)) {
      return {
        type: "sourceFile",
        filePath: nobleCrypto["@noble/hashes/crypto"],
      };
    }
    if (origin.includes(`${path.sep}@noble${path.sep}ciphers${path.sep}`)) {
      return {
        type: "sourceFile",
        filePath: nobleCrypto["@noble/ciphers/crypto"],
      };
    }
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
