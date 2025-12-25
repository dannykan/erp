from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from .db import get_db, engine, Base
from .deps import get_current_user, require_roles
from .models import User, Role
from .schemas import UserIn, UserOut
from .security import hash_password

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

    # 确保 display_name 不为空
    display_name = payload.display_name.strip() if payload.display_name else payload.username
    
    # 验证 role 值
    try:
        user_role = Role(payload.role) if payload.role else Role.worker
    except ValueError:
        raise HTTPException(400, f"Invalid role: {payload.role}")

    pwd = payload.password or "123456"
    u = User(
        username=payload.username,
        display_name=display_name,
        role=user_role,
        is_active=payload.is_active if payload.is_active is not None else True,
        password_hash=hash_password(pwd),
    )
    db.add(u)
    try:
        db.commit()
        db.refresh(u)
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to create user: {str(e)}")
    
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

    # 确保 display_name 不为空
    if payload.display_name:
        u.display_name = payload.display_name.strip() or u.display_name
    
    # 验证 role 值
    if payload.role:
        try:
            u.role = Role(payload.role)
        except ValueError:
            raise HTTPException(400, f"Invalid role: {payload.role}")
    
    if payload.is_active is not None:
        u.is_active = payload.is_active

    if payload.password:
        u.password_hash = hash_password(payload.password)

    try:
        db.commit()
        db.refresh(u)
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to update user: {str(e)}")
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

