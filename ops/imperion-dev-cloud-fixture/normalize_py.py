"""Public synthetic arithmetic fixture. Never production prices."""

def total(items):
    return sum(row["price"] for row in items)
