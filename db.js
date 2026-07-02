// ============================================================
// N2M SLA - Conexao MySQL com Pool
// ============================================================

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'n2m.lupus.intranet',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'recebimento',
  password: process.env.DB_PASSWORD || 'm2bab',
  database: process.env.DB_NAME || 'bdsi08common',
  waitForConnections: true,
  connectionLimit: 10,
  maxIdle: 10,
  idleTimeout: 60000,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  dateStrings: true
  // REMOVIDO: acquireTimeout, timeout (nao suportados nesta versao do mysql2)
});

async function query(sql, params = []) {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    console.error('Database query error:', error);
    throw error;
  }
}

async function testConnection() {
  try {
    // Usar SELECT 1 em vez de SELECT NOW() para compatibilidade
    const [result] = await pool.execute('SELECT 1 as ok');
    console.log('✅ MySQL conectado com sucesso!');
    return true;
  } catch (error) {
    console.error('❌ Erro ao conectar no MySQL:', error.message);
    console.error('   Verifique se voce esta na VPN/intranet da Lupus');
    return false;
  }
}

module.exports = { pool, query, testConnection };
