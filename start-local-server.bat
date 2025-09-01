@echo off
echo.
echo ===============================================
echo  ImageFlow Pro - Helyi Halozati Szerver
echo ===============================================
echo.
echo Szerver indítása...
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if errorlevel 1 (
    echo HIBA: Node.js nincs telepítve!
    echo Kérjük telepítse a Node.js-t: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Check if required packages are installed
if not exist "node_modules\ws" (
    echo Szükséges csomagok telepítése...
    npm install ws
    if errorlevel 1 (
        echo HIBA: npm telepítés sikertelen!
        pause
        exit /b 1
    )
)

echo.
echo ===============================================
echo  FONTOS INFORMÁCIÓK:
echo ===============================================
echo.
echo • A szerver a helyi WiFi hálózatán fog működni
echo • Más eszközök ugyanazon a WiFi-n tudnak csatlakozni
echo • A QR kódot használva egyszerűen csatlakozhatnak
echo • A szerver leállításához nyomjon Ctrl+C-t
echo.
echo ===============================================
echo.

REM Start the local server
node local-server.js

echo.
echo Szerver leállítva.
pause