import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const required = [
  "native/android/settings.gradle.kts",
  "native/android/build.gradle.kts",
  "native/android/app/build.gradle.kts",
  "native/android/app/src/main/AndroidManifest.xml",
  "native/android/app/src/main/java/com/licia/lifeos/MainActivity.kt",
  "native/android/app/src/main/res/values/themes.xml",
  "native/android/app/src/main/res/xml/file_paths.xml",
  "README.md",
];

const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`Native verification failed. Missing: ${missing.join(", ")}`);
  process.exit(1);
}

const gradle = fs.readFileSync(path.join(root, "native/android/app/build.gradle.kts"), "utf8");
if (!gradle.includes("BuildConfig.LICIA_URL".replace("BuildConfig.", "")) || !gradle.includes("LICIA_URL")) {
  console.error("Native verification failed: LICIA_URL configuration missing");
  process.exit(1);
}

const manifest = fs.readFileSync(path.join(root, "native/android/app/src/main/AndroidManifest.xml"), "utf8");
for (const marker of [
  "android.permission.INTERNET",
  "android.permission.CAMERA",
  "android.permission.POST_NOTIFICATIONS",
]) {
  if (!manifest.includes(marker)) {
    console.error(`Native verification failed: ${marker} missing`);
    process.exit(1);
  }
}

console.log("Licia native Android verification OK");
