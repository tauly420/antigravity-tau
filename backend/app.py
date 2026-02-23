"""
Tau-LY Lab Tools - Flask Backend
Main application entry point
"""

from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS
import os

def create_app():
    """Create and configure the Flask application"""
    app = Flask(__name__, static_folder='../frontend/dist')
    
    # CORS configuration - allow frontend to communicate with backend
    CORS(app, resources={
        r"/api/*": {
            "origins": ["http://localhost:5173", "http://localhost:3000"],
            "methods": ["GET", "POST", "OPTIONS"],
            "allow_headers": ["Content-Type"]
        }
    })
    
    # Register API blueprints
    from api.formula import formula_bp
    from api.nsigma import nsigma_bp
    from api.fitting import fitting_bp
    from api.units import units_bp
    from api.matrix import matrix_bp
    from api.ode import ode_bp
    from api.integrate import integrate_bp
    from api.assistant import assistant_bp
    from api.fourier import fourier_bp
    
    app.register_blueprint(formula_bp, url_prefix='/api/formula')
    app.register_blueprint(nsigma_bp, url_prefix='/api/nsigma')
    app.register_blueprint(fitting_bp, url_prefix='/api/fitting')
    app.register_blueprint(units_bp, url_prefix='/api/units')
    app.register_blueprint(matrix_bp, url_prefix='/api/matrix')
    app.register_blueprint(ode_bp, url_prefix='/api/ode')
    app.register_blueprint(integrate_bp, url_prefix='/api/integrate')
    app.register_blueprint(assistant_bp, url_prefix='/api/assistant')
    app.register_blueprint(fourier_bp, url_prefix='/api/fourier')
    
    # Health check endpoint
    @app.route('/api/health')
    def health():
        return jsonify({"status": "healthy"})
    
    # Serve frontend in production
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve(path):
        if path and os.path.exists(os.path.join(app.static_folder, path)):
            return send_from_directory(app.static_folder, path)
        return send_from_directory(app.static_folder, 'index.html')
    
    # Error handlers
    @app.errorhandler(404)
    def not_found(error):
        return jsonify({"error": "Not found"}), 404
    
    @app.errorhandler(500)
    def internal_error(error):
        return jsonify({"error": "Internal server error"}), 500
    
    return app

if __name__ == '__main__':
    app = create_app()
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)
