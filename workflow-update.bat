@echo off
chcp 65001 >nul
echo ========================================
echo   WORKFLOW DE MISE A JOUR
echo   Branche - Merge - Push
echo ========================================
echo.

:: Vérifier qu'on est dans un dépôt Git
git rev-parse --git-dir >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERREUR: Ce n'est pas un depot Git!
    echo Initialisation du depot Git...
    git init
    echo Depot Git initialise.
    echo.
)

:: Afficher la branche actuelle
echo Branche actuelle:
git branch --show-current
echo.

:: Vérifier s'il y a des changements non commités
git diff --quiet
if %ERRORLEVEL% NEQ 0 (
    echo ATTENTION: Il y a des changements non commites!
    echo.
    set /p COMMIT_CHANGES="Voulez-vous les commiter avant de creer la branche? (o/n): "
    if /i "%COMMIT_CHANGES%"=="o" (
        git add .
        set /p COMMIT_MSG="Message de commit: "
        git commit -m "%COMMIT_MSG%"
        echo Changements commites.
        echo.
    )
)

:: Vérifier qu'on est sur main ou master
git branch --show-current | findstr /C:"main" /C:"master" >nul
if %ERRORLEVEL% NEQ 0 (
    echo ATTENTION: Vous n'etes pas sur la branche main/master!
    echo Branche actuelle:
    git branch --show-current
    echo.
    set /p SWITCH_BRANCH="Voulez-vous basculer sur main? (o/n): "
    if /i "%SWITCH_BRANCH%"=="o" (
        git checkout main 2>nul || git checkout master
        echo Bascule sur main/master.
        echo.
    )
)

:: Créer et basculer sur la nouvelle branche
echo [ETAPE 1/3] Creation de la branche update/maj...
git checkout -b update/maj
if %ERRORLEVEL% NEQ 0 (
    echo La branche existe deja. Basculement sur update/maj...
    git checkout update/maj
)
echo Branche update/maj creee et activee!
echo.

echo ========================================
echo   Vous pouvez maintenant travailler sur la mise a jour
echo   Branche: update/maj
echo ========================================
echo.
echo Quand vous aurez termine, executez: workflow-merge-push.bat
echo.

pause

