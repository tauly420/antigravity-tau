# Quick Task 260404-m1h: Fix tr newline bug in nixpacks.toml

## Problem
`tr \\n :` in single-quoted shell string translates the character `n` to `:`, not newline to colon. Every `n` in LD_LIBRARY_PATH paths was corrupted: `/nix/store/` became `/:ix/store/`, `pango` became `pa:go`, etc. WeasyPrint couldn't find any system libraries.

## Fix
- Replaced `tr \\n :` with `paste -sd:` which correctly joins newline-separated lines with colons
- Added `GDK_PIXBUF_MODULE_FILE` export for image rendering support

## Files Changed
- `nixpacks.toml` — fixed start command
