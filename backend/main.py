import json
from datetime import datetime
from typing import Dict, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, update
from sqlalchemy.orm import selectinload

from database import init_db, get_db, AsyncSessionLocal
from models import User, Conversation, ConversationMember, Message, MessageReceipt, ConversationType, MessageStatus
from schemas import (
    UserOut, UserCreate, LoginRequest,
    ConversationOut, CreateConversationRequest,
    MessageOut, MessageCreate
)


# Connection Manager for real-time WebSocket communication
class ConnectionManager:
    def __init__(self):
        # Maps user_id -> List of active WebSocket connections (support multi-tab/device)
        self.active_connections: Dict[int, List[WebSocket]] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = []
        self.active_connections[user_id].append(websocket)
        # Update user online status
        await self._set_user_online(user_id, True)

    async def disconnect(self, user_id: int, websocket: WebSocket):
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
                # Update user online status
                await self._set_user_online(user_id, False)

    async def _set_user_online(self, user_id: int, is_online: bool):
        async with AsyncSessionLocal() as session:
            stmt = (
                update(User)
                .where(User.id == user_id)
                .values(is_online=is_online, last_seen=datetime.utcnow())
            )
            await session.execute(stmt)
            await session.commit()
            
            # Broadcast user presence change to all active users
            await self.broadcast({
                "type": "presence_update",
                "data": {
                    "user_id": user_id,
                    "is_online": is_online,
                    "last_seen": datetime.utcnow().isoformat()
                }
            })

    async def send_personal_message(self, message: dict, user_id: int):
        if user_id in self.active_connections:
            dead_connections = []
            for ws in self.active_connections[user_id]:
                try:
                    await ws.send_text(json.dumps(message))
                except Exception:
                    dead_connections.append(ws)
            for ws in dead_connections:
                self.active_connections[user_id].remove(ws)

    async def broadcast_to_users(self, message: dict, user_ids: List[int]):
        for uid in user_ids:
            await self.send_personal_message(message, uid)

    async def broadcast(self, message: dict):
        for user_id in list(self.active_connections.keys()):
            await self.send_personal_message(message, user_id)


manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB & Seed Mock Data
    await init_db()
    yield


app = FastAPI(title="Signal Clone Backend", version="1.0.0", lifespan=lifespan)

# CORS middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {"message": "Signal Clone Backend API is running."}


# -------------------------------------------------------------
# Auth & Users Routes
# -------------------------------------------------------------

