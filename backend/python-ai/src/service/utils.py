from base64 import b64decode, b64encode

from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
from langchain_core.messages import AIMessage, BaseMessage
from langchain_core.messages import ChatMessage as LangchainChatMessage
from langchain_core.messages import HumanMessage, SystemMessage, ToolMessage
from schema import ChatMessage


def convert_message_content_to_string(content: str | list[str | dict]) -> str:
    if isinstance(content, str):
        return content
    text: list[str] = []
    for content_item in content:
        if isinstance(content_item, str):
            text.append(content_item)
            continue
        if content_item["type"] == "text":
            text.append(content_item["text"])
    return "".join(text)


def langchain_to_chat_message(message: BaseMessage) -> ChatMessage:
    """Create a ChatMessage from a LangChain message."""
    match message:
        case HumanMessage():
            human_message = ChatMessage(
                type="human",
                content=convert_message_content_to_string(message.content),
            )
            return human_message
        case AIMessage():
            ai_message = ChatMessage(
                type="ai",
                content=convert_message_content_to_string(message.content),
            )
            if message.tool_calls:
                ai_message.tool_calls = message.tool_calls
            if message.response_metadata:
                ai_message.response_metadata = message.response_metadata
            if message.usage_metadata:
                ai_message.usage_metadata = message.usage_metadata
            return ai_message
        case ToolMessage():
            tool_message = ChatMessage(
                type="tool",
                content=convert_message_content_to_string(message.content),
                tool_call_id=message.tool_call_id,
            )
            return tool_message
        case LangchainChatMessage():
            if message.role == "custom":
                custom_message = ChatMessage(
                    type="custom",
                    content="",
                    custom_data=message.content[0],
                )
                return custom_message
            else:
                raise ValueError(f"Unsupported chat message role: {message.role}")
        case SystemMessage():
            system_message = ChatMessage(
                type="custom",
                content=convert_message_content_to_string(message.content),
            )
            return system_message
        case _:
            raise ValueError(f"Unsupported message type: {message.__class__.__name__}")


def remove_tool_calls(content: str | list[str | dict]) -> str | list[str | dict]:
    """Remove tool calls from content."""
    if isinstance(content, str):
        return content
    # Currently only Anthropic models stream tool calls, using content item type tool_use.
    return [
        content_item
        for content_item in content
        if isinstance(content_item, str) or content_item["type"] != "tool_use"
    ]

def decrypt(encoded):
    # 延迟导入以避免循环导入问题
    from core import settings
    
    if not settings.API_KEY:
        return encoded

    raw = b64decode(encoded)
    nonce = raw[:12]
    ciphertext = raw[12:]
    cipher = AES.new(settings.API_KEY.encode('utf-8'), AES.MODE_GCM, nonce=nonce)
    decrypted = cipher.decrypt_and_verify(ciphertext[:-16], ciphertext[-16:])
    return decrypted.decode()
