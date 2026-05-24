#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
#  Niche Finder Daily Collector Cron Wrapper
#  Runs: Daily faceless channels collection via VPS cron job
#  Logs: /var/log/niche_collector.log
# ══════════════════════════════════════════════════════════════════════════════

# 1. Resolve script directory path
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "======================================================================"
echo "🚀 Starting Daily Data Collection: $(date)"
echo "======================================================================"

# 2. Check for python virtual environment or create it
if [ ! -d "venv" ]; then
    echo "📦 Virtual environment 'venv' not found. Creating..."
    python3 -m venv venv
fi

# 3. Activate virtual environment
source venv/bin/activate

# 4. Install/upgrade requirements
echo "📥 Checking and installing python dependencies..."
pip install --upgrade pip -q
pip install -r requirements.txt -q

# 5. Run daily collector
echo "🤖 Launching daily collector..."
python -X utf8 daily_collector.py

DEACTIVATE_STATUS=$?
deactivate

echo "======================================================================"
echo "✅ Finished Daily Data Collection: $(date) | Exit Code: $DEACTIVATE_STATUS"
echo "======================================================================\n"
