"""Test connection to external databases."""

from typing import Optional, Tuple


def test_connection(db_type: str, host: str, port: int, username: str,
                    password: str, database_name: Optional[str] = None,
                    schema_name: Optional[str] = None,
                    charset: Optional[str] = "utf8",
                    connect_timeout_seconds: Optional[int] = 10) -> Tuple[bool, str]:
    """Return (success, message)."""
    timeout = connect_timeout_seconds or 10
    try:
        if db_type == "mysql":
            import pymysql
            conn = pymysql.connect(
                host=host, port=port, user=username, password=password,
                database=database_name or "",
                charset=charset or "utf8",
                connect_timeout=timeout,
            )
            conn.ping()
            conn.close()
            return True, "MySQL 连接成功"

        elif db_type == "postgresql":
            import psycopg2
            dsn = f"host={host} port={port} user={username} password={password} connect_timeout={timeout}"
            if database_name:
                dsn += f" dbname={database_name}"
            conn = psycopg2.connect(dsn)
            conn.close()
            return True, "PostgreSQL 连接成功"

        elif db_type == "sqlserver":
            import pyodbc
            conn_str = (
                f"DRIVER={{ODBC Driver 17 for SQL Server}};"
                f"SERVER={host},{port};"
                f"UID={username};PWD={password};"
                f"CONNECTION TIMEOUT={timeout};"
            )
            if database_name:
                conn_str += f"DATABASE={database_name};"
            conn = pyodbc.connect(conn_str, timeout=timeout)
            conn.close()
            return True, "SQL Server 连接成功"
        else:
            return False, f"不支持的数据库类型: {db_type}"
    except Exception as e:
        return False, f"连接失败: {str(e)}"
