from pathlib import Path

from app import get_connection


ROOT = Path(__file__).resolve().parent.parent
SEED_FILE = ROOT / "shoe_store_seed_data.sql"


def statements(sql):
    for statement in sql.split(";"):
        statement = statement.strip()
        if statement:
            yield statement


def main():
    sql = SEED_FILE.read_text(encoding="utf-8")

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT DATABASE()")
        database = cursor.fetchone()[0]

        for statement in statements(sql):
            cursor.execute(statement)

        conn.commit()

    print(f"Seeded reference data into: {database}")


if __name__ == "__main__":
    main()
