"""Restore the exact OpenNGC snapshot used by this planner (CC BY-SA 4.0)."""
import hashlib
import pathlib
import urllib.request

URL = "https://raw.githubusercontent.com/mattiaverga/OpenNGC/da90466031b0372c896588b85be6016c617e205b/database_files/NGC.csv"
SHA256 = "be150bdaa1997dacbcb39f303074403edec7a953b589b36d5f1c4522c0cc6fae"
TARGET = pathlib.Path(__file__).resolve().parents[1] / "data" / "OpenNGC.csv"

def restore(target=TARGET):
    if target.exists():
        if hashlib.sha256(target.read_bytes()).hexdigest() != SHA256:
            raise ValueError("Existing OpenNGC.csv differs from the pinned snapshot; it was not changed.")
        return target
    with urllib.request.urlopen(URL, timeout=60) as response:
        data = response.read()
    if hashlib.sha256(data).hexdigest() != SHA256:
        raise ValueError("OpenNGC checksum mismatch; nothing was saved.")
    target.parent.mkdir(parents=True, exist_ok=True)
    temporary = target.with_suffix(".csv.tmp")
    temporary.write_bytes(data)
    temporary.replace(target)
    return target

if __name__ == "__main__":
    print(restore())
