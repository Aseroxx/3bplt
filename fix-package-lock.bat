@echo off
chcp 65001 >nul
echo ========================================
echo   REGENERATION DU PACKAGE-LOCK.JSON
echo ========================================
echo.

echo [ETAPE 1/2] Suppression de l'ancien package-lock.json...
cd client
if exist package-lock.json (
    del package-lock.json
    echo ✅ Ancien package-lock.json supprime
) else (
    echo ⚠️  package-lock.json n'existe pas
)

echo.
echo [ETAPE 2/2] Regeneration du package-lock.json...
npm install
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ✅ package-lock.json regenere avec succes!
) else (
    echo.
    echo ❌ Erreur lors de la regeneration
)

cd ..
echo.
pause

