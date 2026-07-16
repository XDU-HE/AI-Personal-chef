from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage


def readable_content(content: Any) -> str:
    """Convert message content to readable text without dumping image payloads."""
    if isinstance(content, str):
        return content

    if not isinstance(content, list):
        return str(content)

    parts: list[str] = []
    for block in content:
        if not isinstance(block, dict):
            parts.append(str(block))
            continue

        block_type = block.get("type")
        if block_type == "text":
            parts.append(block.get("text", ""))
        elif block_type in {"image", "image_url", "input_image"}:
            parts.append("[图片]")
        else:
            parts.append(str(block))

    return "\n".join(part for part in parts if part)


def message_to_dict(message: BaseMessage) -> dict[str, str] | None:
    content = readable_content(message.content)
    if not content:
        return None

    if isinstance(message, HumanMessage):
        return {"role": "user", "content": content}

    if isinstance(message, AIMessage):
        return {"role": "assistant", "content": content}

    return None


async def get_messages_from_checkpointer(
    checkpointer: Any,
    thread_id: str,
) -> list[dict[str, str]]:
    checkpoint_tuple = await checkpointer.aget_tuple(
        {"configurable": {"thread_id": thread_id}}
    )
    if checkpoint_tuple is None:
        return []

    messages = (
        checkpoint_tuple.checkpoint.get("channel_values", {}).get("messages", [])
    )
    result: list[dict[str, str]] = []
    for message in messages:
        item = message_to_dict(message)
        if item is not None:
            result.append(item)

    return result


async def clear_thread_from_checkpointer(checkpointer: Any, thread_id: str) -> None:
    await checkpointer.adelete_thread(thread_id)


def format_messages_for_tool(messages: list[dict[str, str]]) -> str:
    if not messages:
        return "当前会话暂无历史消息。"

    lines = []
    for index, message in enumerate(messages, start=1):
        role = "用户" if message["role"] == "user" else "助手"
        lines.append(f"{index}. {role}: {message['content']}")

    return "\n".join(lines)
