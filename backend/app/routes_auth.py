from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .db import get_db, engine, Base
from .models import User, Role
from .schemas import LoginIn, Token, UserOut
from .security import verify_password, hash_password, create_access_token
from .deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post("/bootstrap-admin")
def bootstrap_admin(db: Session = Depends(get_db)):
    Base.metadata.create_all(bind=engine)
    existing = db.query(User).filter(User.username == "admin").first()
    if existing:
        # 如果存在但没有 display_name，更新它
        if not hasattr(existing, "display_name") or not existing.display_name:
            existing.display_name = "管理员"
            db.commit()
        return {"ok": True}
    u = User(
        username="admin",
        display_name="管理员",
        password_hash=hash_password("admin1234"),
        role=Role.admin,
    )
    db.add(u)
    db.commit()
    return {"ok": True, "username": "admin", "password": "admin1234"}

@router.post("/login", response_model=Token)
def login(payload: LoginIn, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == payload.username).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(401, "Bad credentials")
    return Token(access_token=create_access_token(user.username))

@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return UserOut(
        id=user.id,
        username=user.username,
        display_name=getattr(user, "display_name", user.username) or user.username,
        role=user.role.value if hasattr(user.role, "value") else str(user.role),
        is_active=user.is_active,
        created_at=user.created_at,
    )

