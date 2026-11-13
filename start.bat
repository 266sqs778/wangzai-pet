@echo off
title Wangzai Pet Console
cd /d "%~dp0"

set "PY=D:\pythonSoftware\Python\python.exe"
if not exist "%PY%" set "PY=python"

"%PY%" -c "import tkinter,PIL,numpy" >nul 2>&1
if errorlevel 1 (
  echo.
  echo   [!] A Python with tkinter + Pillow + numpy is required.
  echo       Try:  python -m pip install pillow numpy
  echo.
  pause
  exit /b 1
)

echo Starting local console at http://127.0.0.1:8765 ...
echo (server.py will launch the desktop pet and open your browser)
start "Wangzai Pet Console" /min "%PY%" server.py
echo.
echo   Console is running. Close the minimized "Wangzai Pet Console"
echo   window to stop the server; right-click the pet to quit it.
echo.
