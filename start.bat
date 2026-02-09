@echo off
echo ========================================
echo   Photo Album - Local Server
echo ========================================
echo.
echo Open http://localhost:5500 in browser
echo Press Ctrl+C to stop
echo.

cd /d "%~dp0"
npx -y serve . -p 5500
pause
