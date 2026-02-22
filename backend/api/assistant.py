"""
AI Assistant API
Integrates with OpenAI for chat functionality
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
if CHAT_AVAILABLE:
    try:
        api_key = os.environ.get("OPENAI_API_KEY", "")
        if not api_key:
            print("[Assistant] WARNING: OPENAI_API_KEY not set in environment")
        
        chat_agent = ChatAgent()
        print("[Assistant] ChatAgent initialized successfully")
    except Exception as e:
        print(f"[Assistant] ChatAgent init failed: {e}")
        traceback.print_exc()


@assistant_bp.route('/chat', methods=['POST'])
def chat():
    """
    Chat with AI assistant.
    """
    if not CHAT_AVAILABLE or chat_agent is None:
        return jsonify({
            "error": "Sorry, I encountered an error. Please check if your OpenAI API key is configured correctly.",
            "debug": "ChatAgent not initialized. Check OPENAI_API_KEY env var."
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
    return jsonify({
        "available": CHAT_AVAILABLE and chat_agent is not None,
        "has_api_key": bool(os.environ.get("OPENAI_API_KEY", "")),
        "error": None if (CHAT_AVAILABLE and chat_agent is not None) else "Chat agent not configured"
    })
