const fs = require("fs");
const path = require("path");

function resolveGoogleServicesFile() {
  const fromEnv = process.env.GOOGLE_SERVICES_JSON;
  if (fromEnv) {
    if (fs.existsSync(fromEnv)) return fromEnv;
    const dest = path.join(__dirname, ".google-services.generated.json");
    const contents = fromEnv.trim().startsWith("{")
      ? fromEnv
      : Buffer.from(fromEnv, "base64").toString("utf8");
    fs.writeFileSync(dest, contents);
    return dest;
  }
  // `eas build` ewaluuje config lokalnie; gitignore'owany plik nie wpadnie do archiwum.
  // Na builderze jest sekret GOOGLE_SERVICES_JSON (typ file).
  if (process.env.EAS_BUILD === "true") return undefined;
  const local = path.join(__dirname, "google-services.json");
  return fs.existsSync(local) ? local : undefined;
}

module.exports = ({ config }) => {
  const googleServicesFile = resolveGoogleServicesFile();
  return {
    ...config,
    android: {
      ...(config.android ?? {}),
      ...(googleServicesFile ? { googleServicesFile } : {}),
    },
  };
};
