@echo off
where gradle >nul 2>&1
if %ERRORLEVEL% EQU 0 (
  gradle %*
  exit /b %ERRORLEVEL%
)
echo Gradle is not installed. Open native\android in Android Studio to install/sync the Gradle wrapper, then run gradlew.bat again.
exit /b 1
