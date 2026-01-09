from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Response, Header
from sqlalchemy.orm import Session
from sqlalchemy import select, or_

from app.schemas.print_jobs import PrintJobCreate, PrintJobOut, PrintAckIn
from app.models.print_job import PrintJob
from app.db import get_db
from app.config import settings

router = APIRouter(prefix="/print-jobs", tags=["print-jobs"])

# ===== 簡單 Token 驗證 =====
def require_agent(auth: str | None):
    if not auth or not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = auth.split(" ", 1)[1].strip()
    if token != settings.PRINT_AGENT_TOKEN:
        raise HTTPException(status_code=403, detail="Invalid token")


# ===== (A) 建立任務：給你雲端任意 API 呼叫用 =====
@router.post("", response_model=dict)
def create_print_job(payload: PrintJobCreate, db: Session = Depends(get_db)):
    job = PrintJob(
        kind=payload.kind,
        text=payload.text,
        encoding=payload.encoding,
        copies=payload.copies,
        status="queued",
    )
    db.add(job)
    db.commit()
    return {"id": job.id, "status": job.status}


# ===== (B) Windows Agent 拉任務 =====
@router.get("/next", response_model=PrintJobOut)
def get_next_job(
    response: Response,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
    x_agent_id: str | None = Header(default="win-agent"),
):
    require_agent(authorization)

    # 允許撿回卡住的 processing（例如 Agent 當機）
    lock_timeout = datetime.utcnow() - timedelta(minutes=5)

    # 1) 先找 queued
    job = db.execute(
        select(PrintJob).where(PrintJob.status == "queued").order_by(PrintJob.created_at.asc()).limit(1)
    ).scalar_one_or_none()

    # 2) 找不到就找 lock 過久的 processing
    if not job:
        job = db.execute(
            select(PrintJob)
            .where(PrintJob.status == "processing")
            .where(or_(PrintJob.locked_at.is_(None), PrintJob.locked_at < lock_timeout))
            .order_by(PrintJob.created_at.asc())
            .limit(1)
        ).scalar_one_or_none()

    if not job:
        response.status_code = 204
        return  # type: ignore

    job.status = "processing"
    job.locked_at = datetime.utcnow()
    job.locked_by = x_agent_id
    db.add(job)
    db.commit()

    return PrintJobOut(
        id=job.id,
        kind=job.kind,
        text=job.text,
        encoding=job.encoding,
        copies=job.copies,
    )


# ===== (C) Agent 回報結果 =====
@router.post("/{job_id}/ack", response_model=dict)
def ack_job(
    job_id: str,
    payload: PrintAckIn,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    require_agent(authorization)

    job = db.query(PrintJob).filter(PrintJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.ack_at = datetime.utcnow()
    job.ack_message = payload.message

    if payload.ok:
        job.status = "done"
    else:
        job.status = "failed"

    db.add(job)
    db.commit()
    return {"id": job.id, "status": job.status}

