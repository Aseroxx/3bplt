@echo off
chcp 65001 >nul
echo ========================================
echo   MERGE ET PUSH DE LA MISE A JOUR
echo ========================================
echo.

:: Vérifier qu'on est dans un dépôt Git
git rev-parse --git-dir >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERREUR: Ce n'est pas un depot Git!
    pause
    exit /b 1
)

:: Vérifier qu'on est sur la branche update/maj
git branch --show-current | findstr /C:"update/maj" >nul
if %ERRORLEVEL% NEQ 0 (
    echo ATTENTION: Vous n'etes pas sur la branche update/maj!
    echo Branche actuelle:
    git branch --show-current
    echo.
    set /p SWITCH_BRANCH="Voulez-vous basculer sur update/maj? (o/n): "
    if /i "%SWITCH_BRANCH%"=="o" (
        git checkout update/maj
    ) else (
        echo Operation annulee.
        pause
        exit /b 1
    )
)

:: Vérifier s'il y a des changements non commités
git diff --quiet
if %ERRORLEVEL% NEQ 0 (
    echo Il y a des changements non commites!
    echo.
    set /p COMMIT_CHANGES="Voulez-vous les commiter? (o/n): "
    if /i "%COMMIT_CHANGES%"=="o" (
        git add .
        set /p COMMIT_MSG="Message de commit: "
        git commit -m "%COMMIT_MSG%"
        echo Changements commites.
        echo.
    ) else (
        echo Operation annulee. Veuillez commiter vos changements d'abord.
        pause
        exit /b 1
    )
)

:: Afficher les commits de la branche
echo.
echo Commits sur update/maj qui ne sont pas sur main/master:
git log main..update/maj --oneline 2>nul || git log master..update/maj --oneline
echo.

:: [ÉTAPE 1] Basculer sur main/master
echo [ETAPE 1/3] Basculement sur main/master...
git checkout main 2>nul || git checkout master
if %ERRORLEVEL% NEQ 0 (
    echo ERREUR: Impossible de basculer sur main/master!
    pause
    exit /b 1
)
echo OK - Sur main/master
echo.

:: [ÉTAPE 2] Merge de update/maj dans main/master
echo [ETAPE 2/3] Merge de update/maj dans main/master...
git merge update/maj --no-ff -m "Merge update/maj: Mise a jour du site"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo ATTENTION: Il y a des conflits de merge!
    echo Veuillez les resoudre manuellement, puis:
    echo   1. git add .
    echo   2. git commit
    echo   3. Relancez ce script
    pause
    exit /b 1
)
echo OK - Merge reussi!
echo.

:: [ÉTAPE 3] Push vers le remote
echo [ETAPE 3/3] Push vers le depot distant...
echo.
set /p PUSH_CONFIRM="Voulez-vous pousser vers le remote? (o/n): "
if /i "%PUSH_CONFIRM%"=="o" (
    git push origin main 2>nul || git push origin master
    if %ERRORLEVEL% EQU 0 (
        echo.
        echo Push de la branche principale reussi!
        echo.
        set /p PUSH_BRANCH="Voulez-vous aussi pousser la branche update/maj? (o/n): "
        if /i "%PUSH_BRANCH%"=="o" (
            git push origin update/maj
        )
    ) else (
        echo ERREUR lors du push. Verifiez votre connexion et les permissions.
    )
) else (
    echo Push annule.
)

echo.
echo ========================================
echo   WORKFLOW TERMINE!
echo ========================================
echo.
echo Vous etes maintenant sur: 
git branch --show-current
echo.

pause

