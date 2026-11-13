"""Public synthetic arithmetic fixture. Never production prices."""

def total(items):
    return sum(row["price"] * (row.get("qty", 0)) for row in items if row)
