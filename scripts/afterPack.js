/**
 * electron-builder afterPack hook.
 *
 * Applies an ad-hoc codesign to the freshly-packaged .app so the bundle is
 * tamper-evident and can call entitlements-gated macOS APIs. Does NOT
 * bypass Gatekeeper — that still requires a paid Apple Developer ID
 * (for notarization) or the user stripping the quarantine attribute.
 *
 * Runs after the .app is built but before the .dmg / .zip are assembled,
 * so the copy inside those archives inherits the signature.
 */
const { execSync } = require("child_process");
const { existsSync } = require("fs");

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") return;

  const appName = context.packager.appInfo.productFilename;
  const appPath = `${context.appOutDir}/${appName}.app`;
  if (!existsSync(appPath)) return;

  console.log(`  • ad-hoc signing ${appPath}`);
  try {
    execSync(
      `codesign --force --deep --sign - "${appPath}"`,
      { stdio: "inherit" }
    );
  } catch (err) {
    console.warn(`  • ad-hoc signing failed: ${err.message}`);
  }
};
