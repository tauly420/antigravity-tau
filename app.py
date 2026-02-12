

import io, math, re, random
from typing import List, Tuple, Dict, Callable, Optional
import numpy as np
import pandas as pd
import streamlit as st
import ast
import json
import base64,os
import html
from matplotlib.ticker import AutoMinorLocator, MultipleLocator  # <- ensure MultipleLocator is imported
import streamlit.components.v1 as components
import plotly.graph_objs as go
from plotly.subplots import make_subplots
from scipy import optimize, stats
from sympy import sympify, symbols, lambdify
import importlib, subprocess, sys
import plotly.io as pio
import streamlit.components.v1 as components
from pathlib import Path
from PIL import Image
# -- Matplotlib (headless-friendly) --
import matplotlib as mpl
mpl.use("Agg")  # safe on Streamlit/servers; no GUI windows
import matplotlib.pyplot as plt
from matplotlib.ticker import AutoMinorLocator
import urllib.parse as _u
from app.chat_agent import ChatAgent
# ------------------------------------------------------------
# PAGE CONFIG
# ------------------------------------------------------------
def _to_data_uri(img_path_or_url: str) -> str:
    """
    Returns a usable <img src=...> string:
    - If http(s), return URL.
    - If local, try common locations and return data:image/png;base64,...
    - If not found, return "" (caller may fallback to emoji).
    """
    if not img_path_or_url:
        return ""
    if img_path_or_url.startswith(("http://", "https://")):
        return img_path_or_url

    candidates = []
    candidates.append(img_path_or_url)
    try:
        here = os.path.dirname(__file__)
        candidates.append(os.path.join(here, img_path_or_url))
    except Exception:
        pass
    # common static locations
    candidates.append(os.path.join("static", "icons", os.path.basename(img_path_or_url)))
    candidates.append(os.path.join("static", os.path.basename(img_path_or_url)))

    for p in candidates:
        try:
            if os.path.isfile(p):
                with open(p, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode("ascii")
                return f"data:image/png;base64,{b64}"
        except Exception:
            continue
    return ""
def _read_text_file_safe(path_like: str | Path) -> str:
    """
    Read a .txt file with UTF-8 (fallback to Latin-1). Returns empty string if missing.
    Tries both the given path and the path relative to this file.
    """
    p = Path(path_like)
    if not p.is_file():
        # Try relative to this script
        p = Path(__file__).parent / str(path_like)
        if not p.is_file():
            return ""
    for enc in ("utf-8", "utf-8-sig", "latin-1"):
        try:
            return p.read_text(encoding=enc)
        except Exception:
            continue
    return ""

def _mini_md_to_html(md: str) -> str:
    """
    Tiny Markdown converter supporting:
      - #..###### headings
      - **bold**, *italic*
      - [text](url) links
      - unordered lists (-, *, +)
      - paragraphs & line breaks
    It escapes HTML first, then applies patterns.
    """
    s = html.escape(md)

    # Links: [text](url)
    s = re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)', r'<a href="\2" target="_blank" rel="noopener">\1</a>', s)

    # Headings (###### to #)
    for level in range(6, 0, -1):
        hashes = r'\#{' + str(level) + r'}\s+(.+)$'
        s = re.sub(hashes, rf'<h{level}>\1</h{level}>', s, flags=re.MULTILINE)

    # Bold (**text**) before italic to avoid nested overlap
    s = re.sub(r'\*\*([^\*]+)\*\*', r'<strong>\1</strong>', s)
    # Italic (*text*)
    s = re.sub(r'(?<!\*)\*([^\*]+)\*(?!\*)', r'<em>\1</em>', s)

    # Unordered lists: group consecutive lines starting with -, *, +
    lines = s.splitlines()
    out = []
    in_ul = False
    for ln in lines:
        m = re.match(r'^\s*([*\-\+])\s+(.*)$', ln)
        if m:
            if not in_ul:
                out.append('<ul>')
                in_ul = True
            out.append(f'<li>{m.group(2)}</li>')
        else:
            if in_ul:
                out.append('</ul>')
                in_ul = False
            out.append(ln)
    if in_ul:
        out.append('</ul>')
    s = "\n".join(out)

    # Paragraphs: blank line splits paragraphs unless already a block element
    blocks = []
    buf = []
    def _flush():
        if not buf:
            return
        chunk = "\n".join(buf).strip()
        if chunk.startswith('<h') or chunk.startswith('<ul>') or chunk.startswith('<li>') or chunk.startswith('<p>') or chunk.startswith('<div'):
            blocks.append(chunk)
        else:
            # turn single newlines into <br> within paragraph
            chunk = chunk.replace("\n", "<br>")
            blocks.append(f"<p>{chunk}</p>")
        buf.clear()

    for ln in s.splitlines():
        if ln.strip() == "":
            _flush()
        else:
            buf.append(ln)
    _flush()

    return "\n".join(blocks)

def render_about_section(file_path: str = "about.txt", *, title: str = "About us"):
    raw = _read_text_file_safe(file_path)
    if not raw:
        raw = (
            "Add an **about.txt** file next to your app to show an About section here.\n"
            "You can write Markdown: *italic*, **bold**, and headings with #."
        )

    # Try full Markdown renderer first
    html_body = None
    try:
        import markdown as _md  # pip package 'markdown' if available
        html_body = _md.markdown(raw, extensions=["extra", "sane_lists", "nl2br"])
    except Exception:
        html_body = _mini_md_to_html(raw)

    # Styles (once is fine if you already injected similar CSS elsewhere)
    st.markdown(
        """
        <style>
          .about-wrap{
            width: min(1100px, 96%);
            margin: 6px auto 0 auto;
          }
          .about-card{
            background: #FFFFFF;
            color: var(--text);
            border: 1px solid var(--border);
            border-radius: 16px;
            padding: 18px 20px;
            box-shadow: 0 8px 18px rgba(0,0,0,.08);
          }
          .about-card h1,.about-card h2,.about-card h3,.about-card h4,.about-card h5,.about-card h6{
            margin: 0.2rem 0 0.5rem 0;
            font-weight: 800;
            letter-spacing: -0.01em;
          }
          .about-card p{ margin: .4rem 0; line-height: 1.6; }
          .about-card ul{ margin: .3rem 0 .6rem 1.25rem; }
          .about-card a{ color: var(--primary); text-decoration: underline; }
        </style>
        """,
        unsafe_allow_html=True,
    )

    # Render inside a styled card, preserving your theme variables
    st.markdown(
        f"""
        <div class="about-wrap">
          <div class="about-card">
            <h3>📘 {html.escape(title)}</h3>
            <div class="about-body">
              {html_body}
            </div>
          </div>
        </div>
        """,
        unsafe_allow_html=True,
    )


# ---- PAGE CONFIG: set favicon correctly ----


_APP_DIR = Path(__file__).parent
_ICON_PATH = _APP_DIR / "tau-ly-icon.png"   # adjust if your icon lives elsewhere

try:
    _ICON_IMG = Image.open(_ICON_PATH)
except Exception:
    _ICON_IMG = None  # fallback to emoji if missing

st.set_page_config(
    page_title="Tau-LY • Lab Tools",
    page_icon=_ICON_IMG if _ICON_IMG is not None else "🧪",
    layout="wide",
)


agent = ChatAgent(system_prompt_path="app/system_prompt.md")

# ---- Button registry (edit to add/reorder) ----
BUTTONS = [
  {"key":"formula","title":"Formula Calculator","subtitle":"Compute expressions & uncertainties","icon":"formula_panel.png"},
  {"key":"nsigma","title":"N-sigma Panel","subtitle":"Sigma bands & thresholds","icon":"N-sigma.png"},
  {"key":"workflow","title":"Whole Workflow","subtitle":"Full app with sidebar & plots","icon":"Workflow.png"},
  {"key":"fit","title":"Graph & Fitting","subtitle":"Plot data and fit models","icon":"graph.png"},
]

# SIMPLE ROUTER (query param + session_state)

VIEWS = {"home", "workflow", "unit_only", "assistant",
         "formula_only", "n_sigma_only", "graph_only"}

def _qp_get():
    try:
        return dict(st.query_params)                    # Streamlit ≥1.33
    except Exception:
        return st.experimental_get_query_params()       # fallback

def _qp_set(**kwargs):
    try:
        for k, v in kwargs.items():
            st.query_params[k] = v
    except Exception:
        st.experimental_set_query_params(**kwargs)

def _norm_view(raw) -> str:
    if isinstance(raw, list):
        raw = raw[0] if raw else None
    raw = (raw or "").strip().lower()
    return raw if raw in VIEWS else "home"

def current_view() -> str:
    qp = _qp_get()
    v = _norm_view(qp.get("view"))
    if qp.get("view") != v:   # stabilize URL once
        _qp_set(view=v)
    st.session_state["_view"] = v
    return v

def goto_view(v: str):
    v = _norm_view(v)
    _qp_set(view=v)
    st.session_state["_view"] = v
    st.rerun()

# First boot: ensure ?view=home so center isn’t blank
if "_view_bootstrapped" not in st.session_state:
    _ = current_view()
    st.session_state["_view_bootstrapped"] = True

# ------------------------------------------------------------
# THEME TOKENS (Sage Light) + ACCESSIBILITY GUARDS
# ------------------------------------------------------------
def _hex_to_rgb_tuple(h: str) -> Tuple[float, float, float]:
    h = h.strip().lstrip("#")
    return tuple(int(h[i:i+2], 16)/255.0 for i in (0, 2, 4))

def _rel_luminance(hex_color: str) -> float:
    r, g, b = _hex_to_rgb_tuple(hex_color)
    def f(u): return u/12.92 if u <= 0.03928 else ((u+0.055)/1.055)**2.4
    return 0.2126*f(r) + 0.7152*f(g) + 0.0722*f(b)

def _contrast_ratio(hex1: str, hex2: str) -> float:
    L1, L2 = sorted([_rel_luminance(hex1), _rel_luminance(hex2)], reverse=True)
    return (L1 + 0.05) / (L2 + 0.05)

def _mix(hex_a: str, hex_b: str, t: float) -> str:
    # linear blend in sRGB space
    ra, ga, ba = _hex_to_rgb_tuple(hex_a)
    rb, gb, bb = _hex_to_rgb_tuple(hex_b)
    r = int(round((1-t)*ra*255 + t*rb*255))
    g = int(round((1-t)*ga*255 + t*gb*255))
    b = int(round((1-t)*ba*255 + t*bb*255))
    return f"#{r:02X}{g:02X}{b:02X}"

def _rgba(hex_color: str, a: float) -> str:
    r, g, b = _hex_to_rgb_tuple(hex_color)
    return f"rgba({int(r*255)},{int(g*255)},{int(b*255)},{a:.3f})"

# ---- Accessibility guard config ----
A11Y_RELAXED = True            # True = don't block the app; just warn
A11Y_MIN_NORMAL = 2.0          # contrast threshold for normal text (was 4.5)
A11Y_MIN_DISABLED = 1.8        # contrast threshold for disabled content (was 3.0)

# Base tokens (single source of truth)
THEME: Dict[str, str] = {
    "background": "#FFEBEE",    # light red tint (cards / page bg)
    "secondaryBackground": "#7A1C1C",  # deep red for sidebar
    "text": "#0B1F14",          # keep your dark readable text
    "primary": "#C62828",       # primary button/brand red
    "accent": "#E53935",        # hover/links/accent red
    "success": "#2E7D32",       # keep non-red semantic tokens (optional)
    "warning": "#B7791F",
    "error":   "#B00020",
}


# Derived tokens
DERIVED: Dict[str, str] = {
    "onPrimary": "#FFFFFF",
    "onAccent":  "#FFFFFF",
    "onSecondary": "#FFFFFF",   # ← NEW: text color used on secondaryBackground

    "border":    _mix(THEME["text"], THEME["background"], 0.85),
    "mutedText": _mix(THEME["text"], THEME["background"], 0.35),
    "focusRing": _rgba(THEME["primary"], 0.35),
    "grid":      _rgba(THEME["text"], 0.20),
    "zeroLine":  _rgba(THEME["text"], 0.35),
    "shadowS":   _rgba("#000000", 0.04),
    "shadowM":   _rgba("#000000", 0.10),

    "btnDisabledBg": THEME.get("primary", "#166B4D"),
    "btnDisabledFg": "#FFFFFF",

    "seriesData":  THEME.get("primary", "#166B4D"),
    "seriesFit":   THEME.get("error",   "#B00020"),
    "seriesResid": THEME.get("text",    "#0B1F14"),

    "link": THEME.get("primary", "#166B4D"),
}

def _rgba_tuple(hex_color: str, a: float):
    """Convert #RRGGBB + alpha → (r,g,b,a) floats in [0,1] for Matplotlib."""
    r, g, b = _hex_to_rgb_tuple(hex_color)
    return (r, g, b, a)

