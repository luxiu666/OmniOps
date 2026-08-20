import mysql from 'mysql2/promise';

export interface ConnectionParams{
    host:string
    port:number
    database: string
}

export async function withPool<T>(
    conn:ConnectionParams,
    fn:(pool:mysql.Pool) => Promise<T>,
): Promise<T> {
    const pool = mysql.createPool({
        host: conn.host,
        port: conn.port ?? 3306,
        user: process.env.MYSQL_USER ?? '',
        password: process.env.MYSQL_PASSWORD ?? '',
        database: conn.database ?? process.env.MYSQL_DATABASE,
        waitForConnections: true,
        connectionLimit: 2,
        connectTimeout: 5000,

    })
    try {
        return await fn(pool)
    } finally {
        await pool.end()
    }
}