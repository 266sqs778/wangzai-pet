@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "REPO=%~1"
if "%REPO%"=="" set /p "REPO=GitHub repo URL (https://github.com/USER/REPO.git): "
if "%REPO%"=="" (
  echo No repository URL provided. Nothing was pushed.
  pause
  exit /b 1
)

if not exist ".git" (
  echo Initialising local repository...
  git init
  git config user.name "dengdeng-pet"
  git config user.email "pet@localhost"
  git add -A
  git commit -m "Initial commit: desktop pet service (site, BAT/EXE packs, mini program, skill)"
)

git config user.name >nul 2>&1
if errorlevel 1 git config user.name "dengdeng-pet"
git config user.email >nul 2>&1
if errorlevel 1 git config user.email "pet@localhost"

git remote remove origin >nul 2>&1
git remote add origin "%REPO%"
git branch -M main
echo.
echo Pushing to %REPO% ...
git push -u origin main
if errorlevel 1 (
  echo.
  echo Push failed. Check the URL and sign in to GitHub when prompted, then run this again.
  echo If you use a token: https://USERNAME:TOKEN@github.com/USER/REPO.git
  pause
  exit /b 1
)
echo.
echo Done. Repository is live at %REPO%
pause