# --- Matplotlib-safe derived tokens (tuples/hex only; NEVER CSS strings) ---
DERIVED_MPL = {
    "grid": _rgba_tuple(THEME["text"], 0.20),      # light neutral grid on white
    "zeroLine": _rgba_tuple(THEME["text"], 0.35),  # dashed 0-line on residuals
    "border_rgb": _hex_to_rgb_tuple(THEME["text"]),# edge/spine color (no alpha)
    "text_hex": THEME["text"],                     # convenience for hex text color
}
def apply_theme_tokens(*, hide_sidebar: bool = False):
    """
    Inject global CSS variables + UI polish.
    If hide_sidebar=True, the sidebar and its toggle are hidden and the content spans full width.
    """
    sidebar_hide_css = """
      /* Hide sidebar + toggle */
      section[data-testid="stSidebar"]{display:none !important;}
      div[data-testid="stSidebarNav"]{display:none !important;}
      button[kind="header"]{display:none !important;} /* collapse control in some versions */
    """ if hide_sidebar else ""

    css = f"""
    <style>
      :root {{
        --background: {THEME['background']};
        --secondary-background: {THEME['secondaryBackground']};
        --text: {THEME['text']};
        --primary: {THEME['primary']};
        --accent: {THEME['accent']};
        --success: {THEME['success']};
        --warning: {THEME['warning']};
        --error:   {THEME['error']};
        --on-primary: {DERIVED['onPrimary']};
        --on-accent:  {DERIVED['onAccent']};
        --border: {DERIVED['border']};
        --muted-text: {DERIVED['mutedText']};
        --focus-ring: {DERIVED['focusRing']};

        /* Banner palette (edit if you switch themes) */
        --banner-bg: #C62828;
        --banner-bg-hover: #D32F2F;
        --banner-border: rgba(255,255,255,0.16);
      }}

      html, body, [data-testid="stAppViewContainer"], .main, .block-container {{
        background: var(--background) !important;
        color: var(--text) !important;
        font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji", sans-serif !important;
      }}

      /* ===========================
         Sidebar (readable on dark bg)
         =========================== */
      section[data-testid="stSidebar"] {{
        background: var(--secondary-background) !important;
        border-right: 1px solid var(--border) !important;
      }}
      section[data-testid="stSidebar"] :is(h1,h2,h3,h4,h5,h6,p,li,span,strong,em,small,label) {{
        color:#FFFFFF !important;
      }}
      section[data-testid="stSidebar"] :is(input, textarea, select) {{
        background:#FFFFFF !important; color:#111111 !important; border:1px solid rgba(0,0,0,.20) !important;
      }}
      section[data-testid="stSidebar"] ::placeholder {{ color:#555 !important; opacity:1 !important; }}
      section[data-testid="stSidebar"] .stMarkdown code:not(pre code) {{
        background:#FFFFFF !important; color:#111111 !important; border:1px solid rgba(0,0,0,.12) !important; border-radius:4px !important; padding:.08em .35em !important;
      }}
      section[data-testid="stSidebar"] .stMarkdown pre, section[data-testid="stSidebar"] .stMarkdown pre code {{
        background:#FFFFFF !important; color:#111111 !important; border:1px solid rgba(0,0,0,.15) !important; border-radius:6px !important;
      }}
      section[data-testid="stSidebar"] [data-baseweb="select"] {{ background:#FFFFFF !important; }}
      section[data-testid="stSidebar"] [data-baseweb="select"] :is(div[role="combobox"], input, *) {{ color:#111111 !important; }}
      [data-baseweb="popover"] [data-baseweb="menu"], [data-baseweb="menu"], div[role="listbox"] {{
        background:#FFFFFF !important; color:#111111 !important; border:1px solid rgba(0,0,0,.18) !important;
      }}
      section[data-testid="stSidebar"] a {{ color:#FFFFFF !important; text-decoration: underline; }}
      section[data-testid="stSidebar"] .stAlert {{
        background:#FFFFFF !important; color:#111111 !important; border:1px solid rgba(0,0,0,.15) !important;
      }}
      section[data-testid="stSidebar"] .stAlert :is(p,div,span,strong,em) {{ color:#111111 !important; }}

      /* ===========================
         Buttons (cohesive look)
         =========================== */
      .stButton>button, .stDownloadButton>button, [data-testid="stAppViewContainer"] button {{
        background: var(--primary) !important; color: var(--on-primary) !important; border: 1px solid var(--primary) !important;
        border-radius: 8px !important; font-weight: 800 !important;
      }}
      .stButton>button:hover, .stDownloadButton>button:hover, [data-testid="stAppViewContainer"] button:hover {{
        box-shadow: 0 6px 24px rgba(0,0,0,.10) !important;
      }}
      .stButton>button:focus-visible, .stDownloadButton>button:focus-visible, [data-testid="stAppViewContainer"] button:focus-visible {{
        outline: 3px solid var(--focus-ring) !important; outline-offset: 2px !important;
      }}

      /* ===========================
         Banner cards (bigger) + Home link
         =========================== */
      .banner-grid {{ display:grid; grid-template-columns: repeat(auto-fit, minmax(300px,1fr)); gap:20px; margin: 8px 0 22px 0; }}
      .banner-card {{
        display:flex; align-items:center; gap:18px; background: var(--banner-bg); color:#FFF;
        border:1px solid var(--banner-border); border-radius:18px; padding:22px 24px; min-height:150px;
        box-shadow:0 10px 28px rgba(0,0,0,.14); transition: transform .12s ease, box-shadow .12s ease, background .12s ease;
        cursor: pointer;
        text-decoration: none !important;     /* no underline on the card itself */
      }}
      .banner-card:hover {{ background: var(--banner-bg-hover); transform: translateY(-2px); box-shadow:0 14px 36px rgba(0,0,0,.16); }}
      .banner-card img, .banner-card .icon {{
        width:72px; height:72px; object-fit:contain; border-radius:12px; background:rgba(255,255,255,.08); padding:8px; flex:0 0 auto;
      }}
      .banner-card .bc-title {{ margin:0; font-weight:800; font-size:1.32rem; line-height:1.15; letter-spacing:-.01em; color:#FFF; text-decoration:none !important; }}
      .banner-card .bc-sub   {{ margin:4px 0 0; font-size:1.02rem; color:#FFFFFFD0; text-decoration:none !important; }}

      /* Remove underline for all nested elements within banner buttons */
      a.banner-card,
      a.banner-card:link,
      a.banner-card:visited,
      a.banner-card:hover,
      a.banner-card:active,
      .banner-card *,
      .banner-card *:link,
      .banner-card *:visited,
      .banner-card *:hover,
      .banner-card *:active {{
        text-decoration: none !important;
      }}

      /* If you use .navcard-style links elsewhere, keep them un-underlined too */
      a.navcard,
      a.navcard:link,
      a.navcard:visited,
      a.navcard:hover,
      a.navcard:active,
      .navcard,
      .navcard * {{
        text-decoration: none !important;
      }}

      /* Pretty Home link (pill) with no underline */
      a.home-link,
      a.home-link:link,
      a.home-link:visited,
      a.home-link:hover,
      a.home-link:active {{
        text-decoration: none !important;
        display:inline-block; background:transparent; color: var(--primary);
        border:1.5px solid var(--primary); border-radius:999px; padding:8px 14px; font-weight:800;
      }}
      a.home-link:hover {{ background: var(--primary); color: var(--on-primary); }}

      /* Optional: hide sidebar when requested */
      {sidebar_hide_css}
    </style>
    """
    st.markdown(css, unsafe_allow_html=True)


apply_theme_tokens(hide_sidebar = st.session_state.get("_view") == "assistant")
def inject_nav_css():
    st.markdown("""
    <style>
      .navgrid{
        display:grid;
        grid-template-columns: repeat(auto-fit,minmax(230px,1fr));
        gap:12px; margin: 8px 0 2px 0;
      }
      .navcard{
        display:flex; align-items:center; gap:12px;
        background:#FFFFFF; border:1px solid var(--border);
        border-radius:16px; padding:14px 16px;
        text-decoration:none !important; color:var(--text) !important;
        box-shadow: 0 8px 20px var(--shadowS);
        transition: transform .12s ease, box-shadow .12s ease;
      }
      .navcard:hover{ transform: translateY(-1px); box-shadow: 0 12px 28px var(--shadowM); }
      .navcard img{ width:40px; height:40px; border-radius:10px; object-fit:contain; }
      .navcard .ttl{ font-weight:800; font-size: 1.02rem; line-height:1.1; }
      .navcard .sub{ margin-top:2px; font-size: .92rem; color: var(--muted-text); }
      .back-link{
        display:inline-block; padding:6px 10px; border-radius:10px;
        background:#FFFFFF; border:1px solid var(--border);
        text-decoration:none; color:var(--text);
        box-shadow: 0 3px 10px var(--shadowS);
      }
      .back-link:hover{ box-shadow: 0 6px 16px var(--shadowM); }
    </style>
    """, unsafe_allow_html=True)


