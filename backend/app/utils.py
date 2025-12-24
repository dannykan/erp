from datetime import datetime

def make_no(prefix: str) -> str:
    today = datetime.now().strftime("%Y%m%d")
    return f"{prefix}-{today}"

