"""
AI Assistant API
Integrates with Gemini (default) or OpenAI for chat functionality.
Set CHAT_PROVIDER=gemini or CHAT_PROVIDER=openai to switch.
"""

from flask import Blueprint, request, jsonify
import os
import sys
import traceback

# Add parent directory to path to import from app folder
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

try:
    from app.chat_agent import ChatAgent
    CHAT_AVAILABLE = True
except ImportError as e:
    print(f"[Assistant] ChatAgent import failed: {e}")
    CHAT_AVAILABLE = False

assistant_bp = Blueprint('assistant', __name__)

# Initialize chat agent if available
chat_agent = None
_provider = os.getenv("CHAT_PROVIDER", "gemini").lower()
if CHAT_AVAILABLE:
    try:
        if _provider == "gemini":
            api_key = os.environ.get("GEMINI_API_KEY", "")
            if not api_key:
                print("[Assistant] WARNING: GEMINI_API_KEY not set in environment")
        else:
            api_key = os.environ.get("OPENAI_API_KEY", "")
            if not api_key:
                print("[Assistant] WARNING: OPENAI_API_KEY not set in environment")

        chat_agent = ChatAgent()
        print(f"[Assistant] ChatAgent initialized successfully (provider: {_provider})")
    except Exception as e:
        print(f"[Assistant] ChatAgent init failed: {e}")
        traceback.print_exc()


@assistant_bp.route('/chat', methods=['POST'])
def chat():
    """
    Chat with AI assistant.
    """
    if not CHAT_AVAILABLE or chat_agent is None:
        key_name = "GEMINI_API_KEY" if _provider == "gemini" else "OPENAI_API_KEY"
        return jsonify({
            "error": f"Sorry, I encountered an error. Please check if your {key_name} is configured correctly.",
            "debug": f"ChatAgent not initialized. Check {key_name} env var."
        }), 503

    try:
        data = request.get_json()

        message = data.get('message', '')
        context = data.get('context', {})

        if not message:
            return jsonify({"error": "message is required"}), 400

        # Build the messages list for ChatAgent.ask()
        user_message = message

        # Use the ask() method with proper message format
        response = chat_agent.ask(
            [{"role": "user", "content": user_message}],
            extra_context=context if context else None
        )

        return jsonify({
            "response": response,
            "error": None
        })

    except Exception as e:
        print(f"[Assistant] Chat error: {e}")
        traceback.print_exc()
        return jsonify({"error": f"Sorry, I encountered an error: {str(e)}"}), 500


@assistant_bp.route('/status', methods=['GET'])
def status():
    """Check if assistant is available"""
    if _provider == "gemini":
        has_key = bool(os.environ.get("GEMINI_API_KEY", ""))
    else:
        has_key = bool(os.environ.get("OPENAI_API_KEY", ""))
    return jsonify({
        "available": CHAT_AVAILABLE and chat_agent is not None,
        "has_api_key": has_key,
        "provider": _provider,
        "error": None if (CHAT_AVAILABLE and chat_agent is not None) else "Chat agent not configured"
    })

