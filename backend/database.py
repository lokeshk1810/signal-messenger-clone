import os
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import select
from models import Base, User, Conversation, ConversationMember, Message, MessageReceipt, ConversationType, MessageStatus

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./signal.db")

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False}
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False
)

async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_data()

async def seed_data():
    async with AsyncSessionLocal() as session:
        # Check if users already exist
        result = await session.execute(select(User))
        existing_users = result.scalars().all()
        if existing_users:
            return  # Already seeded

        # Create mock users
        alice = User(
            id=1,
            username="alice",
            phone_number="+15550001",
            display_name="Alice Smith",
            avatar_url="https://api.dicebear.com/7.x/avataaars/svg?seed=Alice",
            status_message="Privacy is a right, not a feature.",
            is_online=True,
            last_seen=datetime.utcnow()
        )
        bob = User(
            id=2,
            username="bob",
            phone_number="+15550002",
            display_name="Bob Jones",
            avatar_url="https://api.dicebear.com/7.x/avataaars/svg?seed=Bob",
            status_message="Available on Signal",
            is_online=False,
            last_seen=datetime.utcnow()
        )
        charlie = User(
            id=3,
            username="charlie",
            phone_number="+15550003",
            display_name="Charlie Davis",
            avatar_url="https://api.dicebear.com/7.x/avataaars/svg?seed=Charlie",
            status_message="Coding away...",
            is_online=True,
            last_seen=datetime.utcnow()
        )

        session.add_all([alice, bob, charlie])
        await session.commit()

        # Create sample conversation between Alice and Bob (1-on-1 direct)
        conv1 = Conversation(
            id=1,
            type=ConversationType.DIRECT,
            title=None,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(conv1)
        await session.commit()

        member_alice = ConversationMember(
            conversation_id=conv1.id,
            user_id=alice.id,
            is_admin=True
        )
        member_bob = ConversationMember(
            conversation_id=conv1.id,
            user_id=bob.id,
            is_admin=False
        )
        session.add_all([member_alice, member_bob])
        await session.commit()

        # Seed sample messages in conversation 1
        msg1 = Message(
            id=1,
            conversation_id=conv1.id,
            sender_id=alice.id,
            content="Hey Bob! Welcome to Signal Clone.",
            status=MessageStatus.READ,
            created_at=datetime.utcnow()
        )
        msg2 = Message(
            id=2,
            conversation_id=conv1.id,
            sender_id=bob.id,
            content="Hi Alice! Thanks, the UI looks super crisp and secure.",
            status=MessageStatus.READ,
            created_at=datetime.utcnow()
        )
        msg3 = Message(
            id=3,
            conversation_id=conv1.id,
            sender_id=alice.id,
            content="Real-time WebSockets and delivery receipts are fully functional!",
            status=MessageStatus.DELIVERED,
            created_at=datetime.utcnow()
        )
        session.add_all([msg1, msg2, msg3])
        await session.commit()

        # Add receipts
        r1 = MessageReceipt(message_id=msg1.id, user_id=bob.id, status=MessageStatus.READ)
        r2 = MessageReceipt(message_id=msg2.id, user_id=alice.id, status=MessageStatus.READ)
        r3 = MessageReceipt(message_id=msg3.id, user_id=bob.id, status=MessageStatus.DELIVERED)
        session.add_all([r1, r2, r3])

        # Also create a sample group conversation with Alice, Bob, and Charlie
        conv2 = Conversation(
            id=2,
            type=ConversationType.GROUP,
            title="Dev Team",
            avatar_url="https://api.dicebear.com/7.x/identicon/svg?seed=DevTeam",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        session.add(conv2)
        await session.commit()

        g_alice = ConversationMember(conversation_id=conv2.id, user_id=alice.id, is_admin=True)
        g_bob = ConversationMember(conversation_id=conv2.id, user_id=bob.id, is_admin=False)
        g_charlie = ConversationMember(conversation_id=conv2.id, user_id=charlie.id, is_admin=False)
        session.add_all([g_alice, g_bob, g_charlie])

        msg4 = Message(
            id=4,
            conversation_id=conv2.id,
            sender_id=charlie.id,
            content="Hey team, welcome to the dev channel!",
            status=MessageStatus.SENT,
            created_at=datetime.utcnow()
        )
        session.add(msg4)
        await session.commit()
        print("Database seeded with mock users and sample conversations.")
