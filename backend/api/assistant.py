"""
AI Assistant API
Integrates with OpenAI for chat functionality
"""

from flask import Blueprint, request, jsonify
import os
import sys

# Add parent directory to path to import from app folder
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../..'))

try:
    from app.chat_agent import ChatAgent
    CHAT_AVAILABLE = True
except ImportError:
    CHAT_AVAILABLE = False

assistant_bp = Blueprint('assistant', __name__)

# Initialize chat agent if available
chat_agent = None
if CHAT_AVAILABLE:
    try:
        chat_agent = ChatAgent(system_prompt_path="app/system_prompt.md")
    except Exception:
        pass


@assistant_bp.route('/chat', methods=['POST'])
def chat():
    """
    Chat with AI assistant.
    
    Request JSON:
    {
        "message": "How do I calculate uncertainty?",
        "context": {...}  // Optional: current calculation context
    }
    
    Response JSON:
    {
        "response": "To calculate uncertainty...",
        "error": null
    }
    """
    if not CHAT_AVAILABLE or chat_agent is None:
        return jsonify({
            "error": "Chat agent not available. Please check OpenAI API key configuration."
        }), 503
    
    try:
        data = request.get_json()
        
        message = data.get('message', '')
        context = data.get('context', {})
        
        if not message:
            return jsonify({"error": "message is required"}), 400
        
        # Build context string if provided
        context_str = ""
        if context:
            context_str = f"\n\nContext: {str(context)}"
        
        # Get response from chat agent
        response = chat_agent.chat(message + context_str)
        
        return jsonify({
            "response": response,
            "error": None
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@assistant_bp.route('/status', methods=['GET'])
def status():
    """Check if assistant is available"""
    return jsonify({
        "available": CHAT_AVAILABLE and chat_agent is not None,
        "error": None if (CHAT_AVAILABLE and chat_agent is not None) else "Chat agent not configured"
    })
