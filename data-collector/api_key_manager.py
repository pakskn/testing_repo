"""
YouTube API Key Manager — Auto Rotation
==========================================
Jab ek key ka quota (10,000 units) khatam ho,
automatically next key pe shift ho jaata hai.

10 keys = 100,000 units/day!

Usage:
    from api_key_manager import APIKeyManager
    km = APIKeyManager()
    API_KEY = km.get_key()   # use in API calls
    # Agar quota exceed ho:
    API_KEY = km.rotate()    # next key pe shift
"""

import os
import json
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv()

# State file — kaunsi key active hai track karta hai
STATE_FILE = os.path.join(os.path.dirname(__file__), '.key_state.json')


class APIKeyManager:
    def __init__(self):
        self.keys = self._load_keys()
        self.state = self._load_state()
        self._validate()

    def _load_keys(self) -> list:
        """Load all API keys from .env"""
        keys = []
        # Try numbered keys first
        for i in range(1, 11):
            key = os.getenv(f'YOUTUBE_API_KEY_{i}', '').strip()
            if key and not key.startswith('ADD_YOUR'):
                keys.append(key)

        # Fallback: single key
        if not keys:
            single = os.getenv('YOUTUBE_API_KEY', '').strip()
            if single:
                keys.append(single)

        return keys

    def _load_state(self) -> dict:
        """Load state from file"""
        default = {'current_index': 0, 'exhausted': [], 'last_rotated': None}
        try:
            if os.path.exists(STATE_FILE):
                with open(STATE_FILE) as f:
                    return json.load(f)
        except:
            pass
        return default

    def _save_state(self):
        """Save state to file"""
        try:
            with open(STATE_FILE, 'w') as f:
                json.dump(self.state, f, indent=2)
        except:
            pass

    def _validate(self):
        if not self.keys:
            raise ValueError("No YouTube API keys found in .env!")

        # Ensure current_index is valid
        if self.state['current_index'] >= len(self.keys):
            self.state['current_index'] = 0
            self._save_state()

    def get_key(self) -> str:
        """Get current active API key"""
        return self.keys[self.state['current_index']]

    def rotate(self) -> str:
        """
        Mark current key as exhausted, switch to next.
        Returns new key or raises exception if all exhausted.
        """
        current_idx = self.state['current_index']
        current_key = self.keys[current_idx]

        # Mark as exhausted
        if current_key not in self.state['exhausted']:
            self.state['exhausted'].append(current_key)

        # Find next non-exhausted key
        for i in range(len(self.keys)):
            next_idx = (current_idx + 1 + i) % len(self.keys)
            if self.keys[next_idx] not in self.state['exhausted']:
                self.state['current_index'] = next_idx
                self.state['last_rotated'] = datetime.now(timezone.utc).isoformat()
                self._save_state()

                key_num = next_idx + 1
                print(f"\n  🔄 API Key rotated → Key #{key_num} active")
                print(f"     ({len(self.state['exhausted'])}/{len(self.keys)} keys exhausted)")
                return self.keys[next_idx]

        # All keys exhausted
        raise Exception(
            f"\n  ❌ ALL {len(self.keys)} API KEYS EXHAUSTED for today!\n"
            f"  Quota resets at midnight Pacific Time (~1 AM Pakistan)\n"
            f"  Keys used: {len(self.keys)} × 10,000 = {len(self.keys)*10000:,} units total"
        )

    def reset_daily(self):
        """Reset state (call at midnight / next day)"""
        self.state = {'current_index': 0, 'exhausted': [], 'last_rotated': None}
        self._save_state()
        print(f"  ✅ All {len(self.keys)} API keys reset for new day!")

    @property
    def status(self) -> dict:
        """Current status info"""
        return {
            'total_keys': len(self.keys),
            'active_key': f"Key #{self.state['current_index'] + 1}",
            'exhausted': len(self.state['exhausted']),
            'available': len(self.keys) - len(self.state['exhausted']),
            'estimated_units_left': (len(self.keys) - len(self.state['exhausted'])) * 10000,
        }

    def print_status(self):
        s = self.status
        print(f"\n  📊 API Key Status:")
        print(f"     Total keys:    {s['total_keys']}")
        print(f"     Active:        {s['active_key']}")
        print(f"     Exhausted:     {s['exhausted']}")
        print(f"     Available:     {s['available']}")
        print(f"     Units left:    ~{s['estimated_units_left']:,}")


def safe_api_call(func, key_manager: APIKeyManager, max_retries=None):
    """
    Wrapper for any YouTube API call with automatic key rotation.

    Usage:
        result = safe_api_call(
            lambda key: requests.get(url, params={..., 'key': key}).json(),
            key_manager
        )
    """
    if max_retries is None:
        max_retries = key_manager.status['total_keys']

    for attempt in range(max_retries):
        key = key_manager.get_key()
        result = func(key)

        # Check for quota error
        error = result.get('error', {})
        if error.get('code') == 403 and 'quota' in error.get('message', '').lower():
            print(f"  ⚠️  Key #{key_manager.state['current_index']+1} quota exceeded — rotating...")
            try:
                key_manager.rotate()
                continue  # retry with new key
            except Exception as e:
                print(str(e))
                return None

        return result

    return None
