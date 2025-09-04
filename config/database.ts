import mysql from 'mysql2/promise';

// Parse DATABASE_URL for Railway deployment
function parseDatabaseUrl() {
  const databaseUrl = process.env.DATABASE_URL || process.env.MYSQL_URL || process.env.MYSQL_PUBLIC_URL;
  
  if (databaseUrl) {
    try {
      const url = new URL(databaseUrl);
      return {
        host: url.hostname,
        port: parseInt(url.port) || 3306,
        user: url.username,
        password: url.password,
        database: url.pathname.slice(1), // Remove leading slash
      };
    } catch (error) {
      console.error('Error parsing DATABASE_URL:', error);
    }
  }
  
  // Fallback to individual environment variables for local development
  return {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'islamic_db',
  };
}

const parsedConfig = parseDatabaseUrl();

// Database configuration
export const dbConfig = {
  ...parsedConfig,
  charset: 'utf8mb4',
  timezone: '+00:00',
  connectionLimit: 10,
  queueLimit: 5,
  acquireTimeout: 10000,
  timeout: 10000,
  reconnect: true,
  idleTimeout: 300000,
  maxIdle: 3,
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test connection function
export async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log(
      `✅ Database connected: mysql://${dbConfig.user}@${dbConfig.host}:${dbConfig.port}/${dbConfig.database}`
    );
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// Initialize connection test
testConnection();

export default pool;

// Helper function to execute queries
export async function executeQuery<T = any>(
  query: string, 
  params: any[] = []
): Promise<T[]> {
  try {
    const [rows] = await pool.execute(query, params);
    
    if (!rows) {
      return [];
    }
    
    if (!Array.isArray(rows)) {
      return [rows] as T[];
    }
    
    return rows as T[];
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Helper function to execute single row queries
export async function executeQuerySingle<T = any>(
  query: string, 
  params: any[] = []
): Promise<T | null> {
  try {
    const [rows] = await pool.execute(query, params);
    const results = rows as T[];
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

// Helper function to execute insert/update/delete
export async function executeUpdate(
  query: string, 
  params: any[] = []
): Promise<{ affectedRows: number; insertId?: number }> {
  try {
    const [result] = await pool.execute(query, params);
    return result as any;
  } catch (error) {
    console.error('Database update error:', error);
    throw error;
  }
}
