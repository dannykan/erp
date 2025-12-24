from datetime import date

def bucket_expr_sqlite(bucket: str) -> str:
    # 你目前多半用 sqlite/dev；若你是 Postgres 之後我再給 PG 版
    if bucket == "day":
        return "strftime('%Y-%m-%d', report_date)"
    if bucket == "week":
        # 年-週（週一為一週起點的簡化做法）
        return "strftime('%Y-W%W', report_date)"
    if bucket == "month":
        return "strftime('%Y-%m', report_date)"
    if bucket == "year":
        return "strftime('%Y', report_date)"
    raise ValueError("invalid bucket")

