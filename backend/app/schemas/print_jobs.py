from pydantic import BaseModel, Field
from typing import Optional, Literal


class PrintJobCreate(BaseModel):
    kind: Literal["raw"] = "raw"
    text: str
    encoding: str = "cp950"
    copies: int = Field(default=1, ge=1, le=20)


class PrintJobOut(BaseModel):
    id: str
    kind: str
    text: str
    encoding: str
    copies: int


class PrintAckIn(BaseModel):
    ok: bool
    message: str = ""

