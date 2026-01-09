import uuid
from datetime import datetime
from sqlalchemy import Column, String, DateTime, Integer, Text
from app.db import Base


def generate_job_id():
    return f"job_{uuid.uuid4().hex}"


class PrintJob(Base):
    __tablename__ = "print_jobs"

    id = Column(String(64), primary_key=True, default=generate_job_id)
    kind = Column(String(16), nullable=False, default="raw")      # 先支援 raw
    text = Column(Text, nullable=False)
    encoding = Column(String(32), nullable=False, default="cp950")
    copies = Column(Integer, nullable=False, default=1)

    status = Column(String(16), nullable=False, default="queued")  # queued|processing|done|failed
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    locked_at = Column(DateTime, nullable=True)
    locked_by = Column(String(128), nullable=True)
    ack_at = Column(DateTime, nullable=True)
    ack_message = Column(Text, nullable=True)