@app.post("/auth/login", response_model=UserOut)
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    # Mock authentication - search by username or phone number
    stmt = select(User).where(
        or_(
            User.username == req.username_or_phone,
            User.phone_number == req.username_or_phone
        )
    )
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        # Auto-create if not found (for smooth testing and onboarding)
        username = req.username_or_phone.strip().lower().replace(" ", "_")
        user = User(
            username=username,
            phone_number=req.username_or_phone if req.username_or_phone.startswith("+") else None,
            display_name=req.username_or_phone.capitalize(),
            avatar_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={username}",
            is_online=True,
            last_seen=datetime.utcnow()
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    return user


@app.get("/users", response_model=List[UserOut])
async def get_users(db: AsyncSession = Depends(get_db)):
    stmt = select(User).order_by(User.display_name)
    result = await db.execute(stmt)
    return result.scalars().all()


@app.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    stmt = select(User).where(User.username == user_in.username)
    res = await db.execute(stmt)
    if res.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Username already registered")

    user = User(
        username=user_in.username,
        phone_number=user_in.phone_number,
        display_name=user_in.display_name,
        avatar_url=user_in.avatar_url or f"https://api.dicebear.com/7.x/avataaars/svg?seed={user_in.username}",
        status_message=user_in.status_message or "Hey there! I am using Signal."
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


# -------------------------------------------------------------
# Conversations Routes
# -------------------------------------------------------------

@app.get("/conversations/{user_id}", response_model=List[ConversationOut])
async def get_user_conversations(user_id: int, db: AsyncSession = Depends(get_db)):
    # Find all conversations user is a member of
    stmt = (
        select(Conversation)
        .join(ConversationMember)
        .where(ConversationMember.user_id == user_id)
        .options(
            selectinload(Conversation.members).selectinload(ConversationMember.user),
            selectinload(Conversation.messages).selectinload(Message.receipts)
        )
        .order_by(Conversation.updated_at.desc())
    )
    result = await db.execute(stmt)
    conversations = result.scalars().all()

    conv_list = []
    for conv in conversations:
        # Determine last message
        last_msg = conv.messages[-1] if conv.messages else None
        
        # Calculate unread count (messages sent by others that have not been read by user)
        unread = 0
        for msg in conv.messages:
            if msg.sender_id != user_id:
                # check if there is a READ receipt from this user
                read_by_user = any(r.user_id == user_id and r.status == MessageStatus.READ for r in msg.receipts)
                if not read_by_user:
                    unread += 1

        conv_dict = {
            "id": conv.id,
            "type": conv.type,
            "title": conv.title,
            "avatar_url": conv.avatar_url,
            "created_at": conv.created_at,
            "updated_at": conv.updated_at,
            "members": conv.members,
            "last_message": last_msg,
            "unread_count": unread
        }
        conv_list.append(conv_dict)

    return conv_list


@app.post("/conversations", response_model=ConversationOut)
async def create_conversation(req: CreateConversationRequest, db: AsyncSession = Depends(get_db)):
    # Check if direct chat already exists between these 2 users
    if req.type == ConversationType.DIRECT and len(req.member_ids) == 2:
        u1, u2 = req.member_ids[0], req.member_ids[1]
        stmt = (
            select(Conversation)
            .where(Conversation.type == ConversationType.DIRECT)
            .join(ConversationMember)
            .where(ConversationMember.user_id.in_([u1, u2]))
            .options(
                selectinload(Conversation.members).selectinload(ConversationMember.user),
                selectinload(Conversation.messages).selectinload(Message.receipts)
            )
        )
        res = await db.execute(stmt)
        for c in res.scalars().all():
            m_ids = {m.user_id for m in c.members}
            if m_ids == {u1, u2}:
                return {
                    "id": c.id,
                    "type": c.type,
                    "title": c.title,
                    "avatar_url": c.avatar_url,
                    "created_at": c.created_at,
                    "updated_at": c.updated_at,
                    "members": c.members,
                    "last_message": c.messages[-1] if c.messages else None,
                    "unread_count": 0
                }

    new_conv = Conversation(
        type=req.type,
        title=req.title,
        avatar_url=req.avatar_url
    )
    db.add(new_conv)
    await db.commit()
    await db.refresh(new_conv)

    members = []
    for uid in req.member_ids:
        mem = ConversationMember(
            conversation_id=new_conv.id,
            user_id=uid,
            is_admin=(uid == req.creator_id)
        )
        db.add(mem)
        members.append(mem)

    await db.commit()

    # Query back fully populated
    stmt = (
        select(Conversation)
        .where(Conversation.id == new_conv.id)
        .options(
            selectinload(Conversation.members).selectinload(ConversationMember.user),
            selectinload(Conversation.messages).selectinload(Message.receipts)
        )
    )
    res = await db.execute(stmt)
    c = res.scalar_one()

    return {
        "id": c.id,
        "type": c.type,
        "title": c.title,
        "avatar_url": c.avatar_url,
        "created_at": c.created_at,
        "updated_at": c.updated_at,
        "members": c.members,
        "last_message": None,
        "unread_count": 0
    }


# -------------------------------------------------------------
# Messages Routes
# -------------------------------------------------------------

@app.get("/conversations/{conversation_id}/messages", response_model=List[MessageOut])
async def get_conversation_messages(
    conversation_id: int,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .options(selectinload(Message.receipts))
        .order_by(Message.created_at.asc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@app.post("/conversations/{conversation_id}/messages", response_model=MessageOut)
async def post_message(
    conversation_id: int,
    msg_in: MessageBase,
    sender_id: int = Query(...),
    db: AsyncSession = Depends(get_db)
):
    msg = Message(
        conversation_id=conversation_id,
        sender_id=sender_id,
        content=msg_in.content,
        status=MessageStatus.SENT,
        created_at=datetime.utcnow()
    )
    db.add(msg)

    # Update conversation updated_at
    conv_stmt = select(Conversation).where(Conversation.id == conversation_id).options(selectinload(Conversation.members))
    c_res = await db.execute(conv_stmt)
    conv = c_res.scalar_one_or_none()
    if conv:
        conv.updated_at = datetime.utcnow()

    await db.commit()
    await db.refresh(msg)

    # Get conversation member user IDs to broadcast
    member_user_ids = [m.user_id for m in conv.members] if conv else []

    msg_payload = {
        "type": "new_message",
        "data": {
            "id": msg.id,
            "conversation_id": msg.conversation_id,
            "sender_id": msg.sender_id,
            "content": msg.content,
            "status": msg.status.value,
            "created_at": msg.created_at.isoformat(),
            "receipts": []
        }
    }
    await manager.broadcast_to_users(msg_payload, member_user_ids)

    return msg


# -------------------------------------------------------------
# Real-time WebSocket Endpoint
# -------------------------------------------------------------

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    await manager.connect(user_id, websocket)
    try:
        while True:
            raw_text = await websocket.receive_text()
            try:
                data = json.loads(raw_text)
            except Exception:
                continue

            event_type = data.get("type")
            payload = data.get("data", {})

            # 1. SEND_MESSAGE event
            if event_type == "send_message":
                conv_id = payload.get("conversation_id")
                content = payload.get("content")
                if conv_id and content:
                    async with AsyncSessionLocal() as session:
                        msg = Message(
                            conversation_id=conv_id,
                            sender_id=user_id,
                            content=content,
                            status=MessageStatus.SENT,
                            created_at=datetime.utcnow()
                        )
                        session.add(msg)
                        
                        conv_stmt = (
                            select(Conversation)
                            .where(Conversation.id == conv_id)
                            .options(selectinload(Conversation.members))
                        )
                        c_res = await session.execute(conv_stmt)
                        conv = c_res.scalar_one_or_none()
                        if conv:
                            conv.updated_at = datetime.utcnow()
                        
                        await session.commit()
                        await session.refresh(msg)

                        member_uids = [m.user_id for m in conv.members] if conv else [user_id]
                        
                        msg_out = {
                            "type": "new_message",
                            "data": {
                                "id": msg.id,
                                "conversation_id": msg.conversation_id,
                                "sender_id": msg.sender_id,
                                "content": msg.content,
                                "status": msg.status.value,
                                "created_at": msg.created_at.isoformat(),
                                "receipts": []
                            }
                        }
                        await manager.broadcast_to_users(msg_out, member_uids)

            # 2. TYPING indicator event
            elif event_type == "typing":
                conv_id = payload.get("conversation_id")
                is_typing = payload.get("is_typing", True)
                if conv_id:
                    async with AsyncSessionLocal() as session:
                        conv_stmt = (
                            select(Conversation)
                            .where(Conversation.id == conv_id)
                            .options(selectinload(Conversation.members))
                        )
                        c_res = await session.execute(conv_stmt)
                        conv = c_res.scalar_one_or_none()
                        if conv:
                            other_members = [m.user_id for m in conv.members if m.user_id != user_id]
                            await manager.broadcast_to_users({
                                "type": "typing",
                                "data": {
                                    "conversation_id": conv_id,
                                    "user_id": user_id,
                                    "is_typing": is_typing
                                }
                            }, other_members)

            # 3. MESSAGE_RECEIPT (DELIVERED / READ) event
            elif event_type in ("receipt", "message_read", "message_delivered"):
                msg_id = payload.get("message_id")
                status_str = payload.get("status")
                receipt_status = (
                    MessageStatus.READ if (event_type == "message_read" or status_str == "read")
                    else MessageStatus.DELIVERED
                )
                if msg_id:
                    async with AsyncSessionLocal() as session:
                        msg_stmt = (
                            select(Message)
                            .where(Message.id == msg_id)
                            .options(selectinload(Message.conversation).selectinload(Conversation.members))
                        )
                        m_res = await session.execute(msg_stmt)
                        msg = m_res.scalar_one_or_none()
                        if msg:
                            # Update receipt or create
                            r_stmt = select(MessageReceipt).where(
                                and_(MessageReceipt.message_id == msg_id, MessageReceipt.user_id == user_id)
                            )
                            r_res = await session.execute(r_stmt)
                            receipt = r_res.scalar_one_or_none()
                            if receipt:
                                receipt.status = receipt_status
                                receipt.updated_at = datetime.utcnow()
                            else:
                                receipt = MessageReceipt(
                                    message_id=msg_id,
                                    user_id=user_id,
                                    status=receipt_status
                                )
                                session.add(receipt)

                            # If all members or direct partner read, update msg status
                            if receipt_status == MessageStatus.READ:
                                msg.status = MessageStatus.READ
                            elif msg.status != MessageStatus.READ and receipt_status == MessageStatus.DELIVERED:
                                msg.status = MessageStatus.DELIVERED

                            await session.commit()

                            # Notify conversation members of receipt update
                            member_uids = [m.user_id for m in msg.conversation.members]
                            await manager.broadcast_to_users({
                                "type": "receipt_update",
                                "data": {
                                    "message_id": msg_id,
                                    "user_id": user_id,
                                    "status": receipt_status.value,
                                    "conversation_id": msg.conversation_id
                                }
                            }, member_uids)

    except WebSocketDisconnect:
        await manager.disconnect(user_id, websocket)
    except Exception as e:
        await manager.disconnect(user_id, websocket)
