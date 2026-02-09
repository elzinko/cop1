import { config } from 'dotenv';
import { resolve } from 'node:path';
import { createServer } from './server.js';

// Load environment variables
config();

const serverConfig = {
  port: parseInt(process.env.PORT ?? '3000', 10),
  host: process.env.HOST ?? '0.0.0.0',
  dbPath: process.env.DB_PATH ?? resolve(process.cwd(), 'cop1.db'),
};

console.log('🚀 Starting cop1 API...');
console.log(`📦 Database: ${serverConfig.dbPath}`);

try {
  const server = await createServer(serverConfig);
  console.log(`✅ cop1 API running on http://${serverConfig.host}:${serverConfig.port}`);
} catch (error) {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
}
