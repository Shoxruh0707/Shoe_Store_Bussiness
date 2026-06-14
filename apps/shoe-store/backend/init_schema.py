import re
from pathlib import Path

from app import get_connection


ROOT = Path(__file__).resolve().parent.parent
SCHEMA_FILE = ROOT / "shoe_store_schema.sql"


def clean_schema(sql):
    sql = re.sub(r"CREATE\s+DATABASE\s+IF\s+NOT\s+EXISTS\s+[^;]+;", "", sql, flags=re.I)
    sql = re.sub(r"USE\s+[^;]+;", "", sql, flags=re.I)
    return sql


def statements(sql):
    for statement in sql.split(";"):
        statement = statement.strip()
        if statement:
            yield statement


def main():
    sql = clean_schema(SCHEMA_FILE.read_text(encoding="utf-8"))

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT DATABASE()")
        database = cursor.fetchone()[0]

        for statement in statements(sql):
            cursor.execute(statement)

        conn.commit()
        cursor.execute("SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall()]

    print(f"Initialized database: {database}")
    print("Tables:")
    for table in tables:
        print(f"- {table}")


if __name__ == "__main__":
    main()
