import os
from contextlib import asynccontextmanager
from typing import Any

from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessageChunk, HumanMessage
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool
from langchain_tavily import TavilySearch
from langgraph.checkpoint.mysql.aio import AIOMySQLSaver

from app.agent_demo.session_history import (
    clear_thread_from_checkpointer,
    format_messages_for_tool,
    get_messages_from_checkpointer,
)
from app.common.logger import logger


load_dotenv()

model = init_chat_model(
    model="qwen3.7-plus",
    model_provider="openai",
    base_url=os.getenv("DASHSCOPE_BASE_URL"),
    api_key=os.getenv("DASHSCOPE_API_KEY"),
)

web_search = TavilySearch(max_results=5)

system_prompt = """
你是一名私人厨师。收到用户提供的食材照片或清单后，请按以下流程操作：

1. 识别和评估食材：如果用户提供照片，先识别所有可见食材。基于外观状态，评估新鲜度与可用量，并整理出“当前可用食材清单”。
2. 智能食谱检索：优先调用 web_search 工具，以“当前可用食材清单”为核心关键词，查找可行菜谱。
3. 多维度评估与排序：从营养价值和制作难度两个维度对检索到的候选食谱进行评分，并根据得分排序。制作简单且营养丰富的方案排在前面。
4. 结构化方案输出：把排序后的食谱整理为清晰的建议报告，包含食谱信息、得分、推荐理由、关键步骤和来源链接。

约束：
- 优先使用 web_search 的结果回答。搜索不到时，可以使用通用烹饪知识，但必须明确说明该部分不是来自搜索结果。
- 不要编造精确营养数字、热量、图片地址或来源链接。只有搜索结果中明确出现的信息才可以作为精确数据引用。
- 如果用户继续说“选择第 4 道菜”“就做刚才那道”等，请结合当前对话历史理解指代。
- 当用户要求查看当前会话历史时，调用 get_current_session_history 工具。
- 当用户明确要求清空当前会话历史时，调用 clear_current_session_history 工具。
""".strip()

_checkpointer_cm: Any | None = None
checkpointer: AIOMySQLSaver | None = None
agent: Any | None = None


def _require_checkpointer() -> AIOMySQLSaver:
    if checkpointer is None:
        raise RuntimeError("MySQL checkpointer is not initialized")
    return checkpointer


def _thread_id_from_config(config: RunnableConfig) -> str:
    thread_id = config.get("configurable", {}).get("thread_id")
    if not thread_id:
        raise RuntimeError("thread_id is required in RunnableConfig.configurable")
    return str(thread_id)


async def get_messages(thread_id: str) -> list[dict[str, str]]:
    logger.info("获取历史消息，thread_id: %s", thread_id)
    return await get_messages_from_checkpointer(_require_checkpointer(), thread_id)


async def clear_messages(thread_id: str) -> None:
    logger.info("清空历史消息，thread_id: %s", thread_id)
    await clear_thread_from_checkpointer(_require_checkpointer(), thread_id)


@tool
async def get_current_session_history(config: RunnableConfig) -> str:
    """查询当前会话的历史消息。用户要求查看、回顾、总结历史对话时调用。"""
    thread_id = _thread_id_from_config(config)
    messages = await get_messages(thread_id)
    return format_messages_for_tool(messages)


@tool
async def clear_current_session_history(config: RunnableConfig) -> str:
    """清空当前会话历史。仅当用户明确要求清空当前会话时调用。"""
    thread_id = _thread_id_from_config(config)
    await clear_messages(thread_id)
    return "当前会话历史已清空。"


agent_tools = [
    web_search,
    get_current_session_history,
    clear_current_session_history,
]


def build_agent(checkpointer_obj: AIOMySQLSaver | None = None) -> Any:
    kwargs: dict[str, Any] = {
        "model": model,
        "tools": agent_tools,
        "system_prompt": system_prompt,
    }
    if checkpointer_obj is not None:
        kwargs["checkpointer"] = checkpointer_obj
    return create_agent(**kwargs)


@asynccontextmanager
async def mysql_checkpointer():
    global checkpointer

    db_uri = os.getenv("MYSQL_URL")
    if not db_uri:
        raise RuntimeError("MYSQL_URL is not configured in .env")

    async with AIOMySQLSaver.from_conn_string(db_uri) as saver:
        await saver.setup()
        checkpointer = saver
        try:
            yield saver
        finally:
            checkpointer = None


async def init_agent() -> Any:
    global _checkpointer_cm, agent, checkpointer

    if agent is not None and checkpointer is not None:
        return agent

    _checkpointer_cm = mysql_checkpointer()
    checkpointer = await _checkpointer_cm.__aenter__()
    agent = build_agent(checkpointer)
    return agent


async def close_agent() -> None:
    global _checkpointer_cm, agent

    agent = None
    if _checkpointer_cm is not None:
        await _checkpointer_cm.__aexit__(None, None, None)
        _checkpointer_cm = None


def get_agent() -> Any:
    if agent is None:
        raise RuntimeError("Agent is not initialized")
    return agent


def build_human_message(prompt: str, image: str | None = None) -> HumanMessage:
    if not image or image.strip() == "":
        return HumanMessage(content=prompt)

    return HumanMessage(
        content=[
            {"type": "text", "text": prompt},
            {"type": "image_url", "image_url": {"url": image}},
        ]
    )


def _chunk_to_text(content: Any) -> str:
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict) and block.get("type") == "text":
                parts.append(block.get("text", ""))
            else:
                parts.append(str(block))
        return "".join(parts)

    return str(content)


async def search_recipes(prompt: str, image: str | None, thread_id: str):
    """调用 agent 搜索食谱，并以文本片段形式流式返回。"""
    logger.info("[用户]: %s, image: %s, thread_id: %s", prompt, image, thread_id)
    message = build_human_message(prompt, image)

    try:
        async for chunk, _metadata in get_agent().astream(
            {"messages": [message]},
            {"configurable": {"thread_id": thread_id}},
            stream_mode="messages",
        ):
            if isinstance(chunk, AIMessageChunk) and chunk.content:
                yield _chunk_to_text(chunk.content)
    except Exception as exc:
        logger.exception("[错误]: %s", exc)
        yield "信息检索失败，试试看手动输入食物列表？"


chief_agent = build_agent()
