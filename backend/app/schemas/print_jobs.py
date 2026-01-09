from pydantic import BaseModel, Field
from typing import Optional, Literal


class PrintJobCreate(BaseModel):
    kind: Literal["raw", "image_text"] = "raw"
    text: str
    encoding: str = "cp950"  # raw 用，image_text 會忽略也沒關係
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

