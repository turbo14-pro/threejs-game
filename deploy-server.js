#!/usr/bin/env node
/**
 * Production Server Deployment Script
 * 
 * This script helps deploy the game server to a production environment.
 * It can be used with PM2, systemd, or Docker.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const SERVER_FILE = 'server/ws-server.js';
const SERVER_PORT = process.env.PORT || 9208;

console.log('🚀 Food Frenzy Production Server Deployment');
console.log('===========================================\n');

// Check if server file exists
if (!fs.existsSync(SERVER_FILE)) {
    console.error(`❌ Server file not found: ${SERVER_FILE}`);
    process.exit(1);
}

console.log(`📋 Server file: ${SERVER_FILE}`);
console.log(`🔌 Port: ${SERVER_PORT}`);
console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}\n`);

// Option 1: Run with PM2 (recommended for production)
function deployWithPM2() {
    console.log('📦 Deploying with PM2...');
    
    const pm2Config = {
        name: 'food-frenzy-server',
        script: SERVER_FILE,
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '500M',
        env: {
            NODE_ENV: 'production',
            PORT: SERVER_PORT
        },
        error_file: 'logs/server-error.log',
        out_file: 'logs/server-out.log',
        log_file: 'logs/server-combined.log',
        time: true
    };
    
    // Write PM2 ecosystem file
    const ecosystemConfig = {
        apps: [pm2Config]
    };
    
    fs.writeFileSync('ecosystem.config.js', `module.exports = ${JSON.stringify(ecosystemConfig, null, 2)};`);
    console.log('✅ Created ecosystem.config.js');
    
    // Start with PM2
    const pm2 = spawn('pm2', ['start', 'ecosystem.config.js'], { stdio: 'inherit' });
    
    pm2.on('close', (code) => {
        if (code === 0) {
            console.log('\n✅ Server started with PM2!');
            console.log('📋 Useful commands:');
            console.log('   pm2 status          - Check server status');
            console.log('   pm2 logs            - View logs');
            console.log('   pm2 restart all     - Restart server');
            console.log('   pm2 stop all        - Stop server');
            console.log('   pm2 monit           - Monitor resources');
        } else {
            console.error('\n❌ PM2 deployment failed');
        }
    });
}

// Option 2: Run directly (for testing)
function runDirectly() {
    console.log('▶️  Starting server directly...');
    
    const server = spawn('node', [SERVER_FILE], {
        env: { ...process.env, NODE_ENV: 'production', PORT: String(SERVER_PORT) },
        stdio: 'inherit'
    });
    
    server.on('close', (code) => {
        console.log(`\n🛑 Server exited with code ${code}`);
    });
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\n🛑 Shutting down...');
        server.kill('SIGINT');
    });
    
    process.on('SIGTERM', () => {
        console.log('\n🛑 Shutting down...');
        server.kill('SIGTERM');
    });
}

// Option 3: Generate systemd service file
function generateSystemdService() {
    const serviceContent = `[Unit]
Description=Food Frenzy Game Server
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/food-frenzy
ExecStart=/usr/bin/node ${SERVER_FILE}
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=${SERVER_PORT}
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=food-frenzy-server

[Install]
WantedBy=multi-user.target
`;
    
    fs.writeFileSync('food-frenzy-server.service', serviceContent);
    console.log('✅ Created food-frenzy-server.service');
    console.log('\n📋 To install as systemd service:');
    console.log('   sudo cp food-frenzy-server.service /etc/systemd/system/');
    console.log('   sudo systemctl daemon-reload');
    console.log('   sudo systemctl enable food-frenzy-server');
    console.log('   sudo systemctl start food-frenzy-server');
    console.log('   sudo systemctl status food-frenzy-server');
}

// Option 4: Generate Dockerfile
function generateDockerfile() {
    const dockerfileContent = `# Food Frenzy Game Server Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy server files
COPY server/ ./server/
COPY src/utils/ ./src/utils/
COPY src/config/ ./src/config/
COPY src/data/ ./src/data/

# Expose port
EXPOSE ${SERVER_PORT}

# Start server
CMD ["node", "server/ws-server.js"]
`;
    
    fs.writeFileSync('Dockerfile.server', dockerfileContent);
    console.log('✅ Created Dockerfile.server');
    console.log('\n📋 To build and run with Docker:');
    console.log('   docker build -f Dockerfile.server -t food-frenzy-server .');
    console.log('   docker run -d -p 9208:9208 --name food-frenzy-server food-frenzy-server');
}

// Main deployment logic
const deployMethod = process.argv[2] || 'direct';

switch (deployMethod) {
    case 'pm2':
        deployWithPM2();
        break;
    case 'systemd':
        generateSystemdService();
        break;
    case 'docker':
        generateDockerfile();
        break;
    case 'direct':
    default:
        runDirectly();
        break;
}

console.log('\n📚 Deployment Options:');
console.log('   node deploy-server.js direct   - Run directly (default)');
console.log('   node deploy-server.js pm2      - Deploy with PM2');
console.log('   node deploy-server.js systemd  - Generate systemd service file');
console.log('   node deploy-server.js docker   - Generate Dockerfile');