def _render_header():
    st.markdown(
        """
        <div class="app-header">
          <h1>Tau-LY Lab Tools</h1>
          <p>Tired of lab work? You came to the right place — clean fits, clear tables, and shareable results.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

# --- /GitHub button (kept; image badge) ---
if st.session_state.get("_view") != "assistant":
    st.sidebar.markdown(
        """
        <a href="https://github.com/tauly420/fluffy-pancake/tree/main" target="_blank">
            <img src="https://img.shields.io/badge/GitHub-Repository-black?logo=github" alt="GitHub Repo">
        </a>
        """,
        unsafe_allow_html=True
    )
# --- Contact Us button (below the GitHub badge) ---
if st.session_state.get("_view") != "assistant":
    st.sidebar.markdown(
        """
        <div class="sidebar-ctas">
          <a href="https://forms.gle/e8Q1GsFhXuDaywLR9" target="_blank" rel="noopener" class="contact-btn" role="button" aria-label="Contact us">
            📬 Contact us
          </a>
        </div>
        <style>
          /* Scope ONLY to sidebar so nothing else changes */
          section[data-testid="stSidebar"] .sidebar-ctas { margin: 8px 0 12px 0; }

          /* Make it look like your themed buttons */
          section[data-testid="stSidebar"] .sidebar-ctas .contact-btn {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            border-radius: 8px;
            background: var(--primary);
            color: var(--on-primary) !important;
            border: 1px solid var(--primary);
            font-weight: 800;
            text-decoration: none !important; 
        </style>
        """,
        unsafe_allow_html=True
    )

# ------------------------------------------------------------
# CONSTANTS & MESSAGES
# ------------------------------------------------------------
DEFAULT_SIG_DIGITS = 2  # fixed rounding policy for uncertainties
COMPLIMENTS = ["Nice fit!", "Good match!", "Looks great!", "Clean residuals.", "Well done."]
FUNNY_COMMENTS = [
    "Fit quality is questionable. Check the model or data.",
    "Poor agreement — consider a different model.",
    "Model and data disagree noticeably.",
    "This missed the trend."
]
# ------------------------------------------------------------------
# Matplotlib style for Lab Tools charts (white plot bg like reference)
# ------------------------------------------------------------------
MATPLOTLIB_STYLE = {
    # Figure / text
    "figure.dpi": 140,
    "savefig.dpi": 280,
    "font.family": "DejaVu Sans",
    "font.size": 13.0,
    "axes.titlesize": 13.5,
    "axes.labelsize": 12.5,
    "legend.fontsize": 11.5,
    "xtick.labelsize": 11.5,
    "ytick.labelsize": 11.5,

    # Axes / spines
    "axes.facecolor": "#FFFFFF",
    "figure.facecolor": "#FFFFFF",
    "axes.edgecolor": DERIVED_MPL["text_hex"],  # <- hex, not rgba()
    "axes.linewidth": 0.8,

    # Grid (must be RGBA tuple or hex; NOT CSS rgba string)
    "axes.grid": True,
    "grid.color": DERIVED_MPL["grid"],          # <- tuple (r,g,b,a)
    "grid.alpha": 1.0,
    "grid.linewidth": 0.8,
    "grid.linestyle": "-",

    # Color cycle — Okabe–Ito
    "axes.prop_cycle": plt.cycler(color=[
        "#0072B2", "#D55E00", "#009E73", "#CC79A7",
        "#F0E442", "#56B4E9", "#E69F00", "#000000"
    ]),

    # Lines / markers
    "lines.linewidth": 2.4,
    "lines.markersize": 5.5,
    "legend.frameon": True,
    "legend.framealpha": 0.9,
    "legend.edgecolor": DERIVED["border"],  # hex ok here
}

# ============= UI helpers =============

def sympy_syntax_helper():
    """Compact SymPy/LaTeX cheat-sheet for places where expressions are entered."""
    st.markdown(
        """
<details>
<summary><b>SymPy / LaTeX syntax quick help</b></summary>

- Multiplication: `2*x`, Division: `(a+b)/c`
- Power: `x**2` (or LaTeX `x^{2}`)
- Common funcs: `sin(x)`, `cos(x)`, `tan(x)`, `exp(x)`, `sqrt(x)`, `log(x)` (base-10: `log(x,10)`)
- Constants: `pi`, `e` (`E` also works)
- Absolute value: `Abs(x)` (LaTeX `|x|`)
- Fractions/sqrt in LaTeX are supported and auto-expanded: `\\frac{a}{b}`, `\\sqrt{x}`, `\\sqrt[n]{x}`
- Subscripts: `A_1` (LaTeX `A_{1}`)

</details>
        """,
        unsafe_allow_html=True,
    )


def disable_select_typing():
    """
    Make Streamlit's internal BaseWeb select boxes choice-only (no free typing).
    Keeps click-to-open and selection working; disables keyboard text entry.
    """
    st.markdown(
        """
        <style>
        [data-baseweb="select"] input { caret-color: transparent !important; }
        [data-baseweb="select"] input::placeholder { color: transparent !important; }
        </style>
        <script>
        (function(){
          const makeReadOnly = () => {
            document.querySelectorAll('[data-baseweb="select"] input').forEach(inp => {
              if (!inp.hasAttribute('readonly')) {
                inp.setAttribute('readonly', 'readonly');
                inp.setAttribute('aria-readonly', 'true');
              }
            });
          };
          document.addEventListener('DOMContentLoaded', makeReadOnly);
          document.addEventListener('click', makeReadOnly);
          document.addEventListener('keydown', makeReadOnly);
        })();
        </script>
        """,
        unsafe_allow_html=True,
    )


# ============= Ticks & axes helpers (for preview + fit plots) =============


def _nice_tick_step(span: float) -> float:
    """Return a 'nice' major tick step for the given axis span."""
    import math
    if not (isinstance(span, (int, float)) and span > 0):
        return 1.0
    raw = span / 10.0  # aim ~10 major ticks
    base = 10.0 ** math.floor(math.log10(raw))
    for m in (1, 2, 2.5, 5, 10):
        if raw <= m * base:
            return m * base
    return base
disable_select_typing()
def _set_axes_limits_and_ticks(ax, xvals, yvals, *, include_zero=True):
    """
    Set sensible axis limits with nice ticks.
    include_zero=True means: include 0 ONLY if it lies between data min/max.
    """
    import numpy as np

    try:
        x_min = float(np.nanmin(xvals)) if len(xvals) else 0.0
        x_max = float(np.nanmax(xvals)) if len(xvals) else 1.0
        y_min = float(np.nanmin(yvals)) if len(yvals) else 0.0
        y_max = float(np.nanmax(yvals)) if len(yvals) else 1.0
    except Exception:
        x_min, x_max, y_min, y_max = 0.0, 1.0, 0.0, 1.0

    # SMART zero-inclusion: only include 0 if it lies in the data range
    if include_zero:
        if x_min <= 0.0 <= x_max:
            x_min = min(0.0, x_min)
            x_max = max(0.0, x_max)
        if y_min <= 0.0 <= y_max:
            y_min = min(0.0, y_min)
            y_max = max(0.0, y_max)

    xr = x_max - x_min or 1.0
    yr = y_max - y_min or 1.0

    # Add small margins
    ax.set_xlim(x_min - 0.04 * xr, x_max + 0.04 * xr)
    ax.set_ylim(y_min - 0.04 * yr, y_max + 0.04 * yr)

    # Nice ticks
    ax.xaxis.set_major_locator(MultipleLocator(_nice_tick_step(xr)))
    ax.yaxis.set_major_locator(MultipleLocator(_nice_tick_step(yr)))
    ax.xaxis.set_minor_locator(AutoMinorLocator())
    ax.yaxis.set_minor_locator(AutoMinorLocator())

# ---------------------------
# Utilities
# ---------------------------
def copy_text_button(text: str, label: str, key: str):
    """
    Renders a small 'Copy' button (dark green bg, white text) next to content blocks.
    """
    import json as _json
    payload = _json.dumps(text)

    components.html(
        f"""
        <html>
        <head>
          <meta charset="utf-8" />
          <style>
            :root {{
              --background: {THEME['background']};
              --text: {THEME['text']};
              --primary: {THEME['primary']};
              --focus-ring: {DERIVED['focusRing']};
              --radius-s: 8px;
              --on-primary: {DERIVED['onPrimary']};
            }}
            body {{
              margin: 0;
              font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
            }}
            .wrap {{ display: flex; align-items: center; gap: 8px; margin: 6px 0; }}
            .btn {{
              font-weight: 800;
              padding: 6px 10px;
              border-radius: var(--radius-s);
              cursor: pointer;
              background: var(--primary);
              color: var(--on-primary);
              border: 1px solid var(--primary);
            }}
            .btn:hover {{ box-shadow: 0 1px 2px rgba(0,0,0,.10); }}
            .btn:focus-visible {{ outline: 3px solid var(--focus-ring); outline-offset: 2px; }}
            #msg {{ color: var(--text); font-size: 0.9rem; }}
          </style>
        </head>
        <body>
          <div class="wrap">
            <button id="{key}_btn" class="btn">📋 {label}</button>
            <span id="{key}_msg"></span>
          </div>
          <script>
            (function(){{  // IIFE
              const btn = document.getElementById("{key}_btn");
              const msg = document.getElementById("{key}_msg");
              const text = {payload};
              btn.addEventListener('click', async () => {{
                try {{
                  if (navigator.clipboard && navigator.clipboard.writeText) {{
                    await navigator.clipboard.writeText(text);
                  }} else {{
                    const ta = document.createElement('textarea');
                    ta.value = text; document.body.appendChild(ta);
                    ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
                  }}
                  msg.textContent = "Copied!";
                  setTimeout(() => msg.textContent = "", 1200);
                }} catch (e) {{
                  const ta = document.createElement('textarea');
                  ta.value = text; document.body.appendChild(ta);
                  ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
                  msg.textContent = "Copied!";
                  setTimeout(() => msg.textContent = "", 1200);
                }}
              }});
            }})();
          </script>
        </body>
        </html>
        """,
        height=50,
    )

# ======== Agent Context Helpers (put under Utilities) ========
# =========================================
# Fit table context storage (JSON-safe)
# =========================================
def _store_fit_table_context(table_df: pd.DataFrame, latex_table: str | None = None):
    """Save a compact, JSON-safe copy of the latest fit table for the agent."""
    try:
        st.session_state["last_fit_table_df"] = table_df
        try:
            # keep it small and token-friendly
            records = table_df.head(64).to_dict(orient="records")
        except Exception:
            records = [{"_error": "serialize_failed"}]
        st.session_state["last_fit_table_records"] = records
        if isinstance(latex_table, str):
            st.session_state["last_fit_table_latex"] = latex_table
    except Exception:
        # never crash the app because of context storage
        pass

def _json_safe(val):
    """Make values JSON-serializable for the agent context."""
    import numpy as _np
    import pandas as _pd
    if isinstance(val, _np.generic):
        return val.item()
    if isinstance(val, (_pd.Timestamp,)):
        return val.isoformat()
    if isinstance(val, _np.datetime64):
        return _pd.Timestamp(val).isoformat()
    if isinstance(val, (float, int, str, type(None), bool)):
        return val
    try:
        return float(val)
    except Exception:
        try:
            return str(val)
        except Exception:
            return None

def _build_df_context(df: pd.DataFrame, *, name: str | None = None,
                      max_rows: int = 8, max_cols: int = 8) -> Dict[str, object]:
    """Small, token-friendly summary of a DataFrame: columns, dtypes, head, light stats."""
    try:
        cols = [str(c) for c in df.columns[:max_cols]]
        dtypes = {str(c): str(df[c].dtype) for c in cols}

        head_df = df[cols].head(max_rows)
        # Convert head to JSONable rows
        preview_rows = []
        for _, row in head_df.iterrows():
            r = {k: _json_safe(v) for k, v in row.to_dict().items()}
            preview_rows.append(r)

        numeric = df.select_dtypes(include="number")
        stats = {}
        if not numeric.empty:
            desc = numeric.describe().transpose()
            for col in desc.index[:max_cols]:
                d = desc.loc[col]
                stats[col] = {
                    "mean": _json_safe(d.get("mean")),
                    "std":  _json_safe(d.get("std")),
                    "min":  _json_safe(d.get("min")),
                    "max":  _json_safe(d.get("max")),
                }

        return {
            "name": name,
            "shape": [int(df.shape[0]), int(df.shape[1])],
            "columns": cols,
            "dtypes": dtypes,
            "preview_rows": preview_rows,
            "numeric_stats": stats,
        }
    except Exception as e:
        return {"name": name, "error": f"df_summary_failed: {e}"}

def build_agent_context() -> Dict[str, object]:
    """
    Collect the current app state for the assistant:
    - current view, file name, last_df preview, selected columns,
      model selection/expression, last fit params+stats,
      unit converter settings (sidebar + full page), last formula result.
    """
    ctx: Dict[str, object] = {
        "view": st.session_state.get("_view"),
        "files": {},
        "data": {},
        "selections": {},
        "model": {},
        "fit": {},
        "units": {},
        "formula": {},
    }

    # File meta
    if "last_file_name" in st.session_state:
        ctx["files"]["last_file_name"] = st.session_state["last_file_name"]

    # DataFrame (lightweight summary)
    df_latest = st.session_state.get("last_df")
    if isinstance(df_latest, pd.DataFrame) and not df_latest.empty:
        ctx["data"] = _build_df_context(df_latest, name=st.session_state.get("last_file_name"))

    # Selected columns (we’ll store them in session in Patch 2)
    for key in ("colx", "colxerr", "coly", "colyerr"):
        if key in st.session_state:
            ctx["selections"][key] = st.session_state.get(key)

    # Model selection / expression (we’ll store them in session in Patch 3)
    if "model_choice" in st.session_state:
        ctx["model"]["choice"] = st.session_state["model_choice"]
    if "poly_degree" in st.session_state:
        ctx["model"]["poly_degree"] = st.session_state["poly_degree"]
    if "model_expr" in st.session_state:
        ctx["model"]["expression"] = st.session_state["model_expr"]

    # Fit results (parameters + stats)
    if "last_fit_params" in st.session_state:
        # Map: param -> {value, unc}
        ctx["fit"]["params"] = st.session_state["last_fit_params"]
    if "last_fit_stats" in st.session_state:
        ctx["fit"]["stats"] = st.session_state["last_fit_stats"]
    # ----- Fit results table (parameters + stats table) -----
    try:
        recs = st.session_state.get("last_fit_table_records")
        if isinstance(recs, list):
            ctx["fit"]["results_table"] = recs[:64]
        latex = st.session_state.get("last_fit_table_latex")
        if isinstance(latex, str):
            ctx["fit"]["results_table_latex"] = latex
    except Exception:
        pass

    # Formula result
    if "formula_live_result" in st.session_state or "formula_live_unc" in st.session_state:
        ctx["formula"] = {
            "value": st.session_state.get("formula_live_result"),
            "uncertainty": st.session_state.get("formula_live_unc"),
        }

    # Sidebar unit converter (reconstruct units from indexes)
    if "cu_dim" in st.session_state:
        dim = st.session_state.get("cu_dim")
        opts = unit_dimensions.get(dim, [])
        fi = st.session_state.get("cu_from_idx", 0)
        ti = st.session_state.get("cu_to_idx", 0)
        from_u = opts[fi] if 0 <= fi < len(opts) else None
        to_u   = opts[ti] if 0 <= ti < len(opts) else None
        ctx["units"]["sidebar"] = {
            "dimension": dim,
            "from": from_u,
            "to": to_u,
            "value_raw": st.session_state.get("cu_val_raw"),
        }

    # Full-page unit converter
    if "full_dim" in st.session_state:
        ctx["units"]["page"] = {
            "dimension": st.session_state.get("full_dim"),
            "from": st.session_state.get("full_from"),
            "to": st.session_state.get("full_to"),
            "value_raw": st.session_state.get("full_val"),
        }

    return ctx

def scientific_round(value: float, uncertainty: float, sig_digits: int = DEFAULT_SIG_DIGITS) -> str:
    """Return value ± uncertainty using conventional significant-figure rules."""
    if uncertainty == 0 or not np.isfinite(uncertainty):
        return f"{value} ± {uncertainty}"
    order = math.floor(math.log10(abs(uncertainty)))
    factor = 10 ** (sig_digits - 1 - order)
    rounded_unc = round(uncertainty * factor) / factor
    if rounded_unc < 1:
        decimal_places = max(0, -math.floor(math.log10(rounded_unc)))
    else:
        decimal_places = 0
    rounded_val = round(value, decimal_places + 1)
    if rounded_unc < 1e-3 or (abs(rounded_val) < 1e-3 and rounded_val != 0):
        return f"({rounded_val:.{sig_digits}g} ± {rounded_unc:.{sig_digits}g})"
    return f"{rounded_val} ± {rounded_unc}"

def format_sig(x: float, sig: int = 2) -> str:
    if not np.isfinite(x):
        return "NaN"
    if x == 0:
        return "0"
    return f"{x:.{sig}g}"

# --- Safe arithmetic parser for numeric fields ---
def parse_num_expr(s: str) -> float:
    s = str(s).strip()
    if s == "":
        raise ValueError("Empty numeric expression.")
    try:
        node = ast.parse(s, mode="eval")
    except Exception:
        raise ValueError(f"Invalid expression: {s}")

    allowed_binops = (ast.Add, ast.Sub, ast.Mult, ast.Div, ast.Pow, ast.Mod, ast.FloorDiv)

    def _eval(n):
        if isinstance(n, ast.Expression):
            return _eval(n.body)
        if isinstance(n, ast.Constant):  # py>=3.8
            if isinstance(n.value, (int, float)):
                return float(n.value)
            raise ValueError("Non-numeric constant.")
        if isinstance(n, ast.Num):  # py<3.8
            return float(n.n)
        if isinstance(n, ast.BinOp) and isinstance(n.op, allowed_binops):
            left = _eval(n.left); right = _eval(n.right)
            if isinstance(n.op, ast.Add):      return left + right
            if isinstance(n.op, ast.Sub):      return left - right
            if isinstance(n.op, ast.Mult):     return left * right
            if isinstance(n.op, ast.Div):      return left / right
            if isinstance(n.op, ast.FloorDiv): return left // right
            if isinstance(n.op, ast.Mod):      return left % right
            if isinstance(n.op, ast.Pow):      return left ** right
        if isinstance(n, ast.UnaryOp):
            val = _eval(n.operand)
            if isinstance(n.op, ast.UAdd): return +val
            if isinstance(n.op, ast.USub): return -val
        if isinstance(n, ast.Name):
            consts = {"pi": math.pi, "e": math.e, "tau": math.tau}
            if n.id in consts: return float(consts[n.id])
            raise ValueError(f"Unknown name '{n.id}'")
        raise ValueError("Unsupported expression.")

    val = _eval(node)
    if not (isinstance(val, (int, float)) and np.isfinite(val)):
        raise ValueError("Non-finite result.")
    return float(val)


def relative_error_percent(value: float, uncertainty: float, sig: int = 2) -> str:
    if value == 0 or not np.isfinite(value) or not np.isfinite(uncertainty):
        return "—"
    rel = abs(uncertainty / value) * 100.0
    return format_sig(rel, sig)



def n_sigma(v1, u1, v2, u2):
    delta = abs(v1 - v2)
    comb = math.sqrt(max(0.0, u1**2 + u2**2))
    if comb == 0:
        return float('inf') if delta != 0 else 0.0
    return delta / comb

# ================= UNIT HANDLING (unchanged business logic) =================
unit_factors = {
    'm':1.0,'cm':0.01,'mm':0.001,'km':1000.0,
    'µm':1e-6,'nm':1e-9,'pm':1e-12,'Å':1e-10,
    'in':0.0254,'ft':0.3048,'yd':0.9144,'mi':1609.344,
    'au':1.495978707e11,'AU':1.495978707e11,'ly':9.460730472e15,
    's':1.0,'ms':0.001,'µs':1e-6,'ns':1e-9,'min':60.0,'hr':3600.0,
    'kg':1.0,'g':0.001,'mg':1e-6,'lb':0.45359237,
    'm^2':1.0,'cm^2':1e-4,'mm^2':1e-6,'km^2':1e6,'in^2':0.00064516,'ft^2':0.09290304,
    'm^3':1.0,'cm^3':1e-6,'mm^3':1e-9,'L':1e-3,'mL':1e-6,'µL':1e-9,
    'm/s':1.0,'km/h':1000.0/3600.0,'mph':1609.344/3600.0,'cm/s':0.01,
    'N':1.0,'kN':1e3,'mN':1e-3,'lbf':4.4482216152605,
    'J':1.0,'kJ':1e3,'mJ':1e-3,'eV':1.602176634e-19,'keV':1.602176634e-16,
    'MeV':1.602176634e-13,'GeV':1.602176634e-10,'cal':4.184,'kcal':4184.0,
    'W':1.0,'kW':1e3,'mW':1e-3,'µW':1e-6,'hp':745.699872,
    'Pa':1.0,'kPa':1e3,'MPa':1e6,'bar':1e5,'mbar':1e2,'atm':101325.0,
    'Torr':133.32236842105263,'psi':6894.757293168,
    'C':1.0,'mC':1e-3,'µC':1e-6,'nC':1e-9,'pC':1e-12,'e':1.602176634e-19,
    'V':1.0,'kV':1e3,'mV':1e-3,'µV':1e-6,
    'A':1.0,'kA':1e3,'mA':1e-3,'µA':1e-6,
    'Ω':1.0,'ohm':1.0,'kΩ':1e3,'kohm':1e3,'MΩ':1e6,'Mohm':1e6,
    'F':1.0,'mF':1e-3,'µF':1e-6,'nF':1e-9,'pF':1e-12,
    'H':1.0,'mH':1e-3,'µH':1e-6,
    'T':1.0,'mT':1e-3,'µT':1e-6,'G':1e-4,
    'Hz':1.0,'kHz':1e3,'MHz':1e6,'GHz':1e9,
    'rad':1.0,'deg':math.pi/180.0,
}
unit_dimensions = {
    'Length':      ['pm','Å','nm','µm','mm','cm','m','km','in','ft','yd','mi','au','AU','ly'],
    'Time':        ['ns','µs','ms','s','min','hr'],
    'Mass':        ['mg','g','kg','lb'],
    'Area':        ['mm^2','cm^2','m^2','km^2','in^2','ft^2'],
    'Volume':      ['µL','mL','L','cm^3','mm^3','m^3','in^3','ft^3'],
    'Speed':       ['cm/s','m/s','km/h','mph'],
    'Force':       ['mN','N','kN','lbf'],
    'Energy':      ['J','mJ','kJ','eV','keV','MeV','GeV','cal','kcal'],
    'Power':       ['µW','mW','W','kW','hp'],
    'Pressure':    ['Pa','mbar','kPa','MPa','bar','atm','Torr','psi'],
    'Charge':      ['pC','nC','µC','mC','C','e'],
    'Voltage':     ['µV','mV','V','kV'],
    'Current':     ['µA','mA','A','kA'],
    'Resistance':  ['ohm','Ω','kΩ','kohm','MΩ','Mohm'],
    'Capacitance': ['pF','nF','µF','mF','F'],
    'Inductance':  ['µH','mH','H'],
    'Magnetic B':  ['µT','mT','T','G'],
    'Frequency':   ['Hz','kHz','MHz','GHz'],
    'Angle':       ['deg','rad'],
    'Temperature': ['K','degC','degF','degR'],
}
unit_dim_by_symbol = {u: dim for dim, arr in unit_dimensions.items() for u in arr}

def _convert_temperature(value: float, from_unit: str, to_unit: str) -> float:
    fu, tu = from_unit, to_unit
    if fu == 'K': K = value
    elif fu == 'degC': K = value + 273.15
    elif fu == 'degF': K = (value - 32.0) * 5.0/9.0 + 273.15
    elif fu == 'degR': K = value * 5.0/9.0
    else: raise ValueError("Unsupported temperature unit.")
    if tu == 'K': return K
    elif tu == 'degC': return K - 273.15
    elif tu == 'degF': return (K - 273.15) * 9.0/5.0 + 32.0
    elif tu == 'degR': return K * 9.0/5.0
    else: raise ValueError("Unsupported temperature unit.")

def convert_units(value, from_unit, to_unit):
    if from_unit == to_unit:
        return value
    dim_from = unit_dim_by_symbol.get(from_unit)
    dim_to   = unit_dim_by_symbol.get(to_unit)
    if dim_from is None or dim_to is None:
        raise ValueError("Unsupported unit.")
    if dim_from != dim_to:
        raise ValueError("Units are from different dimensions.")
    if dim_from == 'Temperature':
        return _convert_temperature(float(value), from_unit, to_unit)
    if from_unit not in unit_factors or to_unit not in unit_factors:
        raise ValueError("Unsupported unit.")
    return float(value) * unit_factors[from_unit] / unit_factors[to_unit]

# ------- LaTeX → SymPy helpers (unchanged logic) -------
def _strip_latex_wrappers(s: str) -> str:
    s = re.sub(r'^\$+|^\s*\\\(|\\\)\s*$|\$+$', '', s).strip()
    s = s.replace(r'\left', '').replace(r'\right', '')
    return s
def _expand_frac_once(s: str) -> str:
    return re.sub(r'\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}', r'(\1)/(\2)', s)
def _expand_all_frac(s: str) -> str:
    prev = None
    while prev != s:
        prev = s
        s = _expand_frac_once(s)
    return s
def _expand_sqrt(s: str) -> str:
    s = re.sub(r'\\sqrt\[(.+?)\]\{(.+?)\}', r'(\2)**(1/(\1))', s)
    s = re.sub(r'\\sqrt\{(.+?)\}', r'sqrt(\1)', s)
    return s
def latex_to_sympy(latex_str: str) -> str:
    """
    Convert a small LaTeX subset into a SymPy-friendly string.
    Supported: \frac, \sqrt[n]{}, \log_{b}(), |x|, subscripts x_{i}, \times, \cdot, unicode minus.
    NOTE: Expand \frac/\sqrt BEFORE stripping command backslashes.
    """
    if latex_str is None:
        return ""
    s = _strip_latex_wrappers(latex_str.strip())

    # Normalize common unicode math symbols
    s = s.replace('−', '-').replace('×', '*').replace('·', '*')
    # Base logs: \log_{b}(x) or \log_{b}{x} -> log(x,b)
    s = re.sub(r'\\log\s*_\s*\{([^}]+)\}\s*\(([^()]*)\)', r'log(\2,\1)', s)
    s = re.sub(r'\\log\s*_\s*\{([^}]+)\}\s*\{([^}]*)\}', r'log(\2,\1)', s)
    s = re.sub(r'\\log\s*_\s*([A-Za-z0-9]+)\s*\(([^()]*)\)', r'log(\2,\1)', s)
    # Expand fractions/square-roots before stripping command backslashes
    s = _expand_all_frac(s)
    s = _expand_sqrt(s)

    # Absolute value: |x| -> Abs(x)
    s = re.sub(r'\|([^|]+)\|', r'Abs(\1)', s)

    # Subscripts: x_{i} -> x_i (SymPy allows underscores in symbol names)
    s = re.sub(r'([A-Za-z])_\{([^}]+)\}', r'\1_\2', s)

    # Multiplication tokens
    s = s.replace(r'\times', '*').replace(r'\cdot', '*')

    # Drop remaining LaTeX command backslashes (\sin -> sin, etc.)
    s = re.sub(r'\\([A-Za-z]+)', r'\1', s)

    # Powers: ^{...} and bare ^ -> **
    s = re.sub(r'\^\{([^}]*)\}', r'**(\1)', s)
    s = re.sub(r'(?<=\w|\)|\])\^(?=\w|\(|\[)', r'**', s)

    # Replace LaTeX braces with parentheses
    s = s.replace('{', '(').replace('}', ')')

    # Simple implicit multiplication: number/close followed by symbol/open
    s = re.sub(r'(?<=[0-9a-zA-Z\)\]])\s+(?=[A-Za-z\(])', '*', s)

    # Collapse extra spaces
    s = re.sub(r'\s+', ' ', s).strip()
    return s


def _preprocess_for_sympy(expr: str) -> str:
    import re
    s = expr
    s = re.sub(r'log10\s*\(([^()]+)\)', r'log(\1,10)', s)
    s = re.sub(r'(?<!\*)\^(?!=)', '**', s)
    return s
def _implicit_multiplication_cleanup(s: str) -> str:
    s = re.sub(r'(?<=\d)(?=[A-Za-z(])', '*', s)
    s = re.sub(r'(?<=\))(?=[A-Za-z0-9(])', '*', s)
    s = re.sub(r'([A-Z])([A-Z])', r'\1*\2', s)
    s = re.sub(r'([a-z])([A-Z])', r'\1*\2', s)
    return s
def normalize_user_expr(expr_text: str, is_latex: bool) -> str:
    base = latex_to_sympy(expr_text) if is_latex else expr_text
    base = _implicit_multiplication_cleanup(base)
    base = _preprocess_for_sympy(base)
    return base

def propagate_uncertainty_independent(
    formula_str: str,
    values: Dict[str, float],
    uncertainties: Dict[str, float],
    *,
    treat_as_latex: bool = False,
    latex_to_sympy_func=None,
) -> Dict[str, object]:
    to_sympy = latex_to_sympy_func or (lambda s: s)
    expr_txt = to_sympy(formula_str) if treat_as_latex else formula_str
    expr_txt = _preprocess_for_sympy(expr_txt)
    expr = sympify(expr_txt)

    syms = sorted(list(expr.free_symbols), key=lambda s: str(s))
    var_names = [str(s) for s in syms]

    try:
        xvals = [float(values[n]) for n in var_names]
    except KeyError as e:
        missing = str(e).strip("'")
        raise KeyError(f"Missing value for variable '{missing}'") from None

    f_lam = lambdify(tuple(syms), expr, 'numpy')
    f_val = float(f_lam(*xvals))

    grads = {}
    var_sum = 0.0
    for i, si in enumerate(syms):
        di = expr.diff(si)
        di_lam = lambdify(tuple(syms), di, 'numpy')
        gi = float(di_lam(*xvals))
        grads[str(si)] = gi
        sigma_i = float(uncertainties.get(str(si), 0.0))
        var_sum += (gi * sigma_i) ** 2

    unc = math.sqrt(var_sum) if var_sum > 0 else 0.0
    contrib = {n: (grads[n] * float(uncertainties.get(n, 0.0)))**2 for n in var_names}

    return {
        "value": f_val,
        "uncertainty": float(unc),
        "variables": var_names,
        "gradients": grads,
        "contributions": contrib,
    }

# ------- Model building & fitting (unchanged logic) -------
def parse_model_expression(expr_str: str):
    x_sym = symbols('x')
    if expr_str is None or str(expr_str).strip()=="":
        raise ValueError("Empty expression.")
    expr = sympify(expr_str)
    syms = sorted(list(expr.free_symbols), key=lambda s: str(s))
    param_syms = [s for s in syms if str(s) != 'x']
    param_names = [str(s) for s in param_syms]
    lam = lambdify((x_sym, *param_syms), expr, 'numpy')
    def model_fun(x_array, *params):
        return np.array(lam(x_array, *params), dtype=float)
    return param_names, model_fun, str(expr)

def build_predefined_model(choice: str, poly_degree: int = 2, custom_expr: str = None, custom_is_latex: bool = False):
    if choice == "Linear":
        expr = "a*x + b"
    elif choice == "Polynomial":
        coeffs = [f"c{i}" for i in range(poly_degree + 1)]
        terms = []
        for i, c in enumerate(coeffs):
            power = poly_degree - i
            if power == 0: terms.append(f"{c}")
            elif power == 1: terms.append(f"{c}*x")
            else: terms.append(f"{c}*x**{power}")
        expr = " + ".join(terms)
    elif choice == "Exponential":
        expr = "a*exp(b*x) + c"
    elif choice == "Sine":
        expr = "A*sin(w*x + phi) + d"
    elif choice == "Harmonic — Undamped":
        expr = "A*cos(w*x + phi) + d"
    elif choice == "Harmonic — Underdamped (light damping)":
        expr = "A*exp(-gamma_*x)*cos(w*x + phi) + d"
    elif choice == "Harmonic — Critically Damped":
        expr = "(C1 + C2*x)*exp(-lam*x) + d"
    elif choice == "Harmonic — Overdamped (heavy damping)":
        expr = "A1*exp(-r1*x) + A2*exp(-r2*x) + d"
    elif choice == "Fraction":
        expr = "a/(b*x + c) + d"
    elif choice == "Custom":
        if custom_expr is None:
            raise ValueError("Empty custom expression.")
        expr = latex_to_sympy(custom_expr) if custom_is_latex else custom_expr
    else:
        raise ValueError("Unknown model type.")

    return parse_model_expression(expr)

def parse_pasted_table(pasted_text: str) -> pd.DataFrame:
    txt = pasted_text.strip()
    if not txt: raise ValueError("No text provided.")
    first_line = next((ln for ln in txt.splitlines() if ln.strip()), "")
    try:
        if '\t' in first_line and ',' not in first_line:
            return pd.read_csv(io.StringIO(txt), sep='\t')
        if ',' in first_line and '\t' not in first_line:
            return pd.read_csv(io.StringIO(txt), sep=',')
        try:
            return pd.read_csv(io.StringIO(txt), sep=',')
        except Exception:
            try:
                return pd.read_csv(io.StringIO(txt), sep='\t')
            except Exception:
                lines = []
                for ln in txt.splitlines():
                    if not ln.strip(): continue
                    parts = ln.strip().split()
                    lines.append(",".join(parts))
                rebuilt = "\n".join(lines)
                return pd.read_csv(io.StringIO(rebuilt))
    except Exception as e:
        raise RuntimeError(f"Parse error: {e}")

def make_wrapper_from_fixed(base_model_fun, base_param_names: List[str], free_mask: Dict[str, bool], fixed_values: Dict[str, float]):
    def wrapper(x_array, *free_params):
        full_params = []
        free_iter = iter(free_params)
        for name in base_param_names:
            if free_mask.get(name, True):
                full_params.append(next(free_iter))
            else:
                full_params.append(fixed_values[name])
        return base_model_fun(x_array, *full_params)
    return wrapper

def weighted_curve_fit(model_fun: Callable, xdata: np.ndarray, ydata: np.ndarray, yerr: np.ndarray, p0: List[float]):
    sigma = np.asarray(yerr, dtype=float)
    if np.any(sigma == 0):
        nz = sigma[sigma != 0]
        sigma_mean = np.mean(nz) if nz.size > 0 else 1.0
        sigma[sigma == 0] = sigma_mean
    popt, pcov = optimize.curve_fit(
        model_fun, xdata, ydata, p0=p0, sigma=sigma,
        absolute_sigma=True, maxfev=200000
    )
    perr = np.sqrt(np.diag(pcov)) if pcov is not None else np.full_like(popt, np.nan)
    y_fit = model_fun(xdata, *popt)
    residuals = ydata - y_fit
    chi2 = np.sum((residuals / sigma)**2)
    dof = max(0, len(xdata) - len(popt))
    reduced = chi2 / dof if dof > 0 else np.nan
    pvalue = stats.chi2.sf(chi2, dof) if dof > 0 else np.nan
    sst = np.sum((ydata - np.mean(ydata))**2)
    r2 = 1 - np.sum((ydata - y_fit)**2) / sst if sst > 0 else np.nan
    return popt, perr, y_fit, chi2, dof, reduced, pvalue, r2

# ------- Initial guesses (unchanged logic) -------
def _ols_xy(x, y):
    A = np.vstack([x, np.ones_like(x)]).T
    sol, *_ = np.linalg.lstsq(A, y, rcond=None)
    m, c = sol
    return m, c

def auto_initial_guess(
    model_choice: str,
    param_names: List[str],
    x: np.ndarray,
    y: np.ndarray,
    expr_str: str | None = None,
    *,
    fixed_values: Dict[str, float] | None = None,
) -> Dict[str, float]:
    fixed_values = fixed_values or {}
    guesses: Dict[str, float] = {p: 1.0 for p in param_names}
    if len(x) < 2 or len(y) < 2:
        return guesses

    x = np.asarray(x, float); y = np.asarray(y, float)

    d_fixed = float(fixed_values.get("d", np.mean(y)))
    y_demeaned = y - d_fixed
    xspan = float(np.ptp(x)) if np.ptp(x) > 0 else 1.0
    yspan = float(np.ptp(y_demeaned))
    d0 = float(fixed_values.get("d", np.mean(y)))
    A0 = float(0.5 * yspan) or 1.0
    gamma0 = 1.0 / max(xspan, 1.0)

    def _estimate_w0(xv, yv):
        try:
            if len(xv) < 4 or np.ptp(xv) <= 0:
                return 1.0
            xi = np.linspace(xv.min(), xv.max(), len(xv))
            yi = np.interp(xi, xv, yv - np.mean(yv))
            Y = np.abs(np.fft.rfft(yi))
            freqs = np.fft.rfftfreq(len(xi), d=(xi[1]-xi[0]))
            if len(Y) <= 1:
                return 1.0
            k = np.argmax(Y[1:]) + 1
            f = freqs[k] if k < len(freqs) else 1.0
            return 2*np.pi*max(f, 1e-6)
        except Exception:
            return 1.0

    w0 = _estimate_w0(x, y_demeaned)

    def set_if_present(name: str, val: float):
        if name in guesses:
            guesses[name] = float(val)

    try:
        if model_choice == "Linear":
            m, c = _ols_xy(x, y)
            set_if_present("a", m); set_if_present("b", c); return guesses
        if model_choice == "Polynomial":
            deg = len([p for p in param_names if p.startswith('c')]) - 1
            coeffs = np.polyfit(x, y, deg=max(1, deg))
            for i, c_name in enumerate([f"c{i}" for i in range(deg+1)]):
                set_if_present(c_name, coeffs[i]); return guesses
        if model_choice == "Exponential":
            c0 = float(fixed_values.get("c", np.min(y)))
            yy = y - c0
            mask = yy > 0
            if np.count_nonzero(mask) >= 2:
                m, k = _ols_xy(x[mask], np.log(yy[mask])); a0 = float(np.exp(k)); b0 = float(m)
            else:
                a0, b0 = float(np.ptp(y)), 0.0
            set_if_present("a", a0); set_if_present("b", b0); set_if_present("c", c0); return guesses
        if model_choice in ("Sine", "Harmonic — Undamped"):
            set_if_present("d", d0); set_if_present("A", A0); set_if_present("w", w0); set_if_present("phi", 0.0); return guesses
        if model_choice == "Harmonic — Underdamped (light damping)":
            set_if_present("d", d0); set_if_present("A", A0); set_if_present("w", w0); set_if_present("phi", 0.0)
            set_if_present("gamma_", float(fixed_values.get("gamma_", max(gamma0, 1e-6)))); return guesses
        if model_choice == "Harmonic — Critically Damped":
            set_if_present("d", d0); set_if_present("C1", y[0] - d0); set_if_present("C2", 0.0)
            set_if_present("lam", float(fixed_values.get("lam", max(gamma0, 1e-6)))); return guesses
        if model_choice == "Harmonic — Overdamped (heavy damping)":
            set_if_present("d", d0); set_if_present("A1", A0); set_if_present("A2", 0.5*A0)
            set_if_present("r1", float(fixed_values.get("r1", max(3.0*gamma0, 1e-6))))
            set_if_present("r2", float(fixed_values.get("r2", max(0.5*gamma0, 1e-6)))); return guesses
    except Exception:
        pass

    expr = (expr_str or "").lower()
    for cand in ("d", "c", "offset"):
        set_if_present(cand, float(fixed_values.get(cand, d0)))
    for cand in ("A", "amp", "A1", "A2"):
        set_if_present(cand, A0)
    for cand in ("w", "omega"):
        set_if_present(cand, w0)
    set_if_present("phi", 0.0)
    for cand in ("gamma", "lam", "lambda", "gamma_"):
        set_if_present(cand, float(fixed_values.get(cand, max(gamma0, 1e-6))))
    for cand in ("r1", "r2"):
        default_val = (3.0*gamma0) if cand == "r1" else (0.5*gamma0)
        set_if_present(cand, float(fixed_values.get(cand, max(default_val, 1e-6))))
    return guesses


def _apply_pending_state_updates(flag_key: str):
    """
    If st.session_state[flag_key] is a dict {state_key: value, ...},
    apply those updates and remove the flag. Use before creating widgets.
    """
    pending = st.session_state.pop(flag_key, None)
    if isinstance(pending, dict):
        for k, v in pending.items():
            st.session_state[k] = v



def param_controls(model_choice: str, param_names: List[str], xarr: np.ndarray, yarr: np.ndarray, expr_str: str):
    """Parameter UI: check to fit, uncheck to fix. 'Suggest' only touches checked params."""
    st.markdown("**Parameters:** check to fit; uncheck to fix.")

    # ---- Apply pending staged updates BEFORE widgets are created ----
    _apply_pending_state_updates("__apply_guesses__")

    free_mask: Dict[str, bool] = {}
    fixed_values: Dict[str, Optional[float]] = {}
    p0_dict: Dict[str, Optional[float]] = {}

    # Build controls and collect masks/values
    for name in param_names:
        key = f"val_{name}"
        if key not in st.session_state:
            st.session_state[key] = "1.0"

        c1, c2, c3 = st.columns([1, 1.4, 2])
        with c1:
            fit_this = st.checkbox(f"Fit {name}", value=True, key=f"fit_{name}")
        with c2:
            s = st.text_input(f"{'Initial' if fit_this else 'Fixed'} for {name}", key=key)
        with c3:
            st.caption("Relative error (%) will be shown after the fit.")

        try:
            v = parse_num_expr(s)
        except Exception:
            v = 1.0 if fit_this else 0.0

        free_mask[name] = fit_this
        if fit_this:
            p0_dict[name] = v
            fixed_values[name] = None
        else:
            fixed_values[name] = v
            p0_dict[name] = None

    # Button row AFTER masks/values are known
    cg1, _ = st.columns([1, 3])
    # Button row AFTER masks/values are known
    cg1, cg2 = st.columns([1, 3])
    with cg1:
        if st.button("Suggest initial guesses"):
            # Only pass truly fixed values to the heuristic
            fixed_known = {n: float(v) for n, v in fixed_values.items() if v is not None}
            guesses = auto_initial_guess(
                model_choice, param_names, xarr, yarr, expr_str, fixed_values=fixed_known
            )
            # Stage updates ONLY for 'fit' params; apply on next rerun before widgets
            staged = {f"val_{n}": str(guesses.get(n, 1.0)) for n in param_names if free_mask.get(n, True)}
            st.session_state["__apply_guesses__"] = staged
            st.rerun()
    with cg2:
        st.caption(
            "Uses your fixed parameters as context."
            "We still recommend typing physically reasonable estimates from known lab scales."
        )

    free_param_names = [n for n in param_names if free_mask[n]]
    p0 = [p0_dict[n] for n in free_param_names]
    return free_mask, fixed_values, p0, free_param_names


def unit_converter_ui(target):
    """Reusable Unit Converter UI. Pass st.sidebar or st as target."""
    target.markdown("#### Unit conversion")
    dims = list(unit_dimensions.keys())
    if "cu_dim" not in st.session_state:
        st.session_state["cu_dim"] = dims[0]
    dim = target.selectbox("Dimension", dims, key="cu_dim")

    opts = unit_dimensions[dim]
    if "cu_from_idx" not in st.session_state or st.session_state["cu_from_idx"] >= len(opts):
        st.session_state["cu_from_idx"] = 0
    if "cu_to_idx" not in st.session_state or st.session_state["cu_to_idx"] >= len(opts):
        st.session_state["cu_to_idx"] = 1 if len(opts) > 1 else 0

    if st.session_state.get("cu_swap_request", False):
        st.session_state["cu_from_idx"], st.session_state["cu_to_idx"] = (
            st.session_state["cu_to_idx"], st.session_state["cu_from_idx"]
        )
        st.session_state["cu_swap_request"] = False

    from_unit = target.selectbox("From", opts, index=st.session_state["cu_from_idx"])
    to_unit   = target.selectbox("To",   opts, index=st.session_state["cu_to_idx"])
    st.session_state["cu_from_idx"] = opts.index(from_unit)
    st.session_state["cu_to_idx"]   = opts.index(to_unit)

    if target.button("Swap From ↔ To", key="cu_swap"):
        st.session_state["cu_swap_request"] = True
        st.rerun()

    if "cu_val_raw" not in st.session_state:
        st.session_state["cu_val_raw"] = "1"
    cu_val_raw = target.text_input("Value", key="cu_val_raw",
                                   help="Arithmetic allowed: 2*pi, 5*8/3, 1e-3, etc.")

    if target.button("Convert", key="cu_do_convert"):
        try:
            val = parse_num_expr(cu_val_raw)
            res = convert_units(val, from_unit, to_unit)
            target.success(f"{cu_val_raw} {from_unit} = {res:.6g} {to_unit}")
        except Exception as e:
            target.error(str(e))

# ---------------------------
# Sidebar (Tools)
# ---------------------------
def _banner_card(view: str, title: str, subtitle: str, icon_path: str, *, height: int = 190):
    """
    Banner tile rendered as plain HTML in the main DOM (no iframe), so clicks
    update ?view=<view> in the SAME TAB. Uses PNG if found via _to_data_uri, else emoji.
    """
    import html as _html
    src = _to_data_uri(icon_path)

    if src:
        img_html = (
            f'<img src="{src}" alt="" '
            f'style="width:72px;height:72px;object-fit:contain;border-radius:12px;'
            f'background:rgba(255,255,255,.06);padding:8px;" />'
        )
    else:
        emoji = {
            "workflow": "🧪", "unit_only": "📏", "assistant": "🤖",
            "formula_only": "ƒ", "n_sigma_only": "Nσ", "graph_only": "📊"
        }.get(view, "🧰")
        img_html = (
            f'<div class="icon" '
            f'style="display:grid;place-items:center;width:72px;height:72px;'
            f'border-radius:12px;background:rgba(255,255,255,.06);'
            f'font-weight:800;font-size:28px;color:#FFF;">{emoji}</div>'
        )

    t_title = _html.escape(title)
    t_sub   = _html.escape(subtitle)
    t_view  = _html.escape(view)

    # IMPORTANT: target="_self" ensures same-tab; this is injected into the main DOM via st.markdown (no iframe).
    st.markdown(
        f"""
        <a class="banner-card" href="?view={t_view}" target="_self" rel="noopener">
          {img_html}
          <div class="txt">
            <div class="bc-title">{t_title}</div>
            <div class="bc-sub">{t_sub}</div>
          </div>
        </a>
        """,
        unsafe_allow_html=True,
    )



def render_sidebar(
    *,
    github_url: str = "https://github.com/tauly420/fluffy-pancake/tree/main",
    contact_url: str = "https://example.com/contact",
    assistant_icon: str = "🤖",                 # emoji fallback
    assistant_icon_img: str = "chatbot.png",    # local path or URL
    assistant_icon_size: int = 22
):
    # Make the icon available to any full-page AI route
    st.session_state["_assistant_icon"] = assistant_icon

    with st.sidebar:
        # ---------- 3) AI Assistant (compact chat) ----------
        # Build icon HTML (image preferred; emoji fallback)
        icon_src = _to_data_uri(assistant_icon_img) if assistant_icon_img else ""
        if icon_src:
            icon_html = (
                f'<img src="{icon_src}" alt="AI" '
                f'style="width:{assistant_icon_size}px;height:{assistant_icon_size}px;'
                f'vertical-align:-4px;border-radius:4px;margin-right:6px;" />'
            )
        else:
            icon_html = f'<span style="margin-right:6px;">{assistant_icon}</span>'

        # Save for use on full-page AI route too
        st.session_state["_assistant_icon_html"] = icon_html

        st.markdown(
            f'''
            <div style="display:flex;align-items:center;gap:6px;margin:4px 0 8px 0;">
              {icon_html}
              <span style="font-weight:800;font-size:1.05rem;color:#fff;">AI Assistant</span>
            </div>
            ''',
            unsafe_allow_html=True
        )

        # Persist agent + history
        if "_chat_agent" not in st.session_state:
            st.session_state["_chat_agent"] = agent = ChatAgent(system_prompt_path="app/system_prompt.md")

        agent = st.session_state["_chat_agent"]

        if "chat_history" not in st.session_state:
            st.session_state["chat_history"] = [
                {"role": "assistant", "content": "Hi! I’m Tauly,your lab assistant. I specialize in physics labs but you can ask me anything!"}
            ]

        # Avatars for chat bubbles (PNG → data URI; emoji fallback)
        assistant_avatar = _to_data_uri(assistant_icon_img) or "🤖"
        user_avatar = _to_data_uri("user.png") or "🧑"

        # Scrollable messages area
        messages_box = st.container(height=320)
        for msg in st.session_state["chat_history"]:
            avatar = assistant_avatar if msg["role"] == "assistant" else user_avatar
            messages_box.chat_message(msg["role"], avatar=avatar).write(msg["content"])

        # Inline chat input (compact)
        prompt = st.chat_input("Ask the lab assistant…")
        if prompt:
            st.session_state["chat_history"].append({"role": "user", "content": prompt})
            messages_box.chat_message("user", avatar=user_avatar).write(prompt)
            try:
                reply = agent.ask(
                    st.session_state["chat_history"],
                    extra_context=build_agent_context()
                )
                st.session_state["chat_history"].append({"role": "assistant", "content": reply})
                messages_box.chat_message("assistant", avatar=assistant_avatar).write(reply)
            except Exception:
                st.sidebar.error("The AI is temporarily unavailable. Please try again.")

        st.divider()

        # ---------- 4) Unit conversions (existing widget) ----------
        st.markdown("#### Unit conversion")

        dims = list(unit_dimensions.keys())
        if "cu_dim" not in st.session_state:
            st.session_state["cu_dim"] = dims[0]
        dim = st.selectbox("Dimension", dims, key="cu_dim")

        opts = unit_dimensions[dim]
        if "cu_from_idx" not in st.session_state or st.session_state["cu_from_idx"] >= len(opts):
            st.session_state["cu_from_idx"] = 0
        if "cu_to_idx" not in st.session_state or st.session_state["cu_to_idx"] >= len(opts):
            st.session_state["cu_to_idx"] = 1 if len(opts) > 1 else 0

        if st.session_state.get("cu_swap_request", False):
            st.session_state["cu_from_idx"], st.session_state["cu_to_idx"] = (
                st.session_state["cu_to_idx"], st.session_state["cu_from_idx"]
            )
            st.session_state["cu_swap_request"] = False

        from_unit = st.selectbox("From", opts, index=st.session_state["cu_from_idx"])
        to_unit   = st.selectbox("To",   opts, index=st.session_state["cu_to_idx"])
        st.session_state["cu_from_idx"] = opts.index(from_unit)
        st.session_state["cu_to_idx"]   = opts.index(to_unit)

        cols = st.columns([1,1])
        with cols[0]:
            if st.button("Swap From ↔ To", key="cu_swap"):
                st.session_state["cu_swap_request"] = True
                st.rerun()  # safe in button callback

        with cols[1]:
            if "cu_val_raw" not in st.session_state:
                st.session_state["cu_val_raw"] = "1"
            cu_val_raw = st.text_input(
                "Value",
                key="cu_val_raw",
                help="Arithmetic allowed: 2*pi, 5*8/3, 1e-3, etc."
            )

        if st.button("Convert", key="cu_do_convert"):
            try:
                val = parse_num_expr(cu_val_raw)
                res = convert_units(val, from_unit, to_unit)
                st.success(f"{cu_val_raw} {from_unit} = {res:.6g} {to_unit}")
            except Exception as e:
                st.error(str(e))


        # ---------- 6) Quick data stats (existing) ----------
        st.markdown("#### Quick column stats")
        df_latest = st.session_state.get("last_df", None)
        if df_latest is not None and len(df_latest.columns) > 0:
            colnames = [str(c) for c in df_latest.columns]
            if "qs_col" not in st.session_state or st.session_state["qs_col"] not in colnames:
                st.session_state["qs_col"] = colnames[0]
            qs_col = st.selectbox("Column", colnames, index=colnames.index(st.session_state["qs_col"]))
            st.session_state["qs_col"] = qs_col

            import pandas as _pd
            try:
                series = _pd.to_numeric(df_latest[qs_col], errors="coerce").dropna()
                if series.size:
                    desc = series.describe(percentiles=[0.25, 0.5, 0.75])
                    iqr = float(desc["75%"] - desc["25%"])
                    st.write(
                        f"**count**: {int(desc['count'])}  \n"
                        f"**mean**: {desc['mean']:.6g}  \n"
                        f"**std**: {desc['std']:.6g}  \n"
                        f"**min**: {desc['min']:.6g}  \n"
                        f"**median**: {desc['50%']:.6g}  \n"
                        f"**max**: {desc['max']:.6g}  \n"
                        f"**IQR**: {iqr:.6g}"
                    )
                else:
                    st.info("No numeric data in this column.")
            except Exception as e:
                st.error(f"Stats error: {e}")
        else:
            st.info("Load data to use quick stats.")


# ---------------------------
# Data & columns
# ---------------------------
def load_data_ui():
    """
    Data loader UI:
      - Upload file (CSV/Excel)
      - Paste table
      - Demo — Linear
      - Demo - Free Fall  (ASCII dash to avoid Unicode mismatch)
    Always previews first 10 rows when data is available.
    """
    _render_header()

    st.header("Data")
    c1, _ = st.columns([2, 1])
    with c1:
        upload_method = st.radio(
            "Input:",
            ["Upload file", "Paste table", "Demo — Linear", "Demo - Free Fall"],
            horizontal=True
        )

    df = None

    # ---------- Upload file ----------
    if upload_method == "Upload file":
        uploaded = st.file_uploader("CSV/Excel", type=['csv', 'xls', 'xlsx', 'xlsm', 'xlsb'])
        if uploaded:
            try:
                b = uploaded.read()
                name = getattr(uploaded, 'name', '').lower()
                if name.endswith(('.xls', '.xlsx', '.xlsm', '.xlsb')):
                    excel_file = pd.ExcelFile(io.BytesIO(b))
                    if len(excel_file.sheet_names) == 1:
                        sheet = excel_file.sheet_names[0]
                    else:
                        sheet = st.selectbox("Sheet", excel_file.sheet_names)
                    df = pd.read_excel(io.BytesIO(b), sheet_name=sheet)
                    st.success(f"Loaded sheet: {sheet}")
                else:
                    parsed = False
                    for enc in ('utf-8', 'utf-8-sig', 'latin1'):
                        try:
                            text = b.decode(enc)
                            df = pd.read_csv(io.StringIO(text))
                            parsed = True
                            break
                        except Exception:
                            pass
                    if not parsed:
                        # Fallback: try reading via Excel parser
                        df = pd.read_excel(io.BytesIO(b))
                        st.success("Loaded via Excel fallback")
            except Exception as e:
                st.error(f"Read error: {e}")

    # ---------- Paste table ----------
    elif upload_method == "Paste table":
        pasted = st.text_area(
            "Paste table (tabs, commas, spaces)",
            height=220,
            help="Tip: Paste directly from Excel/Sheets/CSV. We'll auto-detect commas, tabs, or space-separated values. Header row optional."
        )
        if pasted.strip():
            try:
                df = parse_pasted_table(pasted)
                st.success(f"Parsed: {len(df.columns)} columns, {len(df)} rows")
            except Exception as e:
                st.error(f"Parse failed: {e}")

    # ---------- Demo — Linear ----------
    elif upload_method == "Demo — Linear":
        st.markdown(
            r"**Demo model:** $y_{\text{true}} = 2.5\,x + 1$  "
            r"with **heteroscedastic** uncertainties: "
            r"$\sigma_x \sim \mathcal{U}(0.02, 0.12)$ and "
            r"$\sigma_y \sim \mathcal{U}(0.15, 0.45)$."
        )
        x = np.linspace(0, 10, 31)
        rng = np.random.default_rng(42)
        xerr = rng.uniform(0.02, 0.12, size=x.shape)
        yerr = rng.uniform(0.15, 0.45, size=x.shape)
        y_true = 2.5 * x + 1
        y = y_true + rng.normal(loc=0.0, scale=yerr)
        df = pd.DataFrame({'x': x, 'x_error': xerr, 'y': y, 'y_error': yerr})
        st.success(
            f"Demo loaded: heteroscedastic errors (mean σx={xerr.mean():.3f}, mean σy={yerr.mean():.3f})."
        )

    # ---------- Demo - Free Fall (ASCII hyphen) ----------
    elif upload_method == "Demo - Free Fall":
        # Physics params
        g_true = 9.81  # m/s^2
        rng = np.random.default_rng()

        # Truncated normal helper
        def _trunc_normal(low, high, mean, std, size=None):
            if size is None:
                while True:
                    v = rng.normal(mean, std)
                    if low <= v <= high:
                        return v
            else:
                out = np.empty(size, dtype=float)
                i = 0
                while i < size:
                    need = size - i
                    samp = rng.normal(mean, std, size=need * 2)
                    samp = samp[(samp >= low) & (samp <= high)]
                    take = min(need, samp.size)
                    out[i:i + take] = samp[:take]
                    i += take
                return out

        # Two significant figures
        def _round_sig2(x):
            try:
                return float(f"{float(x):.2g}")
            except Exception:
                return float(x)

        # Resample y0, v0 until impact time >= 1.0 s
        # Slightly narrower downward range for v0 helps avoid very short flights.
        while True:
            y0 = _round_sig2(_trunc_normal(12.0, 100.0, mean=55.0, std=20.0))
            v0 = _round_sig2(_trunc_normal(-8.0, 10.0, mean=0.0, std=5.0))
            disc = v0 ** 2 + 2 * g_true * y0
            t_hit = (v0 + math.sqrt(disc)) / g_true
            if t_hit >= 1.0:
                break

        # Time samples
        n_pts = 40
        t = np.linspace(0.0, t_hit, n_pts)

        # True and observed y(t)
        y_true = y0 + v0 * t - 0.5 * g_true * (t ** 2)

        # Uncertainties (increase time error noticeably)
        t_sigma = 0.02  # seconds (was 0.005)
        y_sigma = 0.02 * y0 + 0.01 * t_hit + 0.02 * np.abs(y_true)  # meters

        y_obs = y_true + rng.normal(0.0, y_sigma)
        t_err = np.full_like(t, t_sigma)
        y_err = y_sigma

        # Keep only y >= 0
        mask = y_obs >= 0
        if np.count_nonzero(mask) >= 6:
            t, y_obs, t_err, y_err = t[mask], y_obs[mask], t_err[mask], y_err[mask]

        # DataFrame
        df = pd.DataFrame({"t": t, "t_error": t_err, "y": y_obs, "y_error": y_err})

        # LaTeX info & guidance
        st.markdown(
            r"**Free-fall demo:** $y(t) = y_0 + v_0 t - \tfrac{1}{2}\,g\,t^2$  "
            r"with random $(y_0, v_0)$."
        )
        st.markdown(
            rf"- Sampled: $y_0 \approx {format_sig(y0, 3)}\ \mathrm{{m}},\ "
            rf"v_0 \approx {format_sig(v0, 3)}\ \mathrm{{m/s}},\ "
            rf"g = {g_true:.3f}\ \mathrm{{m/s^2}}$."
        )
        st.markdown(
            r"""**Instructions**  
1) In **Model and fit your data**, select **Polynomial** and set **degree = 2**.  
2) Run the fit to obtain y as a function of time, and parameters like Chi squared reduced.  
3) Open the **Formula calculator** and compute g = -2*c0. Use the "load values from fit" button to save time.
4) In **N-sigma**, compare your estimated g with the known g = 9.81 m/s^2."""
        )
        st.success(
            f"Demo loaded: {len(df)} points (time 0 → {t_hit:.3f} s). "
            "Columns: t, t_error, y, y_error."
        )


    # ---------- Post-load preview & state ----------
    if df is None:
        st.info("You can still use the Formula & N-sigma tools below even without loading data.")
        return None

    # Auto preview (first 10 rows)
    st.dataframe(df.head(10), use_container_width=True)

    # Save to session for downstream tools
    st.session_state["last_df"] = df
    return df


def home_link():
    # target="_self" guarantees same-tab navigation; .home-link is already styled in your CSS
    st.markdown(
        '<a class="home-link" href="?view=home" target="_self" rel="noopener">🏠 Home</a>',
        unsafe_allow_html=True
    )


def render_home():
    inject_nav_css()
    _render_header()
    st.subheader("Pick a tool")

    # Row 1
    c1, c2, c3 = st.columns(3, gap="large")
    with c1:
        _banner_card("workflow", "Whole Workflow", "Upload → plot → fit → export", "Workflow.png")
    with c2:
        _banner_card("unit_only", "Unit conversions", "Fast, precise dimensional changes", "unit_conversion.png")
    with c3:
        _banner_card("assistant", "AI Assistant", "Chat helper (also in sidebar)", "chatbot.png")

    # Row 2
    c4, c5, c6 = st.columns(3, gap="large")
    with c4:
        _banner_card("formula_only", "ƒ(x) Formula", "Expressions & uncertainty propagation", "formula_panel.png")
    with c5:
        _banner_card("n_sigma_only", "N-sigma", "Compare A vs B with sigmas", "N-sigma.png")
    with c6:
        _banner_card("graph_only", "Graph + Fit", "Focused plot & fitting", "graph.png")
    st.markdown("---")
    render_about_section("about.txt")  # put your about.txt alongside app.py


def render_formula_only_main():
    home_link()
    formula_panel()   # uses your existing panel

def render_nsigma_only_main():
    home_link()
    nsigma_panel()    # uses your existing panel

def render_graph_only_main():
    home_link()
    st.header("Graph & Fit")
    st.caption("Load or paste data, choose columns, select a model, and fit.")

    # 1) Data
    df = load_data_ui()
    if df is None:
        st.info("Load some data to continue.")
        return

    # 2) Columns (+ built-in scatter preview)
    xarr, yarr, xerr, yerr, colx, coly = select_columns(df)

    # 3) Model + params
    model_choice, poly_degree, param_names, base_model_fun, expr_str = model_ui()
    free_mask, fixed_values, p0, free_param_names = param_controls(
        model_choice, param_names, xarr, yarr, expr_str
    )

    # 4) Labels
    # 4) Labels (compact 2×2 grid)
    l1, l2 = st.columns(2)
    with l1:
        main_xlabel = st.text_input("Main x label", value=colx, key="g_main_xlabel")
    with l2:
        main_ylabel = st.text_input("Main y label", value=coly, key="g_main_ylabel")

    l3, l4 = st.columns(2)
    with l3:
        resid_xlabel = st.text_input("Residuals x label", value=colx, key="g_resid_xlabel")
    with l4:
        resid_ylabel = st.text_input("Residuals y label", value="Residuals", key="g_resid_ylabel")

    # 5) Fit
    wrapper = make_wrapper_from_fixed(
        base_model_fun, param_names, free_mask,
        {n: fixed_values[n] for n in param_names if fixed_values[n] is not None}
    )

    if len(free_param_names) == 0:
        st.warning("All parameters are fixed: evaluating model without fitting.")
        full_values = [fixed_values[n] for n in param_names]
        y_fit = base_model_fun(xarr, *full_values)
        residuals = yarr - y_fit
        chi2 = np.sum((residuals / yerr)**2)
        dof = max(0, len(xarr) - 0)
        reduced = chi2 / dof if dof>0 else np.nan
        pvalue = stats.chi2.sf(chi2, dof) if dof>0 else np.nan
        sst = np.sum((yarr - np.mean(yarr))**2)
        r2 = 1 - np.sum((yarr - y_fit)**2)/sst if sst>0 else np.nan

        st.session_state["last_fit_params"] = {n: {"value": float(full_values[i]), "unc": 0.0}
                                               for i,n in enumerate(param_names)}
        st.session_state["last_fit_stats"] = {
            "chi2": float(chi2),
            "dof": int(dof) if np.isfinite(dof) else None,
            "reduced_chi2": float(reduced) if np.isfinite(reduced) else None,
            "pvalue": float(pvalue) if np.isfinite(pvalue) else None,
            "r2": float(r2) if np.isfinite(r2) else None,
        }

        table_df, latex_table = make_results_tables(
            param_names, {n: full_values[i] for i, n in enumerate(param_names)},
            {n: 0.0 for n in param_names}, chi2, dof, reduced, pvalue, r2
        )
        _store_fit_table_context(table_df, latex_table)
        st.dataframe(table_df, use_container_width=True)

        matplotlib_plot(xarr, yarr, yerr, xerr, base_model_fun, param_names,
                        {n: full_values[i] for i, n in enumerate(param_names)}, {n: 0.0 for n in param_names}, y_fit,
                        main_xlabel, main_ylabel, resid_xlabel, resid_ylabel)
        return

    if st.button("Run fit", key="g_do_fit"):
        try:
            popt, perr, y_fit, chi2, dof, reduced, pvalue, r2 = weighted_curve_fit(wrapper, xarr, yarr, yerr, p0)
            popt_full = {}; perr_map = {}
            free_iter = iter(popt); perr_iter = iter(perr)
            for n in param_names:
                if free_mask[n]:
                    popt_full[n] = next(free_iter); perr_map[n] = next(perr_iter)
                else:
                    popt_full[n] = fixed_values[n]; perr_map[n] = 0.0

            st.success("Fit completed.")
            st.session_state["last_fit_params"] = {
                n: {"value": float(popt_full[n]), "unc": float(perr_map[n])} for n in param_names
            }
            st.session_state["last_fit_stats"] = {
                "chi2": float(chi2),
                "dof": int(dof) if np.isfinite(dof) else None,
                "reduced_chi2": float(reduced) if np.isfinite(reduced) else None,
                "pvalue": float(pvalue) if np.isfinite(pvalue) else None,
                "r2": float(r2) if np.isfinite(r2) else None,
            }

            table_df, latex_table = make_results_tables(param_names, popt_full, perr_map, chi2, dof, reduced, pvalue,
                                                        r2)
            _store_fit_table_context(table_df, latex_table)
            st.dataframe(table_df, use_container_width=True)

            matplotlib_plot(xarr, yarr, yerr, xerr, base_model_fun, param_names, popt_full, perr_map, y_fit,
                            main_xlabel, main_ylabel, resid_xlabel, resid_ylabel)
        except Exception as e:
            st.error(f"Fit error: {e}")


def render_unit_only_main():
    home_link()
    st.header("Unit conversion")
    # Use separate keys to avoid clashing with sidebar converter
    dims = list(unit_dimensions.keys())
    dim = st.selectbox("Dimension", dims, key="full_dim")
    opts = unit_dimensions[dim]
    from_u = st.selectbox("From", opts, key="full_from")
    to_u   = st.selectbox("To",   opts, key="full_to")
    val_raw = st.text_input("Value", value="1", key="full_val",
                            help="Arithmetic allowed: 2*pi, 5*8/3, 1e-3, etc.")
    if st.button("Convert", key="full_convert_btn"):
        try:
            val = parse_num_expr(val_raw)
            res = convert_units(val, from_u, to_u)
            st.success(f"{val_raw} {from_u} = {res:.6g} {to_u}")
        except Exception as e:
            st.error(str(e))

def render_assistant_stub():
    """
    Full-screen AI assistant page:
      - Hides sidebar visuals
      - Same Home pill button as other pages
      - Uses chatbot.png (assistant) and user.png (user) as avatars
    """
    # Hide sidebar only on this page while keeping global theme styles
    try:
        apply_theme_tokens(hide_sidebar=True)
    except Exception:
        pass  # if already injected elsewhere, safe to ignore

    # Top: same Home pill button you use everywhere else
    home_link()

    st.header("Tau-LY AI assistant")

    # Resolve avatars: prefer PNGs; gracefully fall back to emojis
    assistant_avatar = _to_data_uri("chatbot.png") or "🤖"
    user_avatar      = _to_data_uri("user.png")    or "👤"

    # Persist agent + separate full-page history (avoid clobbering sidebar chat)
    if "_chat_agent" not in st.session_state:
        st.session_state["_chat_agent"] = agent = ChatAgent(system_prompt_path="app/system_prompt.md")

    agent = st.session_state["_chat_agent"]

    if "assistant_full_history" not in st.session_state:
        st.session_state["assistant_full_history"] = [
            {"role": "assistant", "content": "Hi! I’m your lab assistant. Ask me anything."}
        ]

    # Render full history with proper avatars
    for msg in st.session_state["assistant_full_history"]:
        avatar = assistant_avatar if msg["role"] == "assistant" else user_avatar
        st.chat_message(msg["role"], avatar=avatar).write(msg["content"])

    # Natural chat input
    prompt = st.chat_input("Ask the lab assistant…")
    if prompt:
        # Show user message immediately
        st.session_state["assistant_full_history"].append({"role": "user", "content": prompt})
        st.chat_message("user", avatar=user_avatar).write(prompt)

        # Get assistant reply
        try:
            reply = agent.ask(
                st.session_state["chat_history"],
                extra_context=build_agent_context()
            )
        except Exception as e:
            reply = "The AI is temporarily unavailable. Please try again."
        st.session_state["assistant_full_history"].append({"role": "assistant", "content": reply})
        st.chat_message("assistant", avatar=assistant_avatar).write(reply)


def select_columns(df):
    st.header("Select Columns")

    if df is None or len(df.columns) == 0:
        st.error("No data loaded yet. Please upload/paste or use a Demo first.")
        st.stop()

    cols = [str(c) for c in df.columns]

    # Heuristics for defaults
    idx_x   = 0
    idx_y   = 2 if len(cols) > 2 else (1 if len(cols) > 1 else 0)
    idx_xe  = 1 if len(cols) > 1 else 0
    idx_ye  = 3 if len(cols) > 3 else 0

    # --- Compact 2×2 layout for selectors ---
    c1, c2 = st.columns(2)
    with c1:
        colx = st.selectbox("x", cols, index=idx_x, key="sel_x")
    with c2:
        coly = st.selectbox("y", cols, index=idx_y, key="sel_y")

    c3, c4 = st.columns(2)
    with c3:
        colxerr = st.selectbox("x error (optional)", ['<none>'] + cols,
                               index=(idx_xe + 1 if len(cols) > 1 else 0), key="sel_xerr")
    with c4:
        colyerr = st.selectbox("y error (optional)", ['<none>'] + cols,
                               index=(idx_ye + 1 if len(cols) > 3 else 0), key="sel_yerr")

    # ---- Convert/clean numeric data ----
    working = df.copy()
    try:
        xarr = pd.to_numeric(working[colx], errors='coerce').to_numpy(dtype=float)
        yarr = pd.to_numeric(working[coly], errors='coerce').to_numpy(dtype=float)
    except Exception as e:
        st.error(f"Column conversion error: {e}")
        st.stop()

    xerr = (pd.to_numeric(working[colxerr], errors='coerce').to_numpy(dtype=float)
            if colxerr != '<none>' else np.zeros_like(xarr))

    if colyerr != '<none>':
        yerr = pd.to_numeric(working[colyerr], errors='coerce').to_numpy(dtype=float)
    else:
        if "yerr_const_raw" not in st.session_state:
            st.session_state["yerr_const_raw"] = "1.0"
        yerr_const_raw = st.text_input("y uncertainty (constant)", key="yerr_const_raw")
        try:
            yerr_const = parse_num_expr(yerr_const_raw)
        except Exception:
            yerr_const = 1.0
            st.warning("Invalid expression for constant y uncertainty; using 1.0")
        yerr = np.full_like(yarr, float(yerr_const), dtype=float)

    valid = np.isfinite(xarr) & np.isfinite(yarr) & np.isfinite(yerr)
    if not np.any(valid):
        st.error("No numeric data after cleaning.")
        st.stop()

    xarr = xarr[valid]; yarr = yarr[valid]; yerr = yerr[valid]; xerr = xerr[valid]

    with st.expander("Scatter preview with error bars", expanded=True):
        with plt.rc_context(MATPLOTLIB_STYLE):
            fig_prev, ax_prev = plt.subplots(1, 1, figsize=(7, 4.5), constrained_layout=True)
            ax_prev.errorbar(xarr, yarr, yerr=yerr, xerr=xerr, fmt='o',
                             color="#0072B2", ecolor='gray', elinewidth=1.0, label="Data")
            ax_prev.set_title("Scatter Graph")
            ax_prev.set_xlabel(colx)
            ax_prev.set_ylabel(coly)
            ax_prev.legend(loc="upper right", frameon=True)
            ax_prev.grid(True)

            # NEW — autoscale properly
            _set_axes_limits_and_ticks(ax_prev, xarr, yarr, include_zero=False)
            ax_prev.grid(which='minor', linestyle=':', linewidth=0.6, alpha=0.6)
            st.pyplot(fig_prev, use_container_width=True)

    return xarr, yarr, xerr, yerr, colx, coly


# ---------------------------
# Model & parameters
# ---------------------------
# --- Insert this helper above model_ui ---

def latex_for_model(choice: str, poly_degree: int = 2, custom_expr: str | None = None, custom_is_latex: bool = False) -> str:
    """
    Return a LaTeX string describing the selected model in nice math form.
    Used for user comfort; not used for computation.
    """
    if choice == "Linear":
        return r"y = a\,x + b"
    if choice == "Polynomial":
        # y = c0 x^n + c1 x^{n-1} + ... + cn
        n = max(1, int(poly_degree))
        terms = [rf"c_0 x^{n}"] + [rf"c_{k} x^{n-k}" for k in range(1, n)]
        terms.append(rf"c_{n}")
        return r"y = " + " + ".join(terms)
    if choice == "Exponential":
        return r"y = a\,e^{b x} + c"
    if choice == "Sine":
        return r"y = A\,\sin(\omega x + \phi) + d"
    if choice == "Harmonic — Undamped":
        return r"y = A\,\cos(\omega x + \phi) + d"
    if choice == "Harmonic — Underdamped (light damping)":
        return r"y = A\,e^{-\gamma x}\cos(\omega x + \phi) + d"
    if choice == "Harmonic — Critically Damped":
        return r"y = (C_1 + C_2 x)\,e^{-\lambda x} + d"
    if choice == "Harmonic — Overdamped (heavy damping)":
        return r"y = A_1 e^{-r_1 x} + A_2 e^{-r_2 x} + d"
    if choice == "Fraction":
        return r"y = \dfrac{a}{b\,x + c} + d"
    if choice == "Custom":
        if custom_expr:
            if custom_is_latex:
                # Already LaTeX-ish: show as-is inside math delimiters.
                return custom_expr
            else:
                # Wrap SymPy-like string in \texttt{} so it's readable in math mode
                safe = custom_expr.replace("\\", r"\backslash ")
                return r"\texttt{" + safe + r"}"
        return r"\text{(enter your custom expression)}"
    return r"\text{(unknown model)}"

def model_ui():
    st.header("Model and fit your data!")

    choices = [
        "Linear",
        "Polynomial",
        "Exponential",
        "Sine",
        "Harmonic — Undamped",
        "Harmonic — Underdamped (light damping)",
        "Harmonic — Critically Damped",
        "Harmonic — Overdamped (heavy damping)",
        "Fraction",
        "Custom",
    ]
    model_choice = st.selectbox("Type", choices, key="model_choice_select")

    # Params for interactive options
    poly_degree = 2
    custom_expr = ""
    custom_is_latex = False

    if model_choice == "Polynomial":
        poly_degree = st.slider("Polynomial degree", 1, 8, 2, key="poly_deg_slider")

    if model_choice == "Custom":
        if "custom_expr" not in st.session_state:
            st.session_state["custom_expr"] = "a*x + b"
        if "custom_is_latex" not in st.session_state:
            st.session_state["custom_is_latex"] = False
        # Use a small “format” toggle here too for parity with Formula panel
        fmt = st.selectbox("Input format", ["SymPy", "LaTeX"], index=0 if not st.session_state["custom_is_latex"] else 1, key="custom_fmt_select")
        st.session_state["custom_is_latex"] = (fmt == "LaTeX")
        custom_is_latex = st.session_state["custom_is_latex"]
        custom_expr = st.text_area("Expression", key="custom_expr")

    # Show a nice LaTeX line for the chosen model
    latex_line = latex_for_model(model_choice, poly_degree, custom_expr, custom_is_latex)
    st.markdown(rf"**Selected model:** ${latex_line}$")

    # Build working SymPy/Numpy expression + function
    try:
        if model_choice == "Custom":
            # Let your existing builder handle conversion
            param_names, model_fun, expr_str = build_predefined_model(
                model_choice, poly_degree, custom_expr if custom_expr else None, custom_is_latex
            )
            st.caption(f"Expression (internal): `{expr_str}`")
            return model_choice, poly_degree, param_names, model_fun, expr_str
        else:
            param_names, model_fun, expr_str = build_predefined_model(model_choice, poly_degree, None, False)
            st.caption(f"Expression (internal): `{expr_str}`")
            return model_choice, poly_degree, param_names, model_fun, expr_str
    except Exception as e:
        st.error(f"Build error: {e}")
        st.stop()

# ------- Plotting -------

def matplotlib_plot(
    xarr, yarr, yerr, xerr,
    _base_model_fun, param_names, popt_full, perr_map,
    y_fit, main_xlabel, main_ylabel, resid_xlabel, resid_ylabel,
    *,
    title_left: str = None,
    title_right: str = None,
    output_basename: str = "fit_and_residuals",
    figsize=(14, 6),
    transparent: bool = False,
    show_in_streamlit: bool = True,
    also_save_pdf: bool = False
):
    import io as _io

    xs = np.linspace(np.min(xarr), np.max(xarr), 1000)
    y_smooth = _base_model_fun(xs, *[popt_full[n] for n in param_names])
    residuals = yarr - y_fit

    c_data = "#0072B2"  # Okabe–Ito blue
    c_fit = "#FF0000"   # fit curve
    c_zero = "#FF0000"  # zero line
    txtcol = DERIVED_MPL["text_hex"]

    with plt.rc_context(MATPLOTLIB_STYLE):
        fig, ax = plt.subplots(1, 2, figsize=figsize, constrained_layout=True)

        # --------------------------- Left: Fit ---------------------------
        ax0 = ax[0]
        ax0.errorbar(
            xarr, yarr, yerr=yerr, xerr=xerr,
            fmt='o', color=c_data, ecolor='gray', elinewidth=1.5, markersize=4,
            label="Data"
        )
        ax0.plot(xs, y_smooth, color=c_fit, linewidth=2.6, label="Fit")

        ax0.set_xlabel(main_xlabel)
        ax0.set_ylabel(main_ylabel)
        ax0.set_title(title_left or f"Fit — {main_ylabel} vs {main_xlabel}")
        ax0.legend(loc="upper right", frameon=True)
        ax0.grid(True)

        # Limits/ticks: include zero when helpful; consider both data and model
        y_all = np.concatenate([yarr, y_smooth])
        _set_axes_limits_and_ticks(ax0, np.concatenate([xarr, xs]), y_all, include_zero=True)

        # ------------------------- Right: Residuals ----------------------
        ax1 = ax[1]
        ax1.errorbar(
            xarr, residuals, yerr=yerr, xerr=xerr,
            fmt='.', color=c_data, ecolor='gray', elinewidth=1.5, markersize=4,
            label="Residuals"
        )
        ax1.axhline(0.0, color=c_zero, linestyle='--', linewidth=1.6, label="0")

        ax1.set_xlabel(resid_xlabel)
        ax1.set_ylabel(resid_ylabel)
        ax1.set_title(title_right or f"Residuals — {main_ylabel} vs {main_xlabel}")
        ax1.legend(loc="upper right", frameon=True)
        ax1.grid(True)

        # Limits/ticks: include residuals ± yerr
        yres_all = np.concatenate([residuals - yerr, residuals + yerr])
        _set_axes_limits_and_ticks(ax1, xarr, yres_all, include_zero=True)

        # ----- Export (unchanged) -----
        face = 'none' if transparent else 'white'
        png_buf = _io.BytesIO()
        svg_buf = _io.BytesIO()
        fig.savefig(png_buf, format="png", bbox_inches="tight", facecolor=face)
        fig.savefig(svg_buf, format="svg", bbox_inches="tight", facecolor=face)
        png_bytes = png_buf.getvalue()
        svg_bytes = svg_buf.getvalue()

        if also_save_pdf:
            pdf_buf = _io.BytesIO()
            fig.savefig(pdf_buf, format="pdf", bbox_inches="tight", facecolor=face)
            pdf_bytes = pdf_buf.getvalue()
        else:
            pdf_bytes = None

        if show_in_streamlit:
            st.pyplot(fig, use_container_width=True)
            st.download_button("Download PNG", data=png_bytes, file_name=f"{output_basename}.png", mime="image/png")
            st.download_button("Download SVG (vector)", data=svg_bytes, file_name=f"{output_basename}.svg", mime="image/svg+xml")
            if pdf_bytes is not None:
                st.download_button("Download PDF (vector)", data=pdf_bytes, file_name=f"{output_basename}.pdf", mime="application/pdf")

        return fig




# ------- Results tables -------
def make_results_tables(param_names, popt_full, perr_map, chi2, dof, reduced, pvalue, r2) -> Tuple[pd.DataFrame, str]:
    rows = []
    for n in param_names:
        val = float(popt_full[n]); unc = float(perr_map[n])
        rows.append({
            "parameter": n,
            "value": val,
            "uncertainty": unc,
            "rounded": scientific_round(val, unc, sig_digits=DEFAULT_SIG_DIGITS),
            "relative error (%)": relative_error_percent(val, unc, sig=2),
            "LaTeX": f"${n} = {scientific_round(val, unc, sig_digits=DEFAULT_SIG_DIGITS)}$"
        })
    stats_rows = [
        {"parameter": "χ²", "value": chi2, "uncertainty": np.nan, "rounded": format_sig(chi2, 3),
         "relative error (%)": "—", "LaTeX": rf"$\chi^2 = {format_sig(chi2,3)}$"},
        {"parameter": "dof (ν)", "value": dof, "uncertainty": np.nan, "rounded": f"{int(dof)}",
         "relative error (%)": "—", "LaTeX": rf"$\nu = {int(dof)}$"},
        {"parameter": "reduced χ²", "value": reduced, "uncertainty": np.nan, "rounded": format_sig(reduced, 3),
         "relative error (%)": "—", "LaTeX": rf"$\chi^2_\nu = {format_sig(reduced,3)}$"},
        {"parameter": "p-value", "value": pvalue, "uncertainty": np.nan, "rounded": format_sig(pvalue, 3),
         "relative error (%)": "—", "LaTeX": rf"$p = {format_sig(pvalue,3)}$"},
        {"parameter": "R²", "value": r2, "uncertainty": np.nan, "rounded": format_sig(r2, 3),
         "relative error (%)": "—", "LaTeX": rf"$R^2 = {format_sig(r2,3)}$"},
    ]
    df = pd.DataFrame(rows + stats_rows)

    latex_lines = [
        r"\begin{tabular}{lcccc}",
        r"\hline",
        r"Parameter & Value & Uncertainty & Rel.\ error (\%) & LaTeX \\",
        r"\hline",
    ]
    for _, r in pd.DataFrame(rows).iterrows():
        latex_lines.append(f"{r['parameter']} & {r['value']:.6g} & {r['uncertainty']:.6g} & {r['relative error (%)']} & {r['LaTeX']} \\\\")
    latex_lines += [
        r"\hline",
        rf"$\chi^2$ & {chi2:.6g} &  &  & $\chi^2 = {format_sig(chi2,3)}$ \\",
        rf"$\nu$ & {int(dof)} &  &  & $\nu = {int(dof)}$ \\",
        rf"$\chi^2_\nu$ & {reduced:.6g} &  &  & $\chi^2_\nu = {format_sig(reduced,3)}$ \\",
        rf"$p$ & {pvalue:.6g} &  &  & $p = {format_sig(pvalue,3)}$ \\",
        rf"$R^2$ & {r2:.6g} &  &  & $R^2 = {format_sig(r2,3)}$ \\",
        r"\hline",
        r"\end{tabular}"
    ]
    latex_table = "\n".join(latex_lines)
    return df, latex_table

def copy_table_button(df: pd.DataFrame, label: str = "Copy table to clipboard", key: str = "copy_tbl"):
    """
    Renders a 'Copy table' button (dark green bg, white text) that copies TSV to clipboard.
    """
    txt = df.to_csv(index=False, sep="\t")
    js_txt = json.dumps(txt)

    components.html(f"""
      <html>
      <head>
        <meta charset="utf-8" />
        <style>
          :root {{
            --background: {THEME['background']};
            --text: {THEME['text']};
            --primary: {THEME['primary']};
            --focus-ring: {DERIVED['focusRing']};
            --radius-s: 8px;
            --on-primary: {DERIVED['onPrimary']};
          }}
          body {{
            margin: 0;
            font-family: Inter, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif;
          }}
          .wrap {{ display: flex; align-items: center; gap: 10px; }}
          .btn {{
            font-weight: 800;
            padding: 6px 10px;
            border-radius: var(--radius-s);
            cursor: pointer;
            background: var(--primary);
            color: var(--on-primary);
            border: 1px solid var(--primary);
          }}
          .btn:hover {{ box-shadow: 0 1px 2px rgba(0,0,0,.10); }}
          .btn:focus-visible {{ outline: 3px solid var(--focus-ring); outline-offset: 2px; }}
          #msg {{ color: var(--text); }}
        </style>
      </head>
      <body>
        <div class="wrap">
          <button id="{key}_btn" class="btn">📋 {label}</button>
          <span id="{key}_msg"></span>
        </div>
        <script>
          (function(){{
            const btn = document.getElementById("{key}_btn");
            const msg = document.getElementById("{key}_msg");
            const text = {js_txt};
            btn.addEventListener('click', async () => {{
              try {{
                if (navigator.clipboard && navigator.clipboard.writeText) {{
                  await navigator.clipboard.writeText(text);
                }} else {{
                  const ta = document.createElement('textarea');
                  ta.value = text; document.body.appendChild(ta);
                  ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
                }}
                msg.textContent = "Copied!";
                setTimeout(() => msg.textContent = "", 1200);
              }} catch (e) {{
                const ta = document.createElement('textarea');
                ta.value = text; document.body.appendChild(ta);
                ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
                msg.textContent = "Copied!";
                setTimeout(() => msg.textContent = "", 1200);
              }}
            }});
          }})();
        </script>
      </body>
      </html>
    """, height=50)

# ---------------------------
# Formula panel (main)
# ---------------------------
def formula_panel():
    st.subheader("Formula calculator")
    st.caption("Tip: If you want to reuse fit results, use the same parameter names (e.g., `A`, `w`, `a`, `d`).")

    # --- Scoped CSS for a nicer format selector + helper box
    st.markdown("""
    <style>
      .symfmt .stSelectbox > div[data-baseweb="select"] {
        border-radius: 999px !important; border-width: 2px !important;
      }
      .symhelp-box {
        border: 1px solid var(--border); border-radius: 12px; padding: 10px 12px;
        background: rgba(0,0,0,0.02);
      }
      .symhelp-box code { font-size: 0.95em; }
    </style>
    """, unsafe_allow_html=True)

    # --- Format toggle (SymPy vs LaTeX) ---
    col_fmt, _ = st.columns([1,3])
    with col_fmt:
        if "main_fc_is_latex" not in st.session_state:
            st.session_state["main_fc_is_latex"] = False
        fmt = st.selectbox("Input format", ["SymPy", "LaTeX"],
                           index=1 if st.session_state["main_fc_is_latex"] else 0,
                           key="fc_fmt_select",
                           help="Choose how you will write the expression.")
        st.session_state["main_fc_is_latex"] = (fmt == "LaTeX")

    # --- Expression textarea ---
    if "main_fc_expr" not in st.session_state:
        st.session_state["main_fc_expr"] = "-2*c0"
    expr_raw = st.text_area("Expression", key="main_fc_expr", height=80)

    # --- Buttons row ---
    cbtn1, cbtn2 = st.columns([1, 1])
    with cbtn1:
        compute_clicked = st.button("Compute", key="compute_formula")
    with cbtn2:
        load_clicked = st.button(
            "Load values from last fit",
            key="load_from_fit",
            help="Fills value/uncertainty boxes for variables that match parameter names from your last fit."
        )

    result_placeholder = st.empty()

    # --- Parse expression & extract variables ---
    vars_list, expr_obj, expr_norm = [], None, None
    is_latex = st.session_state["main_fc_is_latex"]
    if expr_raw.strip():
        try:
            expr_norm = normalize_user_expr(expr_raw, is_latex)
            expr_obj = sympify(expr_norm)
            vars_list = sorted([str(s) for s in expr_obj.free_symbols])
        except Exception:
            expr_obj = None
            vars_list = []

    # --- Load from last fit (prefill values/uncertainties) ---
    if load_clicked:
        last = st.session_state.get("last_fit_params", {})
        if not last:
            st.info("No recent fit found. Run a fit first, then try again.")
        elif not vars_list:
            st.info("Write an expression with variables first (e.g., parameter names from your fit).")
        else:
            for v in vars_list:
                if v in last:
                    st.session_state[f"main_fc_{v}"] = str(last[v]["value"])
                    st.session_state[f"main_fc_unc_{v}"] = str(last[v]["unc"])
            st.rerun()

    # --- Variable inputs (value + uncertainty for each) ---
    st.caption("Enter variable values (and uncertainties):")
    if vars_list:
        cols = st.columns(min(4, max(1, len(vars_list))))
        for i, v in enumerate(vars_list):
            with cols[i % len(cols)]:
                v_key = f"main_fc_{v}"
                u_key = f"main_fc_unc_{v}"
                if v_key not in st.session_state:
                    st.session_state[v_key] = "1.0"
                if u_key not in st.session_state:
                    st.session_state[u_key] = "0.0"
                st.text_input(f"{v} =", key=v_key)
                st.text_input(f"uncertainty({v}) =", key=u_key, help="You can use scientific notation like 1e-3")

    # --- Compute ---
    if compute_clicked:
        if expr_obj is None:
            result_placeholder.info(
                "Please finish writing your expression. If this persists, check syntax in the helper below."
            )
        else:
            vals, uncs, missing = {}, {}, []
            for v in vars_list:
                v_str = st.session_state.get(f"main_fc_{v}", "")
                try:
                    vals[v] = parse_num_expr(v_str)
                except Exception:
                    missing.append(v)
                u_str = st.session_state.get(f"main_fc_unc_{v}", "0")
                try:
                    uncs[v] = parse_num_expr(u_str)
                except Exception:
                    uncs[v] = 0.0

            if missing:
                result_placeholder.warning("Please provide numeric values for: " + ", ".join(missing))
            else:
                try:
                    prop = propagate_uncertainty_independent(
                        formula_str=expr_norm,
                        values=vals,
                        uncertainties=uncs,
                        treat_as_latex=False,
                        latex_to_sympy_func=None,
                    )
                    val = float(prop["value"])
                    unc = float(prop["uncertainty"])
                    rel_txt = "0%" if (val == 0 or unc == 0.0) else f"{format_sig(abs(unc/val)*100, 2)}%"

                    out = f"Result: {val:.6g} ± {unc:.6g}  (relative error {rel_txt})"
                    result_placeholder.success(out)
                    copy_text_button(out, "Copy result", key="copy_formula_plain")

                    st.session_state["formula_live_result"] = val
                    st.session_state["formula_live_unc"] = unc
                except Exception as e:
                    result_placeholder.error(f"Formula evaluation/propagation error: {e}")

    # --- One-click send to N-sigma (A) ---
    if st.button("Send Result → N-sigma (A)"):
        if "formula_live_result" in st.session_state:
            st.session_state["ns_srcA"] = "Formula result"
            st.session_state["last_formula_result"] = float(st.session_state["formula_live_result"])
            st.session_state["last_formula_unc"] = float(st.session_state.get("formula_live_unc", 0.0))
            st.success("Sent current formula result to N-sigma as A.")
        else:
            st.warning("No computed formula result yet.")

    # --- In-panel SymPy / LaTeX helper (not in sidebar) ---
    with st.expander("SymPy / LaTeX cheatsheet (tap for help!)", expanded=False):
        st.markdown("""
        <div class="symhelp-box">
        <ul>
        <li>Sympy:</li>
        <li><code>*</code> for multiplication (e.g., <code>2*x</code>), <code>**</code> for power (e.g., <code>x**2</code>), <code>/</code> for division.</li>
        <li>Functions: <code>sin(x)</code>, <code>cos(x)</code>, <code>tan(x)</code>, <code>exp(x)</code>, <code>sqrt(x)</code>, <code>log(x)</code>.</li>
        <li>Constants: <code>pi</code>, <code>e</code> (or <code>E</code>).</li>
        <li>LaTeX:</li>
        <li><code>\\frac{a}{b}</code>, <code>\\sqrt{x}</code>, <code>\\log_{b}(x)</code>, <code>|x|</code> for absolute value.</li>
        </ul>
        </div>
        """, unsafe_allow_html=True)


def nsigma_panel():
    st.header("N-sigma comparison")

    last = st.session_state.get("last_fit_params", {})
    fit_param_names = list(last.keys())

    src_options = ["Manual", "Fit parameter", "Formula result"]

    cA, cB = st.columns(2)

    with cA:
        st.subheader("Quantity A")
        if "ns_srcA" not in st.session_state:
            st.session_state["ns_srcA"] = "Manual"
        srcA = st.selectbox("Source A", src_options,
                            index=src_options.index(st.session_state["ns_srcA"]),
                            key="ns_srcA_select")
        if srcA == "Manual":
            if "A_val_raw" not in st.session_state: st.session_state["A_val_raw"] = "1.0"
            if "A_unc_raw" not in st.session_state: st.session_state["A_unc_raw"] = "0.1"
            A_val_raw = st.text_input("A value", key="A_val_raw")
            A_unc_raw = st.text_input("A uncertainty", key="A_unc_raw")
            try:
                A_val = parse_num_expr(A_val_raw)
            except Exception:
                A_val = 1.0
                st.warning("Invalid expression for A value; using 1.0")
            try:
                A_unc = parse_num_expr(A_unc_raw)
            except Exception:
                A_unc = 0.1
                st.warning("Invalid expression for A uncertainty; using 0.1")
        elif srcA == "Fit parameter":
            if fit_param_names:
                sel = st.selectbox("Pick parameter", fit_param_names, key="ns_A_pick")
                A_val = last[sel]["value"]; A_unc = last[sel]["unc"]
            else:
                st.info("Run a fit first to use this source.")
                A_val, A_unc = 1.0, 0.1
        else:  # Formula result
            A_val = float(st.session_state.get("last_formula_result", 1.0))
            A_unc = float(st.session_state.get("last_formula_unc", 0.1))

    with cB:
        st.subheader("Quantity B")
        if "ns_srcB" not in st.session_state:
            st.session_state["ns_srcB"] = "Manual"
        srcB = st.selectbox("Source B", src_options,
                            index=src_options.index(st.session_state["ns_srcB"]),
                            key="ns_srcB_select")
        if srcB == "Manual":
            if "B_val_raw" not in st.session_state: st.session_state["B_val_raw"] = "9.81"
            if "B_unc_raw" not in st.session_state: st.session_state["B_unc_raw"] = "0.1"
            B_val_raw = st.text_input("B value", key="B_val_raw")
            B_unc_raw = st.text_input("B uncertainty", key="B_unc_raw")
            try:
                B_val = parse_num_expr(B_val_raw)
            except Exception:
                B_val = 1.2
                st.warning("Invalid expression for B value; using 1.2")
            try:
                B_unc = parse_num_expr(B_unc_raw)
            except Exception:
                B_unc = 0.1
                st.warning("Invalid expression for B uncertainty; using 0.1")
        elif srcB == "Fit parameter":
            if fit_param_names:
                sel = st.selectbox("Pick parameter", fit_param_names, key="ns_B_pick")
                B_val = last[sel]["value"]; B_unc = last[sel]["unc"]
            else:
                st.info("Run a fit first to use this source.")
                B_val, B_unc = 1.2, 0.1
        else:
            B_val = float(st.session_state.get("last_formula_result", 1.2))
            B_unc = float(st.session_state.get("last_formula_unc", 0.1))

    if st.button("Compute N-sigma"):
        ns = n_sigma(float(A_val), float(A_unc), float(B_val), float(B_unc))
        st.success(f"N-sigma = {ns:.6f}")

# ---------------------------
# Main
# ---------------------------
def main():
    view = current_view()
    if view != "assistant":
        render_sidebar()   # normal pages only

    if view == "unit_only":
        render_unit_only_main()
        return

    if view == "assistant":
        render_assistant_stub()
        return

    if view == "formula_only":
        render_formula_only_main()
        return

    if view == "n_sigma_only":
        render_nsigma_only_main()
        return

    if view == "graph_only":
        render_graph_only_main()
        return

    if view == "workflow":
        home_link()
        # --- your existing full workflow block stays the same below ---
        df = load_data_ui()
        if df is None:
            st.markdown("---")
            st.subheader("Math tools")
            formula_panel()
            nsigma_panel()
            return

        xarr, yarr, xerr, yerr, colx, coly = select_columns(df)
        model_choice, poly_degree, param_names, base_model_fun, expr_str = model_ui()
        free_mask, fixed_values, p0, free_param_names = param_controls(model_choice, param_names, xarr, yarr, expr_str)
        wrapper = make_wrapper_from_fixed(
            base_model_fun, param_names, free_mask,
            {n: fixed_values[n] for n in param_names if fixed_values[n] is not None}
        )
        # Labels (compact 2×2 grid, workflow-specific keys)
        wl1, wl2 = st.columns(2)
        with wl1:
            main_xlabel = st.text_input("Main x label", value=colx, key="wf_main_xlabel")
        with wl2:
            main_ylabel = st.text_input("Main y label", value=coly, key="wf_main_ylabel")

        wl3, wl4 = st.columns(2)
        with wl3:
            resid_xlabel = st.text_input("Residuals x label", value=colx, key="wf_resid_xlabel")
        with wl4:
            resid_ylabel = st.text_input("Residuals y label", value="Residuals", key="wf_resid_ylabel")

        if len(free_param_names) == 0:
            st.warning("All parameters are fixed: evaluating model without fitting.")
            full_values = [fixed_values[n] for n in param_names]
            y_fit = base_model_fun(xarr, *full_values)
            residuals = yarr - y_fit
            chi2 = np.sum((residuals / yerr)**2)
            dof = max(0, len(xarr) - 0)
            reduced = chi2 / dof if dof>0 else np.nan
            pvalue = stats.chi2.sf(chi2, dof) if dof>0 else np.nan
            sst = np.sum((yarr - np.mean(yarr))**2)
            r2 = 1 - np.sum((yarr - y_fit)**2)/sst if sst>0 else np.nan

            st.session_state["last_fit_params"] = {n: {"value": float(full_values[i]), "unc": 0.0}
                                                   for i,n in enumerate(param_names)}
            st.session_state["last_fit_stats"] = {
                "chi2": float(chi2),
                "dof": int(dof) if np.isfinite(dof) else None,
                "reduced_chi2": float(reduced) if np.isfinite(reduced) else None,
                "pvalue": float(pvalue) if np.isfinite(pvalue) else None,
                "r2": float(r2) if np.isfinite(r2) else None,
            }

            table_df, latex_table = make_results_tables(
                param_names, {n: full_values[i] for i, n in enumerate(param_names)},
                {n: 0.0 for n in param_names}, chi2, dof, reduced, pvalue, r2
            )
            _store_fit_table_context(table_df, latex_table)
            st.dataframe(table_df, use_container_width=True)
            copy_table_button(table_df, label="Copy table to clipboard (TSV)", key="copy_table_fixed")

            results_df = pd.DataFrame({'x':xarr,'y':yarr,'y_fit':y_fit,'residual':residuals,
                                       'normalized_residual':(residuals/yerr)})
            st.download_button("Download CSV", data=results_df.to_csv(index=False).encode('utf-8'),
                               file_name="fixed_results.csv", mime="text/csv")

            matplotlib_plot(xarr, yarr, yerr, xerr, base_model_fun, param_names,
                            {n: full_values[i] for i, n in enumerate(param_names)}, {n: 0.0 for n in param_names},
                            y_fit, main_xlabel, main_ylabel, resid_xlabel, resid_ylabel)

            formula_panel()
            nsigma_panel()
            return

        if st.button(
                "Run fit",
                help="Fits the selected model to your chosen columns, then shows parameters, stats, plots, and a CSV/PNG results download"
        ):
            try:
                popt, perr, y_fit, chi2, dof, reduced, pvalue, r2 = weighted_curve_fit(wrapper, xarr, yarr, yerr, p0)
                popt_full = {}; perr_map = {}
                free_iter = iter(popt); perr_iter = iter(perr)
                for n in param_names:
                    if free_mask[n]:
                        popt_full[n] = next(free_iter); perr_map[n] = next(perr_iter)
                    else:
                        popt_full[n] = fixed_values[n]; perr_map[n] = 0.0
                st.success("Fit completed.")

                st.session_state["last_fit_params"] = {
                    n: {"value": float(popt_full[n]), "unc": float(perr_map[n])} for n in param_names
                }
                table_df, latex_table = make_results_tables(param_names, popt_full, perr_map, chi2, dof, reduced,
                                                            pvalue, r2)
                _store_fit_table_context(table_df, latex_table)
                st.dataframe(table_df, use_container_width=True)
                copy_table_button(table_df, label="Copy table to clipboard (TSV)", key="copy_table_fit")

                st.write(f"Chi-squared = {chi2:.6g}, dof = {dof}, reduced = {reduced:.6g}, p-value = {pvalue:.3g}, R² = {r2:.4f}")

                results_df = pd.DataFrame({
                    'x':xarr, 'x_error':xerr, 'y':yarr, 'y_error':yerr,
                    'y_fit':y_fit, 'residual':yarr-y_fit,
                    'normalized_residual':(yarr-y_fit)/yerr
                })
                st.download_button("Download CSV", data=results_df.to_csv(index=False).encode('utf-8'),
                                   file_name="fit_results.csv", mime="text/csv")

                matplotlib_plot(xarr, yarr, yerr, xerr, base_model_fun, param_names, popt_full, perr_map, y_fit,
                                main_xlabel, main_ylabel, resid_xlabel, resid_ylabel)
            except Exception as e:
                st.error(f"Fit error: {e}")

        formula_panel()
        nsigma_panel()
        return

    # default: home
    render_home()

if __name__ == '__main__':
    main()
