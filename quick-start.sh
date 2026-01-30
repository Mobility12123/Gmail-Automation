#!/bin/bash

# Email Automation System - Quick Start Script
# This script helps you get the system up and running quickly

set -e

echo "========================================="
echo "Email Automation System - Quick Setup"
echo "========================================="
echo ""

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
    exit 1
fi

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker from https://docker.com/"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose"
    exit 1
fi

echo "✅ All prerequisites found!"
echo ""

# Check if .env exists
if [ ! -f ".env" ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "✅ .env file created!"
    echo ""
    echo "⚠️  IMPORTANT: You need to configure your Gmail API credentials!"
    echo ""
    echo "Please follow these steps:"
    echo "1. Go to https://console.cloud.google.com/"
    echo "2. Create a new project or select existing"
    echo "3. Enable Gmail API"
    echo "4. Create OAuth 2.0 credentials"
    echo "5. Add redirect URI: http://localhost:3001/api/auth/gmail/callback"
    echo "6. Copy your Client ID and Client Secret"
    echo ""
    echo "Now edit the .env file with your credentials:"
    echo "  - GMAIL_CLIENT_ID=your-client-id"
    echo "  - GMAIL_CLIENT_SECRET=your-client-secret"
    echo "  - JWT_SECRET=change-to-random-string"
    echo ""
    read -p "Press Enter when you've configured .env file..."
else
    echo "✅ .env file already exists"
fi

echo ""
echo "Installing dependencies..."
npm install

echo ""
echo "Starting services with Docker..."
docker-compose up -d

echo ""
echo "Waiting for services to be ready..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "Up"; then
    echo "✅ Services are running!"
else
    echo "❌ Some services failed to start. Check logs with: docker-compose logs"
    exit 1
fi

echo ""
echo "========================================="
echo "🎉 Setup Complete!"
echo "========================================="
echo ""
echo "Your Email Automation System is now running!"
echo ""
echo "Access the application:"
echo "  Frontend:  http://localhost:3000"
echo "  Backend:   http://localhost:3001"
echo ""
echo "Next steps:"
echo "  1. Open http://localhost:3000 in your browser"
echo "  2. Register a new account"
echo "  3. Connect your Gmail account"
echo "  4. Create automation rules"
echo "  5. Watch orders get accepted automatically!"
echo ""
echo "Useful commands:"
echo "  View logs:        docker-compose logs -f"
echo "  Stop services:    docker-compose down"
echo "  Restart services: docker-compose restart"
echo ""
echo "For more information, see SETUP.md"
echo ""
