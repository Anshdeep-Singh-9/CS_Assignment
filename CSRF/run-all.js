/**
 * Launcher Script for CSRF Lab Demonstration
 * Spawns all three services concurrently:
 *  1. Express Backend  on http://localhost:5000
 *  2. Banking Frontend on http://localhost:3000
 *  3. Shopping App     on http://localhost:4000
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('============================================================');
console.log('  STARTING CSRF DEMONSTRATION ENVIRONMENT (REACT + EXPRESS)');
console.log('============================================================');

// 1. Backend API (Port 5000)
console.log(' Starting Backend API on http://localhost:5000...');
const backend = spawn('node', ['server.js'], {
  cwd: path.join(__dirname, 'backend'),
  stdio: 'inherit'
});

// 2. Banking Frontend (Port 3000)
console.log(' Starting Banking Frontend on http://localhost:3000...');
const banking = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, 'banking-app'),
  stdio: 'inherit'
});

// 3. Shopping Frontend (Port 4000)
console.log(' Starting Shopping Website on http://localhost:4000...');
const shopping = spawn('npm', ['run', 'dev'], {
  cwd: path.join(__dirname, 'shopping-app'),
  stdio: 'inherit'
});

// Handle graceful termination
const cleanup = () => {
  console.log('\nShutting down all demonstration servers...');
  backend.kill('SIGINT');
  banking.kill('SIGINT');
  shopping.kill('SIGINT');
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
