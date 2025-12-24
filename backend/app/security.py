from datetime import datetime, timedelta
from passlib.context import CryptContext
from jose import jwt
from fastapi import HTTPException, status
from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)
ALGORITHM = "HS256"

def hash_password(password: str) -> str:
    """
    Hash a password using bcrypt.
    Bcrypt has a 72-byte limit, so we ensure the password is within that limit.
    """
    # Ensure password is a string
    if not isinstance(password, str):
        password = str(password)
    
    # Bcrypt limit is 72 bytes, truncate if necessary
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
        password = password_bytes.decode('utf-8', errors='ignore')
    
    try:
        return pwd_context.hash(password)
    except ValueError as e:
        # If there's still an error, try with explicit encoding handling
        if "72 bytes" in str(e):
            # Fallback: use first 72 bytes
            password = password_bytes[:72].decode('utf-8', errors='ignore')
            return pwd_context.hash(password)
        raise

def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)

def create_access_token(subject: str, expires_minutes: int | None = None) -> str:
    expire = datetime.utcnow() + timedelta(
        minutes=expires_minutes or settings.ACCESS_TOKEN_EXPIRE_MINUTES
    )
    payload = {"sub": subject, "exp": expire}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> str:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("sub")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

