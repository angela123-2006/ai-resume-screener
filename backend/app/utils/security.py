import bcrypt
from jose import jwt, JWTError, ExpiredSignatureError
from datetime import datetime, timedelta
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import os

SECRET_KEY = os.getenv("SECRET_KEY", "dev_secret_key")
ALGORITHM = "HS256"

oauth2_scheme = HTTPBearer()


# ---------------- PASSWORD ---------------- #

def hash_password(password: str) -> str:
    return bcrypt.hashpw(
        password.encode("utf-8"),
        bcrypt.gensalt()
    ).decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return bcrypt.checkpw(
        plain_password.encode("utf-8"),
        hashed_password.encode("utf-8")
    )


# ---------------- JWT ---------------- #

def create_access_token(data: dict, expires_minutes: int = 30):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    to_encode.update({
        "exp": expire,
        "iat": datetime.utcnow()
    })
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload

    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token expired"
        )

    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )


# ---------------- ROLE GUARD ---------------- #

def get_current_user_payload(
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme)
):
    return verify_token(credentials.credentials)


def require_role(required_role: str):
    """
    Reusable role guard — use as a dependency on any endpoint.
    Example: current_user = Depends(require_role("recruiter"))
    """
    def role_checker(
        credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme)
    ):
        payload = verify_token(credentials.credentials)
        role = payload.get("role")

        if role != required_role:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role: {required_role}. Your role: {role}"
            )
        return payload

    return role_checker