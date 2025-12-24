from datetime import datetime, timedelta
from passlib.context import CryptContext
import bcrypt
from jose import jwt
from fastapi import HTTPException, status
from .config import settings

# Use bcrypt directly to avoid passlib initialization issues
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
    
    # Use bcrypt directly to hash the password
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')

def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against a hash."""
    # Ensure password is a string
    if not isinstance(password, str):
        password = str(password)
    
    # Bcrypt limit is 72 bytes, truncate if necessary
    password_bytes = password.encode('utf-8')
    if len(password_bytes) > 72:
        password_bytes = password_bytes[:72]
    
    # Use bcrypt directly to verify
    return bcrypt.checkpw(password_bytes, password_hash.encode('utf-8'))

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

