from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from passlib.hash import bcrypt

from .db import get_db, engine, Base
from .deps import get_current_user, require_roles
from .models import User, Role
from .schemas import UserIn, UserOut

router = APIRouter(prefix="/users", tags=["users"])

@router.get("", response_model=list[UserOut])
def list_users(
    q: str | None = None,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.supervisor)),
):
    Base.metadata.create_all(bind=engine)
    qry = db.query(User).order_by(desc(User.id))
    if q:
        qry = qry.filter((User.username.contains(q)) | (User.display_name.contains(q)))
    users = qry.limit(500).all()
    # 手动转换 Role enum 为 str，并确保 display_name 存在
    return [
        UserOut(
            id=u.id,
            username=u.username,
            display_name=getattr(u, "display_name", u.username) or u.username,
            role=u.role.value if hasattr(u.role, "value") else str(u.role),
            is_active=u.is_active,
            created_at=u.created_at,
        )
        for u in users
    ]

@router.post("", response_model=UserOut)
def create_user(
    payload: UserIn,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.supervisor)),
):
    Base.metadata.create_all(bind=engine)
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(400, "username exists")

    pwd = payload.password or "123456"
    u = User(
        username=payload.username,
        display_name=payload.display_name,
        role=Role(payload.role) if payload.role else Role.worker,
        is_active=payload.is_active,
        password_hash=bcrypt.hash(pwd),
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return UserOut(
        id=u.id,
        username=u.username,
        display_name=u.display_name,
        role=u.role.value,
        is_active=u.is_active,
        created_at=u.created_at,
    )

@router.put("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    payload: UserIn,
    db: Session = Depends(get_db),
    user=Depends(require_roles(Role.admin, Role.supervisor)),
):
    Base.metadata.create_all(bind=engine)
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(404, "user not found")

    # username 若變更要檢查唯一
    if payload.username != u.username:
        if db.query(User).filter(User.username == payload.username).first():
            raise HTTPException(400, "username exists")
        u.username = payload.username

    u.display_name = payload.display_name
    u.role = Role(payload.role) if payload.role else u.role
    u.is_active = payload.is_active

    if payload.password:
        u.password_hash = bcrypt.hash(payload.password)

    db.commit()
    db.refresh(u)
    return UserOut(
        id=u.id,
        username=u.username,
        display_name=u.display_name,
        role=u.role.value,
        is_active=u.is_active,
        created_at=u.created_at,
    )

@router.get("/idmap")
def user_id_map(
    db: Session = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    給前端快速把 user_id -> display_name
    """
    Base.metadata.create_all(bind=engine)
    rows = db.query(User.id, User.display_name).filter(User.is_active == True).all()
    return {str(uid): name for uid, name in rows}

