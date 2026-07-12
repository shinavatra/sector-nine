import { Pool } from 'pg'
import dotenv from 'dotenv'

dotenv.config()

const connectionString = process.env.DATABASE_URL
if (!connectionString) {
  console.warn('⚠️  DATABASE_URL not set — database calls will fail. Check your .env file.')
}

export const pool = new Pool({
  connectionString,
  max: 20,              // max connections in pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Log connection errors so they don't silently fail
pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err.message)
})

export default pool
