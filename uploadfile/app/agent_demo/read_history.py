from dotenv import load_dotenv
from langgraph.checkpoint.mysql.aio import AIOMySQLSaver

from app.agent_demo.session_history import (
    format_messages_for_tool,
    get_messages_from_checkpointer,
)


load_dotenv()


async def read_history(thread_id: str) -> list[dict[str, str]]:
    import os

    db_uri = os.environ["MYSQL_URL"]
    async with AIOMySQLSaver.from_conn_string(db_uri) as checkpointer:
        return await get_messages_from_checkpointer(checkpointer, thread_id)


if __name__ == "__main__":
    import asyncio
    import sys

    target_thread_id = sys.argv[1] if len(sys.argv) > 1 else "chat-003"
    messages = asyncio.run(read_history(target_thread_id))

    print(f"会话：{target_thread_id}")
    print(f"消息数量：{len(messages)}")
    print(format_messages_for_tool(messages))
