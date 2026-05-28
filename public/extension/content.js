// ═══════════════════════════════════════════════════════
//  Niche Finder Chrome Extension Content Script
// ═══════════════════════════════════════════════════════

const API_HOST = "https://waqasalee.com"; // Swaps to http://localhost:3000 in dev if needed

// Injects the CSS styles for the beautiful Glassmorphism Action Banner
function injectStyles() {
  if (document.getElementById("nf-extension-styles")) return;
  const style = document.createElement("style");
  style.id = "nf-extension-styles";
  style.textContent = `
    #nf-action-banner {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      z-index: 999999;
      width: 90%;
      max-width: 900px;
      background: rgba(18, 18, 20, 0.85);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 14px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #ffffff;
      transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.4s ease;
      opacity: 0;
    }
    #nf-action-banner.show {
      transform: translateX(-50%) translateY(0);
      opacity: 1;
    }
    .nf-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .nf-avatar {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      border: 2px solid rgba(99, 102, 241, 0.5);
      object-fit: cover;
    }
    .nf-meta h3 {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: -0.3px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .nf-meta p {
      margin: 2px 0 0 0;
      font-size: 11px;
      color: #a1a1aa;
    }
    .nf-outlier-badge {
      font-size: 11px;
      font-weight: 800;
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
      padding: 2.5px 8px;
      border-radius: 9999px;
      border: 1px solid rgba(16, 185, 129, 0.2);
    }
    .nf-right {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .nf-btn {
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.1);
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      padding: 8px 14px;
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      align-items: center;
      gap: 6px;
      text-decoration: none;
    }
    .nf-btn:hover {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateY(-1px);
    }
    .nf-btn-primary {
      background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
      border: none;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
    }
    .nf-btn-primary:hover {
      background: linear-gradient(135deg, #4338ca 0%, #6d28d9 100%);
      box-shadow: 0 6px 16px rgba(99, 102, 241, 0.3);
    }
    .nf-close {
      color: #71717a;
      background: none;
      border: none;
      cursor: pointer;
      font-size: 16px;
      margin-left: 8px;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: all 0.2s ease;
    }
    .nf-close:hover {
      color: #ffffff;
      background: rgba(255, 255, 255, 0.05);
    }
  `;
  document.head.appendChild(style);
}

// Extract channel handles or channelIds from active DOM layouts
function getChannelIdentifier() {
  const path = window.location.pathname;
  
  // 1. Check if we are on a handle route (e.g. /@T-Series)
  if (path.startsWith("/@")) {
    return path.substring(1); // Returns "@T-Series"
  }
  
  // 2. Check standard channel ID urls (e.g. /channel/UCxxxx)
  if (path.startsWith("/channel/")) {
    const parts = path.split("/");
    return parts[2];
  }
  
  return null;
}

async function verifyChannel(identifier) {
  try {
    // Search channel dynamically using Niche Finder API
    const res = await fetch(`${API_HOST}/api/channels?search=${encodeURIComponent(identifier)}&limit=1`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.channels && data.channels.length > 0) {
      const match = data.channels[0];
      // Confirm exact handle match to prevent false search results
      if (identifier.startsWith("@")) {
        if (match.channelHandle?.toLowerCase() === identifier.toLowerCase()) return match;
      } else {
        if (match.channelId === identifier) return match;
      }
    }
  } catch (err) {
    console.error("Niche Finder extension error:", err);
  }
  return null;
}

function mountBanner(channel) {
  // Remove any stale banners first
  const stale = document.getElementById("nf-action-banner");
  if (stale) stale.remove();

  injectStyles();

  const banner = document.createElement("div");
  banner.id = "nf-action-banner";

  const subscribersFmt = channel.subscribers >= 1000000 
    ? (channel.subscribers / 1000000).toFixed(1) + "M"
    : (channel.subscribers / 1000).toFixed(0) + "K";

  banner.innerHTML = `
    <div class="nf-left">
      <img class="nf-avatar" src="${channel.thumbnailUrl || 'https://www.youtube.com/s/desktop/99863c37/img/avatar_placeholder_dark_32.png'}" alt="avatar">
      <div class="nf-meta">
        <h3>
          ${channel.channelName} 
          <span class="nf-outlier-badge">🔥 ${channel.outlierScore.toFixed(2)}x Outlier</span>
        </h3>
        <p>Niche: <strong>${channel.niche || '—'}</strong> · Subs: <strong>${subscribersFmt}</strong> · Monetized: <strong>${channel.isMonetized ? 'Yes' : 'No'}</strong></p>
      </div>
    </div>
    <div class="nf-right">
      <a class="nf-btn nf-btn-primary" href="${API_HOST}/channels/long-form?q=${encodeURIComponent(channel.channelName)}" target="_blank">
        🎯 View In Tool
      </a>
      <button class="nf-btn" id="nf-save-btn">
        💎 Save Channel
      </button>
      <button class="nf-close" id="nf-close-btn" title="Dismiss">✕</button>
    </div>
  `;

  document.body.appendChild(banner);

  // Trigger smooth enter animation
  setTimeout(() => banner.classList.add("show"), 150);

  // Close bindings
  document.getElementById("nf-close-btn").addEventListener("click", () => {
    banner.classList.remove("show");
    setTimeout(() => banner.remove(), 600);
  });

  // Save binding (opens tool save link or logs if session active)
  document.getElementById("nf-save-btn").addEventListener("click", () => {
    window.open(`${API_HOST}/channels/saved?folder=long_form`, "_blank");
  });
}

function checkPage() {
  const identifier = getChannelIdentifier();
  if (!identifier) {
    const banner = document.getElementById("nf-action-banner");
    if (banner) {
      banner.classList.remove("show");
      setTimeout(() => banner.remove(), 600);
    }
    return;
  }

  // Delay lookup slightly to ensure YouTube DOM is fully rewritten
  setTimeout(async () => {
    const channel = await verifyChannel(identifier);
    if (channel) {
      mountBanner(channel);
    }
  }, 1000);
}

// Track navigation changes inside YouTube Polymer SPAs
window.addEventListener("yt-navigate-finish", checkPage);

// Initial bootstrap check
checkPage();
