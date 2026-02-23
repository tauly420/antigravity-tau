"""
Fourier Analysis API
DFT, PSD, inverse DFT with frequency filtering
"""

from flask import Blueprint, request, jsonify
import numpy as np

fourier_bp = Blueprint('fourier', __name__)


def _find_dominant_frequencies(freqs, magnitudes, n_top=5, min_margin_hz=None):
    """
    Find the top-n dominant frequencies with a minimum separation margin.
    If min_margin_hz is None, use 2% of the frequency range.
    """
    if len(freqs) == 0:
        return []
    
    freq_range = freqs[-1] - freqs[0] if len(freqs) > 1 else 1.0
    if min_margin_hz is None:
        min_margin_hz = max(freq_range * 0.02, freqs[1] - freqs[0] if len(freqs) > 1 else 0.01)
    
    # Sort by magnitude descending
    sorted_idx = np.argsort(magnitudes)[::-1]
    
    selected = []
    for idx in sorted_idx:
        freq = freqs[idx]
        # Skip DC component
        if freq <= 0:
            continue
        # Check margin against already selected
        too_close = False
        for sf, _, _ in selected:
            if abs(freq - sf) < min_margin_hz:
                too_close = True
                break
        if not too_close:
            selected.append((float(freq), float(magnitudes[idx]), int(idx)))
            if len(selected) >= n_top:
                break
    
    return selected


@fourier_bp.route('/analyze', methods=['POST'])
def analyze():
    """
    Perform DFT and/or PSD on input data.
    
    Request JSON:
    {
        "y_data": [1.0, 2.0, ...],
        "dt": 0.01,  // sampling interval (optional, default 1.0)
        "compute_dft": true,
        "compute_psd": true,
        "n_dominant": 5
    }
    """
    try:
        data = request.get_json()
        y_data = np.array(data.get('y_data', []), dtype=float)
        dt = float(data.get('dt', 1.0))
        compute_dft = data.get('compute_dft', True)
        compute_psd = data.get('compute_psd', True)
        n_dominant = int(data.get('n_dominant', 5))
        
        if len(y_data) < 4:
            return jsonify({"error": "Need at least 4 data points"}), 400
        
        N = len(y_data)
        
        # Compute DFT
        fft_result = np.fft.rfft(y_data)
        freqs = np.fft.rfftfreq(N, d=dt)
        magnitudes = np.abs(fft_result) * 2.0 / N  # Normalized amplitude
        phases = np.angle(fft_result)
        
        result = {
            "frequencies": freqs.tolist(),
            "n_points": N,
            "dt": dt,
            "freq_resolution": float(1.0 / (N * dt)),
            "nyquist_freq": float(0.5 / dt),
        }
        
        if compute_dft:
            result["dft_magnitudes"] = magnitudes.tolist()
            result["dft_phases"] = phases.tolist()
            result["dft_real"] = fft_result.real.tolist()
            result["dft_imag"] = fft_result.imag.tolist()
        
        if compute_psd:
            psd = (np.abs(fft_result) ** 2) * (2.0 * dt / N)
            result["psd"] = psd.tolist()
        
        # Dominant frequencies
        dominant = _find_dominant_frequencies(freqs, magnitudes, n_dominant)
        result["dominant_frequencies"] = [
            {"frequency": f, "amplitude": a, "period": 1.0/f if f > 0 else float('inf'), "index": idx}
            for f, a, idx in dominant
        ]
        
        result["error"] = None
        return jsonify(result)
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@fourier_bp.route('/inverse', methods=['POST'])
def inverse_dft():
    """
    Reconstruct signal from DFT, optionally filtering frequencies.
    
    Request JSON:
    {
        "dft_real": [...],
        "dft_imag": [...],
        "n_points": 100,
        "filter_type": "lowpass",  // "lowpass", "highpass", "bandpass", "none"
        "cutoff_low": 5.0,
        "cutoff_high": 20.0,
        "frequencies": [...]
    }
    """
    try:
        data = request.get_json()
        dft_real = np.array(data.get('dft_real', []), dtype=float)
        dft_imag = np.array(data.get('dft_imag', []), dtype=float)
        n_points = int(data.get('n_points', 0))
        filter_type = data.get('filter_type', 'none')
        cutoff_low = data.get('cutoff_low', None)
        cutoff_high = data.get('cutoff_high', None)
        freqs = np.array(data.get('frequencies', []), dtype=float)
        
        fft_data = dft_real + 1j * dft_imag
        
        # Apply frequency filter
        if filter_type != 'none' and len(freqs) > 0:
            mask = np.ones(len(fft_data), dtype=bool)
            if filter_type == 'lowpass' and cutoff_high is not None:
                mask = freqs <= cutoff_high
            elif filter_type == 'highpass' and cutoff_low is not None:
                mask = freqs >= cutoff_low
            elif filter_type == 'bandpass' and cutoff_low is not None and cutoff_high is not None:
                mask = (freqs >= cutoff_low) & (freqs <= cutoff_high)
            
            fft_filtered = fft_data * mask
        else:
            fft_filtered = fft_data
        
        # Inverse FFT
        reconstructed = np.fft.irfft(fft_filtered, n=n_points)
        
        return jsonify({
            "reconstructed": reconstructed.tolist(),
            "filter_type": filter_type,
            "error": None
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
