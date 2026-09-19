/**
 * PostgreSQL Connection Test Script
 * 
 * Tests connection to Neon PostgreSQL and verifies basic operations.
 * 
 * Usage: node scripts/test-pg.js
 */

import { createRequire } from 'node:module'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Driver dep (pg) lives in server/node_modules, which is NOT on the
// module-resolution path for files under scripts/. Resolve via the default
// scope first, then fall back to a require anchored at server/package.json.
// Connection test only — this script performs no writes.
function loadPg() {
  try {
    return createRequire(import.meta.url)('pg')
  } catch {
    return createRequire(join(__dirname, '..', 'server', 'package.json'))('pg')
  }
}
const pg = loadPg()

const DATABASE_URL = process.env.DATABASE_URL
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set')
  process.exit(1)
}

const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 5,
})

async function testConnection() {
  console.log('Testing PostgreSQL connection...')
  
  try {
    // Test basic connection
    const client = await pool.connect()
    console.log('✓ Connected to PostgreSQL')
    
    // Test query
    const { rows } = await client.query('SELECT NOW() as time')
    console.log(`✓ Server time: ${rows[0].time}`)
    
    // Test version
    const { rows: versionRows } = await client.query('SELECT version()')
    console.log(`✓ Version: ${versionRows[0].version}`)
    
    client.release()
    
    // Test pool
    console.log('\nTesting connection pool...')
    const poolStats = {
      totalCount: pool.totalCount,
      idleCount: pool.idleCount,
      waitingCount: pool.waitingCount,
    }
    console.log(`✓ Pool stats: ${JSON.stringify(poolStats)}`)
    
    console.log('\n✓ All tests passed')
  } catch (err) {
    console.error('✗ Connection test failed:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

testConnection()
