@echo off
REM Email Automation System - Quick Start Script for Windows
REM This script helps you get the system up and running quickly

echo =========================================
echo Email Automation System - Quick Setup
echo =========================================
echo.

REM Check prerequisites
echo Checking prerequisites...

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo X Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/
    pause
    exit /b 1
)

where docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo X Docker is not installed. Please install Docker Desktop from https://docker.com/
    pause
    exit /b 1
)

echo + All prerequisites found!
echo.

REM Check if .env exists
if not exist ".env" (
    echo Creating .env file from template...
    copy .env.example .env >nul
    echo + .env file created!
    echo.
    echo WARNING: You need to configure your Gmail API credentials!
    echo.
    echo Please follow these steps:
    echo 1. Go to https://console.cloud.google.com/
    echo 2. Create a new project or select existing
    echo 3. Enable Gmail API
    echo 4. Create OAuth 2.0 credentials
    echo 5. Add redirect URI: http://localhost:3001/api/auth/gmail/callback
    echo 6. Copy your Client ID and Client Secret
    echo.
    echo Now edit the .env file with your credentials:
    echo   - GMAIL_CLIENT_ID=your-client-id
    echo   - GMAIL_CLIENT_SECRET=your-client-secret
    echo   - JWT_SECRET=change-to-random-string
    echo.
    notepad .env
    echo.
    pause
) else (
    echo + .env file already exists
)

echo.
echo Installing dependencies...
call npm install

echo.
echo Starting services with Docker...
docker-compose up -d

echo.
echo Waiting for services to be ready...
timeout /t 10 /nobreak >nul

REM Check if services are running
docker-compose ps | findstr "Up" >nul
if %ERRORLEVEL% EQU 0 (
    echo + Services are running!
) else (
    echo X Some services failed to start. Check logs with: docker-compose logs
    pause
    exit /b 1
)

echo.
echo =========================================
echo Setup Complete!
echo =========================================
echo.
echo Your Email Automation System is now running!
echo.
echo Access the application:
echo   Frontend:  http://localhost:3000
echo   Backend:   http://localhost:3001
echo.
echo Next steps:
echo   1. Open http://localhost:3000 in your browser
echo   2. Register a new account
echo   3. Connect your Gmail account
echo   4. Create automation rules
echo   5. Watch orders get accepted automatically!
echo.
echo Useful commands:
echo   View logs:        docker-compose logs -f
echo   Stop services:    docker-compose down
echo   Restart services: docker-compose restart
echo.
echo For more information, see SETUP.md
echo.
pause
