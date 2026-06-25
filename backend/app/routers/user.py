from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.schemas.user import UserCreate, UserLogin
from app.models.user import User
from app.database.session import get_db
from app.utils.security import (
    hash_password,
    verify_password,
    create_access_token,
    verify_token
)

router = APIRouter()

oauth2_scheme = HTTPBearer()


# ---------------- REGISTER ---------------- #

@router.post("/register")
def register(user: UserCreate, db: Session = Depends(get_db)):

    existing_user = db.query(User).filter(
        User.email == user.email
    ).first()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )

    new_user = User(
        name=user.name,
        email=user.email,
        password=hash_password(user.password),
        role=user.role
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return {"message": "User registered successfully"}


# ---------------- LOGIN (FIXED) ---------------- #

@router.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):

    db_user = db.query(User).filter(
        User.email == user.email
    ).first()

    if not db_user or not verify_password(user.password, db_user.password):
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials"
        )

    token = create_access_token({
        "sub": db_user.email,
        "role": db_user.role,
        "company_id": db_user.company_id
    })

    return {
        "access_token": token,
        "token_type": "bearer"
    }


# ---------------- ME ---------------- #

@router.get("/me")
def get_me(
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme)
):

    token = credentials.credentials
    payload = verify_token(token)

    return {
        "email": payload.get("sub"),
        "role": payload.get("role"),
        "company_id": payload.get("company_id")
    }