import enum
from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    Enum as SQLEnum,
    UniqueConstraint
)
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class ConversationType(str, enum.Enum):
    DIRECT = "direct"
    GROUP = "group"


class MessageStatus(str, enum.Enum):
    SENDING = "sending"
    SENT = "sent"
    DELIVERED = "delivered"
    READ = "read"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    phone_number = Column(String(20), unique=True, index=True, nullable=True)
    display_name = Column(String(100), nullable=False)
    avatar_url = Column(String(255), nullable=True)
    status_message = Column(String(255), default="Hey there! I am using Signal.")
    is_online = Column(Boolean, default=False)
    last_seen = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Relationships
    memberships = relationship("ConversationMember", back_populates="user", cascade="all, delete-orphan")
    sent_messages = relationship("Message", back_populates="sender", cascade="all, delete-orphan")
    receipts = relationship("MessageReceipt", back_populates="user", cascade="all, delete-orphan")


class Conversation(Base):
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(SQLEnum(ConversationType), default=ConversationType.DIRECT, nullable=False)
    title = Column(String(100), nullable=True)  # For group chats
    avatar_url = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    members = relationship("ConversationMember", back_populates="conversation", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")


class ConversationMember(Base):
    __tablename__ = "conversation_members"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    is_admin = Column(Boolean, default=False)
    joined_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_conversation_user"),
    )

    conversation = relationship("Conversation", back_populates="members")
    user = relationship("User", back_populates="memberships")


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    status = Column(SQLEnum(MessageStatus), default=MessageStatus.SENT, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)

    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", back_populates="sent_messages")
    receipts = relationship("MessageReceipt", back_populates="message", cascade="all, delete-orphan")


class MessageReceipt(Base):
    __tablename__ = "message_receipts"

    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(Integer, ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(SQLEnum(MessageStatus), default=MessageStatus.DELIVERED, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("message_id", "user_id", name="uq_message_user_receipt"),
    )

    message = relationship("Message", back_populates="receipts")
    user = relationship("User", back_populates="receipts")
