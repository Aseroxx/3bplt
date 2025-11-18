@echo off
chcp 65001 >nul
echo ========================================
echo   DÉPLOIEMENT COMPLET SUR RAILWAY
echo   Backend + Frontend
echo ========================================
echo.

:: Vérifier Railway CLI
where railway >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo Installation de Railway CLI...
    npm install -g @railway/cli
)

echo.
echo [ÉTAPE 1/4] Connexion à Railway...
railway login

echo.
echo [ÉTAPE 2/4] Configuration du BACKEND...
echo.
railway init
railway add mysql

echo Configuration des variables backend...
railway variables set DB_HOST='${{MySQL.MYSQLHOST}}'
railway variables set DB_USER='${{MySQL.MYSQLUSER}}'
railway variables set DB_PASSWORD='${{MySQL.MYSQLPASSWORD}}'
railway variables set DB_NAME='${{MySQL.MYSQLDATABASE}}'
railway variables set JWT_SECRET=secret-jwt-123456789
railway variables set NODE_ENV=production
railway variables set PORT=10000

echo.
echo Déploiement du backend...
railway up

echo.
echo [IMPORTANT] Notez l'URL du backend:
railway domain
echo.
set /p BACKEND_URL="Copiez l'URL du backend ci-dessus et collez-la ici: "

echo.
echo [ÉTAPE 3/4] Configuration du FRONTEND...
echo.
cd client

railway init

echo Configuration de la variable frontend...
railway variables set REACT_APP_API_URL=%BACKEND_URL%

echo.
echo [ÉTAPE 4/4] Déploiement du frontend...
railway up

echo.
echo [TERMINÉ] Votre frontend est disponible à:
railway domain

echo.
cd ..
pause