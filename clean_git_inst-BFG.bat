@echo off
chcp 65001 >nul
echo ========================================
echo   NETTOYAGE DU REPOSITORY GIT
echo   Suppression des fichiers volumineux
echo ========================================
echo.

:: Vérifier que Git est installé
where git >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Git n'est pas installé ou pas dans le PATH
    pause
    exit /b 1
)

:: Vérifier que Java est installé
where java >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Java n'est pas installé ou pas dans le PATH
    echo.
    echo Téléchargez Java depuis: https://www.java.com/download/
    pause
    exit /b 1
)

echo [1/6] Vérification de Java...
java -version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [ERREUR] Java n'est pas correctement installé
    pause
    exit /b 1
)
echo [OK] Java est installé
echo.

:: Créer le dossier temporaire pour BFG
set BFG_DIR=%TEMP%\bfg-cleaner
if not exist "%BFG_DIR%" mkdir "%BFG_DIR%"
set BFG_JAR=%BFG_DIR%\bfg.jar

echo [2/6] Téléchargement de BFG Repo-Cleaner...
if exist "%BFG_JAR%" (
    echo [INFO] BFG existe déjà, utilisation de la version existante
) else (
    echo Téléchargement en cours...
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar' -OutFile '%BFG_JAR%'}"
    if %ERRORLEVEL% NEQ 0 (
        echo [ERREUR] Échec du téléchargement de BFG
        echo Téléchargez manuellement depuis: https://rtyley.github.io/bfg-repo-cleaner/
        pause
        exit /b 1
    )
    echo [OK] BFG téléchargé
)
echo.

:: Vérifier que nous sommes dans un repo Git
if not exist ".git" (
    echo [ERREUR] Ce dossier n'est pas un repository Git
    pause
    exit /b 1
)

echo [3/6] Création d'une sauvegarde de sécurité...
set BACKUP_DIR=..\3BPLT2-backup-%date:~-4,4%%date:~-7,2%%date:~-10,2%-%time:~0,2%%time:~3,2%%time:~6,2%
set BACKUP_DIR=%BACKUP_DIR: =0%
echo Sauvegarde dans: %BACKUP_DIR%
xcopy /E /I /H /Y . "%BACKUP_DIR%\" >nul 2>&1
echo [OK] Sauvegarde créée
echo.

echo [4/6] Nettoyage du repository avec BFG...
echo Suppression de uploads/...
java -jar "%BFG_JAR%" --delete-folders uploads
if %ERRORLEVEL% NEQ 0 (
    echo [ATTENTION] Erreur lors de la suppression de uploads/
)

echo Suppression de node_modules/...
java -jar "%BFG_JAR%" --delete-folders node_modules
if %ERRORLEVEL% NEQ 0 (
    echo [ATTENTION] Erreur lors de la suppression de node_modules/
)

echo Suppression de client/node_modules/...
java -jar "%BFG_JAR%" --delete-folders "client/node_modules"
if %ERRORLEVEL% NEQ 0 (
    echo [ATTENTION] Erreur lors de la suppression de client/node_modules/
)

echo Suppression des fichiers .zip...
java -jar "%BFG_JAR%" --delete-files "*.zip"
if %ERRORLEVEL% NEQ 0 (
    echo [ATTENTION] Erreur lors de la suppression des .zip
)

echo Suppression des fichiers .rar...
java -jar "%BFG_JAR%" --delete-files "*.rar"
if %ERRORLEVEL% NEQ 0 (
    echo [ATTENTION] Erreur lors de la suppression des .rar
)

echo [OK] Nettoyage terminé
echo.

echo [5/6] Nettoyage de l'historique Git...
git reflog expire --expire=now --all
git gc --prune=now --aggressive
echo [OK] Historique nettoyé
echo.

echo [6/6] Vérification de la taille...
git count-objects -vH
echo.

echo ========================================
echo   NETTOYAGE TERMINÉ
echo ========================================
echo.
echo [IMPORTANT] Les fichiers suivants ont été supprimés de l'historique:
echo   - uploads/
echo   - node_modules/
echo   - client/node_modules/
echo   - *.zip
echo   - *.rar
echo.
echo [ÉTAPE SUIVANTE] Vous devez maintenant faire un force push
echo.
set /p PUSH="Voulez-vous faire un force push maintenant? (O/N): "
if /i "%PUSH%"=="O" (
    echo.
    echo Force push en cours...
    git push --force --all
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Push réussi!
    ) else (
        echo [ERREUR] Échec du push
        echo Vous pouvez le faire manuellement avec: git push --force --all
    )
) else (
    echo.
    echo Pour pousser les changements plus tard, exécutez:
    echo   git push --force --all
)

echo.
echo Sauvegarde créée dans: %BACKUP_DIR%
echo.
pause