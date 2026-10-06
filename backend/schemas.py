from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict
from models import ConversationType, MessageStatus


class UserBase(BaseModel):
    username: str
    phone_number: Optional[str] = None
    display_name: str
    avatar_url: Optional[str] = None
    status_message: Optional[str] = None


class UserCreate(UserBase):
    pass


class UserOut(UserBase):
    id: int
    is_online: bool
    last_seen: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class LoginRequest(BaseModel):
    username_or_phone: str
    otp: Optional[str] = "123456"  # Mock OTP


class MessageBase(BaseModel):
    content: str


class MessageCreate(MessageBase):
    conversation_id: int
    sender_id: int


class MessageReceiptOut(BaseModel):
    user_id: int
    status: MessageStatus
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class MessageOut(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    content: str
    status: MessageStatus
    created_at: datetime
    receipts: List[MessageReceiptOut] = []

    model_config = ConfigDict(from_attributes=True)


class ConversationMemberOut(BaseModel):
    user_id: int
    is_admin: bool
    joined_at: datetime
    user: UserOut

    model_config = ConfigDict(from_attributes=True)


class ConversationOut(BaseModel):
    id: int
    type: ConversationType
    title: Optional[str] = None
    avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    members: List[ConversationMemberOut] = []
    last_message: Optional[MessageOut] = None
    unread_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class CreateConversationRequest(BaseModel):
    type: ConversationType = ConversationType.DIRECT
    title: Optional[str] = None
    avatar_url: Optional[str] = None
    member_ids: List[int]
    creator_id: int
