/**
 * Quran Verse Identifier - Floating HUD UI
 * Isolated on-page overlay using Chrome MV3 Shadow DOM
 */

const HUD_ROOT_ID = 'quran-verse-hud-root';

const HUD_CSS = `
/* Quran Verse Identifier - Floating HUD Styles */
@import url('https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Inter:wght@400;500;600;700&display=swap');

:host {
  all: initial;
  position: fixed;
  z-index: 2147483647;
  pointer-events: none;
}

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.quran-hud {
  pointer-events: auto;
  position: fixed;
  top: 24px;
  right: 24px;
  width: 410px;
  max-width: calc(100vw - 32px);
  background: linear-gradient(165deg, rgba(15, 23, 42, 0.97) 0%, rgba(10, 15, 30, 0.98) 100%);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(56, 189, 248, 0.28);
  border-radius: 18px;
  box-shadow: 0 24px 54px -12px rgba(0, 0, 0, 0.72), 0 0 32px rgba(56, 189, 248, 0.14), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  color: #f8fafc;
  font-size: 13px;
  line-height: 1.5;
  user-select: none;
  overflow: hidden;
  transition: box-shadow 0.25s ease, border-color 0.25s ease;
  z-index: 2147483647;
}

.quran-hud.is-minimized {
  width: auto;
  max-width: none;
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  border: none;
  box-shadow: none;
  overflow: visible;
}

/* Header */
.hud-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 11px 16px;
  background: linear-gradient(180deg, rgba(30, 41, 59, 0.9) 0%, rgba(20, 30, 48, 0.85) 100%);
  border-bottom: 1px solid rgba(56, 189, 248, 0.2);
  cursor: grab;
}

.hud-header:active {
  cursor: grabbing;
}

.drag-handle {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.hud-icon {
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  color: #38bdf8;
  filter: drop-shadow(0 0 6px rgba(56, 189, 248, 0.4));
}

.hud-title-container {
  display: flex;
  align-items: center;
  gap: 8px;
  overflow: hidden;
}

.hud-title, .surah-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #f8fafc;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.verse-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 9px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 9999px;
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.45);
  box-shadow: 0 0 8px rgba(16, 185, 129, 0.2);
  white-space: nowrap;
}

.header-controls {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 8px;
}

.header-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  width: 26px;
  height: 26px;
  border-radius: 7px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s ease;
  font-size: 13px;
}

.header-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #f8fafc;
}

.header-btn.close-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

/* Body */
.hud-body {
  padding: 16px 18px;
  max-height: calc(85vh - 56px);
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(56, 189, 248, 0.3) transparent;
}

.hud-body::-webkit-scrollbar {
  width: 5px;
}

.hud-body::-webkit-scrollbar-thumb {
  background: rgba(56, 189, 248, 0.3);
  border-radius: 4px;
}

/* Listening State */
.listening-card {
  text-align: center;
}

.live-rec-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  margin: 0 auto 12px auto;
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.35);
  border-radius: 9999px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #34d399;
  text-transform: uppercase;
}

.live-source-tag {
  background: rgba(16, 185, 129, 0.25);
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 9.5px;
  color: #6ee7b7;
}

.pulse-rec-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 10px #10b981;
  animation: pulse-dot 1.2s infinite ease-in-out;
}

@keyframes pulse-dot {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.35;
    transform: scale(1.3);
  }
}

/* Radar Animation */
.radar-container {
  position: relative;
  width: 72px;
  height: 72px;
  margin: 8px auto 12px auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.radar-wave {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 50%;
  border: 2px solid #38bdf8;
  opacity: 0;
  animation: radar-pulse 2.2s cubic-bezier(0.165, 0.84, 0.44, 1) infinite;
}

.radar-wave:nth-child(2) {
  animation-delay: 0.7s;
}

.radar-wave:nth-child(3) {
  animation-delay: 1.4s;
}

.radar-core {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%);
  box-shadow: 0 0 18px rgba(56, 189, 248, 0.85);
  z-index: 2;
}

@keyframes radar-pulse {
  0% {
    transform: scale(0.2);
    opacity: 0.9;
  }
  100% {
    transform: scale(1.4);
    opacity: 0;
  }
}

/* Audio Visualizer Wave */
.audio-wave-visualizer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 46px;
  margin: 8px auto 12px auto;
  padding: 0 14px;
}

.wave-bar {
  width: 3.5px;
  height: 8px;
  border-radius: 9999px;
  background: linear-gradient(180deg, #38bdf8 0%, #10b981 100%);
  box-shadow: 0 0 8px rgba(56, 189, 248, 0.35);
  animation: wave-bounce 1.1s ease-in-out infinite alternate;
}

@keyframes wave-bounce {
  0% {
    height: 6px;
    opacity: 0.35;
  }
  50% {
    height: var(--h, 32px);
    opacity: 1;
  }
  100% {
    height: 10px;
    opacity: 0.55;
  }
}

/* Status text */
.hud-status {
  text-align: center;
  color: #f1f5f9;
  font-size: 13.5px;
  font-weight: 600;
  margin-bottom: 4px;
}

.hud-status-hint {
  text-align: center;
  font-size: 11.5px;
  color: #94a3b8;
  margin-bottom: 14px;
}

/* Source toggle */
.source-toggle {
  display: flex;
  background: rgba(30, 41, 59, 0.85);
  padding: 3px;
  border-radius: 11px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  margin-bottom: 12px;
  gap: 3px;
}

.toggle-btn {
  flex: 1;
  padding: 7px 12px;
  font-size: 12px;
  font-weight: 500;
  color: #94a3b8;
  background: transparent;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.toggle-btn:hover:not(.active) {
  color: #e2e8f0;
}

.toggle-btn.active {
  background: #38bdf8;
  color: #0f172a;
  font-weight: 700;
  box-shadow: 0 2px 8px rgba(56, 189, 248, 0.35);
}

/* Cancel Button */
.cancel-btn {
  display: block;
  width: 100%;
  text-align: center;
  padding: 8px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 9px;
  color: #94a3b8;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  transition: all 0.15s ease;
}

.cancel-btn:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.3);
}

/* Transcribing & Analyzing State */
.analyzing-card {
  text-align: center;
  padding: 6px 0;
}

.transcribe-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  margin: 0 auto 12px auto;
  background: rgba(56, 189, 248, 0.15);
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-radius: 9999px;
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: #38bdf8;
  text-transform: uppercase;
}

.transcribe-sparkle {
  color: #38bdf8;
  font-size: 12px;
  animation: rotate-sparkle 3s linear infinite;
}

@keyframes rotate-sparkle {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.analyzing-spinner {
  width: 40px;
  height: 40px;
  margin: 10px auto 14px auto;
  border: 3px solid rgba(56, 189, 248, 0.2);
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: hud-spinner-rotate 0.8s linear infinite;
}

@keyframes hud-spinner-rotate {
  to {
    transform: rotate(360deg);
  }
}

.shimmer-track {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  overflow: hidden;
  margin: 14px 0 14px 0;
  position: relative;
}

.shimmer-bar {
  position: absolute;
  top: 0;
  left: -40%;
  width: 40%;
  height: 100%;
  background: linear-gradient(90deg, transparent, #38bdf8, #34d399, transparent);
  border-radius: 9999px;
  animation: shimmer-slide 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
}

@keyframes shimmer-slide {
  0% { left: -40%; }
  100% { left: 100%; }
}

.transcribe-steps {
  display: flex;
  flex-direction: column;
  gap: 7px;
  padding: 10px 14px;
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.07);
  border-radius: 11px;
  text-align: left;
}

.transcribe-step {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 11.5px;
  color: #94a3b8;
}

.transcribe-step.done {
  color: #34d399;
}

.transcribe-step.active {
  color: #38bdf8;
  font-weight: 600;
}

.step-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  font-size: 10px;
}

.transcribe-step.done .step-icon {
  background: rgba(16, 185, 129, 0.2);
  color: #34d399;
}

.transcribe-step.active .step-icon {
  background: rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  animation: pulse-dot 1s infinite alternate;
}

/* Matched State */
.verse-meta-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.85) 100%);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 12px;
  margin-bottom: 12px;
}

.meta-col {
  display: flex;
  flex-direction: column;
}

.meta-label {
  font-size: 9.5px;
  font-weight: 700;
  color: #94a3b8;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  margin-bottom: 2px;
}

.meta-value {
  font-size: 13.5px;
  font-weight: 700;
  color: #f8fafc;
}

.meta-confidence {
  font-size: 11px;
  font-weight: 700;
  color: #38bdf8;
}

/* Arabic Container */
.arabic-container {
  background: radial-gradient(ellipse at top, rgba(16, 185, 129, 0.09) 0%, rgba(15, 23, 42, 0.78) 75%);
  border: 1px solid rgba(16, 185, 129, 0.28);
  border-radius: 14px;
  padding: 16px 18px;
  margin-bottom: 12px;
  text-align: right;
  direction: rtl;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 4px 16px rgba(0, 0, 0, 0.25);
}

.arabic-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.07);
  direction: ltr;
}

.arabic-badge {
  font-size: 10.5px;
  font-weight: 700;
  color: #38bdf8;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.arabic-ornament {
  font-family: 'Amiri', serif;
  font-size: 14px;
  color: #34d399;
}

.arabic-text {
  font-family: 'Amiri', 'Traditional Arabic', 'Scheherazade New', 'Noto Naskh Arabic', serif;
  font-size: 24.5px;
  line-height: 2.18;
  color: #ffffff;
  direction: rtl;
  user-select: text;
  word-spacing: 0.04em;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
}

/* Audio Transcription Row */
.recited-transcript-row {
  background: rgba(30, 41, 59, 0.6);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-radius: 10px;
  padding: 8px 12px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.recited-tag {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #38bdf8;
  font-weight: 700;
  font-size: 10.5px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
}

.recited-text {
  font-family: 'Amiri', serif;
  font-size: 15px;
  color: #6ee7b7;
  direction: rtl;
  text-align: right;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* English Translation Card */
.translation-container {
  background: rgba(15, 23, 42, 0.72);
  border: 1px solid rgba(56, 189, 248, 0.25);
  border-left: 3.5px solid #38bdf8;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 14px;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.2);
}

.translation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.translation-badge {
  font-size: 11px;
  font-weight: 700;
  color: #38bdf8;
  display: flex;
  align-items: center;
  gap: 5px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.translation-icon {
  width: 14px;
  height: 14px;
}

.translation-source {
  font-size: 11px;
  color: #94a3b8;
  font-weight: 500;
}

.translation-text {
  font-size: 13.5px;
  line-height: 1.7;
  color: #e2e8f0;
  user-select: text;
}

/* Actions */
.hud-actions {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.copy-btn, a.quran-link {
  flex: 1;
  min-height: 38px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  white-space: nowrap;
}

.copy-btn {
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(2, 132, 199, 0.25) 100%);
  border: 1px solid rgba(56, 189, 248, 0.4);
  color: #7dd3fc;
  box-shadow: 0 2px 8px rgba(56, 189, 248, 0.15);
}

.copy-btn:hover {
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.3) 0%, rgba(2, 132, 199, 0.35) 100%);
  color: #ffffff;
  border-color: rgba(56, 189, 248, 0.6);
  box-shadow: 0 4px 14px rgba(56, 189, 248, 0.25);
  transform: translateY(-1px);
}

.copy-btn.copied {
  background: rgba(16, 185, 129, 0.25);
  border-color: rgba(16, 185, 129, 0.55);
  color: #6ee7b7;
}

a.quran-link {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #f1f5f9;
}

a.quran-link:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  border-color: rgba(255, 255, 255, 0.25);
  transform: translateY(-1px);
}

.listen-again-btn {
  width: 100%;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  background: rgba(30, 41, 59, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.2s ease;
}

.listen-again-btn:hover {
  background: rgba(56, 189, 248, 0.14);
  border-color: rgba(56, 189, 248, 0.35);
  color: #38bdf8;
  transform: translateY(-1px);
}

/* Minimized Pill Badge */
.hud-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: rgba(15, 23, 42, 0.95);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1px solid rgba(56, 189, 248, 0.35);
  border-radius: 9999px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5), 0 0 16px rgba(56, 189, 248, 0.2);
  color: #38bdf8;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.hud-pill:hover {
  transform: scale(1.04);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.6), 0 0 20px rgba(56, 189, 248, 0.3);
}

.hud-pill .pill-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #10b981;
  box-shadow: 0 0 8px #10b981;
}

/* Error / Notice State */
.error-card {
  background: radial-gradient(circle at center, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.98) 100%);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 14px;
  padding: 18px 16px;
  text-align: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
}

.error-icon {
  font-size: 26px;
  margin-bottom: 8px;
}

.error-title {
  font-size: 13.5px;
  font-weight: 700;
  color: #f8fafc;
  margin-bottom: 6px;
}

.error-message {
  color: #94a3b8;
  font-size: 12px;
  line-height: 1.55;
  margin-bottom: 14px;
}

.error-actions {
  display: flex;
  justify-content: center;
  gap: 8px;
}

.try-again-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 16px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(2, 132, 199, 0.3) 100%);
  border: 1px solid rgba(56, 189, 248, 0.4);
  border-radius: 8px;
  color: #7dd3fc;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.try-again-btn:hover {
  background: rgba(56, 189, 248, 0.32);
  color: #ffffff;
  transform: translateY(-1px);
}

.open-settings-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 8px 16px;
  background: rgba(239, 68, 68, 0.2);
  border: 1px solid rgba(239, 68, 68, 0.45);
  border-radius: 8px;
  color: #fecaca;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.open-settings-btn:hover {
  background: rgba(239, 68, 68, 0.32);
  color: #ffffff;
  transform: translateY(-1px);
}

/* Live Recitation Streaming & Tafsir Styles */
.live-stream-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 2px 7px;
  background: rgba(16, 185, 129, 0.2);
  border: 1px solid rgba(16, 185, 129, 0.45);
  border-radius: 9999px;
  font-size: 10px;
  font-weight: 700;
  color: #34d399;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.hud-stream-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.stream-toggle-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(5, 150, 105, 0.25) 100%);
  border: 1px solid rgba(16, 185, 129, 0.4);
  border-radius: 10px;
  color: #34d399;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.stream-toggle-btn:hover {
  background: rgba(16, 185, 129, 0.28);
  transform: translateY(-1px);
}

.stream-toggle-btn.is-streaming {
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(185, 28, 28, 0.25) 100%);
  border-color: rgba(239, 68, 68, 0.45);
  color: #fca5a5;
}

.stream-toggle-btn.is-streaming:hover {
  background: rgba(239, 68, 68, 0.28);
}

.tafsir-toggle-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.15) 0%, rgba(14, 165, 233, 0.25) 100%);
  border: 1px solid rgba(56, 189, 248, 0.4);
  border-radius: 10px;
  color: #38bdf8;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tafsir-toggle-btn:hover {
  background: rgba(56, 189, 248, 0.28);
  transform: translateY(-1px);
}

.tafsir-toggle-btn.active {
  background: rgba(56, 189, 248, 0.3);
  border-color: #38bdf8;
  color: #ffffff;
}

.tafsir-drawer {
  background: linear-gradient(160deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%);
  border: 1px solid rgba(56, 189, 248, 0.3);
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 12px;
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.tafsir-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.tafsir-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.tafsir-title {
  font-size: 13px;
  font-weight: 700;
  color: #38bdf8;
}

.tafsir-verse-tag {
  font-size: 11px;
  font-weight: 700;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 8px;
  border-radius: 9999px;
}

.tafsir-tabs {
  display: flex;
  gap: 4px;
  background: rgba(15, 23, 42, 0.7);
  padding: 3px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.06);
}

.tafsir-tab {
  flex: 1;
  padding: 5px 8px;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  text-align: center;
}

.tafsir-tab:hover {
  color: #f8fafc;
}

.tafsir-tab.active {
  background: rgba(56, 189, 248, 0.22);
  color: #38bdf8;
  font-weight: 700;
}

.tafsir-sync-pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: 8px;
  font-size: 11px;
  color: #34d399;
  margin-bottom: 10px;
}

.sync-switch-btn {
  padding: 3px 8px;
  background: rgba(16, 185, 129, 0.25);
  border: 1px solid rgba(16, 185, 129, 0.5);
  border-radius: 6px;
  color: #ffffff;
  font-size: 10.5px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.sync-switch-btn:hover {
  background: rgba(16, 185, 129, 0.4);
}

.tafsir-audio-player {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  background: rgba(15, 23, 42, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  margin-bottom: 10px;
}

.tts-play-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  background: linear-gradient(135deg, rgba(56, 189, 248, 0.2) 0%, rgba(2, 132, 199, 0.3) 100%);
  border: 1px solid rgba(56, 189, 248, 0.4);
  border-radius: 6px;
  color: #7dd3fc;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tts-play-btn:hover {
  background: rgba(56, 189, 248, 0.32);
  color: #ffffff;
}

.tts-speed-selector {
  display: flex;
  gap: 4px;
}

.tts-speed-btn {
  padding: 3px 7px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #94a3b8;
  font-size: 10.5px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tts-speed-btn:hover {
  color: #f8fafc;
}

.tts-speed-btn.active {
  background: rgba(56, 189, 248, 0.25);
  border-color: rgba(56, 189, 248, 0.5);
  color: #38bdf8;
  font-weight: 700;
}

.tafsir-content {
  font-size: 12.5px;
  line-height: 1.65;
  color: #e2e8f0;
  user-select: text;
  margin-bottom: 10px;
}

.tafsir-sources-note {
  font-size: 10.5px;
  font-style: italic;
  color: #64748b;
  margin-bottom: 10px;
}

.quran-tafsir-link {
  display: inline-block;
  color: #38bdf8;
  text-decoration: none;
  font-size: 11.5px;
  font-weight: 600;
  margin-top: 4px;
  transition: color 0.15s ease;
}

.quran-tafsir-link:hover {
  color: #7dd3fc;
  text-decoration: underline;
}

.tafsir-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 8px;
  color: #94a3b8;
  font-size: 12px;
}

.tafsir-spinner {
  width: 20px;
  height: 20px;
  border: 2px solid rgba(56, 189, 248, 0.2);
  border-top-color: #38bdf8;
  border-radius: 50%;
  animation: hud-spinner-rotate 0.8s linear infinite;
}

.tafsir-error {
  padding: 12px;
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  border-radius: 8px;
  color: #fca5a5;
  font-size: 12px;
  text-align: center;
}

.tafsir-retry-btn {
  margin-top: 8px;
  padding: 4px 12px;
  background: rgba(239, 68, 68, 0.25);
  border: 1px solid rgba(239, 68, 68, 0.5);
  border-radius: 6px;
  color: #ffffff;
  font-size: 11px;
  cursor: pointer;
}
`;

// Global component state
let activeCallbacks = {};
let currentState = 'listening';
let currentData = {};
let previousState = 'listening';
let previousData = {};
let cleanupDragListeners = null;

// Tafsir & Streaming state
let tafsirOpen = false;
let tafsirLoading = false;
let tafsirError = null;
let activeTafsirMode = 'quick';
let activeTafsirVerseKey = null;
const tafsirCache = new Map();
let isSpeaking = false;
let ttsRate = 1;
let activeUtterance = null;

function stopTts() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {}
  }
  isSpeaking = false;
  activeUtterance = null;
}

function playTts(text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (!text) return;

  if (window.speechSynthesis.speaking && isSpeaking) {
    try {
      window.speechSynthesis.pause();
    } catch {}
    isSpeaking = false;
    rerenderHud();
    return;
  }

  if (window.speechSynthesis.paused) {
    try {
      window.speechSynthesis.resume();
    } catch {}
    isSpeaking = true;
    rerenderHud();
    return;
  }

  stopTts();

  if (typeof SpeechSynthesisUtterance !== 'undefined') {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = ttsRate;
    utterance.lang = 'en-US';

    utterance.onend = () => {
      isSpeaking = false;
      activeUtterance = null;
      rerenderHud();
    };

    utterance.onerror = () => {
      isSpeaking = false;
      activeUtterance = null;
      rerenderHud();
    };

    activeUtterance = utterance;
    isSpeaking = true;
    try {
      window.speechSynthesis.speak(utterance);
    } catch {}
    rerenderHud();
  }
}

async function loadTafsir(verseData, surah, ayah, mode) {
  const verseKey = activeTafsirVerseKey || verseData?.verseKey || `${surah}:${ayah}`;
  const cacheKey = `${verseKey}:${mode}`;
  if (tafsirCache.has(cacheKey)) {
    tafsirLoading = false;
    tafsirError = null;
    rerenderHud();
    return;
  }

  tafsirLoading = true;
  tafsirError = null;
  rerenderHud();

  try {
    if (activeCallbacks.onRequestTafsir) {
      const res = await activeCallbacks.onRequestTafsir(verseData, surah, ayah, mode);
      if (res && res.text) {
        tafsirCache.set(cacheKey, res);
      }
    }
  } catch (err) {
    tafsirError = err?.message || 'Failed to load Tafsir reflections.';
  } finally {
    tafsirLoading = false;
    rerenderHud();
  }
}

function rerenderHud() {
  const root = document.getElementById(HUD_ROOT_ID);
  if (!root || !root.shadowRoot) return;
  const hud = root.shadowRoot.querySelector('.quran-hud');
  if (!hud) return;
  renderHud(root.shadowRoot, hud, currentState, currentData);
}

/**
 * Checks if the Floating HUD root container is attached to document.
 * @returns {boolean}
 */
export function isHudMounted() {
  return Boolean(document.getElementById(HUD_ROOT_ID));
}

/**
 * Mounts the Floating HUD container with an isolated Shadow Root.
 * If already mounted, updates callbacks and returns existing container.
 *
 * @param {object} [callbacks={}]
 * @param {function} [callbacks.onSourceChange]
 * @param {function} [callbacks.onCancel]
 * @param {function} [callbacks.onLanguageChange]
 * @returns {HTMLElement} The root element containing the Shadow Root
 */
export function mountFloatingHud(callbacks = {}) {
  activeCallbacks = { ...activeCallbacks, ...callbacks };

  let root = document.getElementById(HUD_ROOT_ID);
  if (root) {
    return root;
  }

  root = document.createElement('div');
  root.id = HUD_ROOT_ID;

  const shadow = root.attachShadow({ mode: 'open' });

  // Inject stylesheet into shadow root
  const styleEl = document.createElement('style');
  styleEl.textContent = HUD_CSS;
  shadow.appendChild(styleEl);

  // Main HUD element
  const hud = document.createElement('div');
  hud.className = 'quran-hud';
  shadow.appendChild(hud);

  // Setup bounds-clamped dragging
  cleanupDragListeners = initDragging(shadow, hud);

  // Mount to body (or documentElement if body not ready)
  const targetParent = document.body || document.documentElement;
  targetParent.appendChild(root);

  // Render initial state
  currentState = 'listening';
  currentData = { source: 'tab' };
  renderHud(shadow, hud, currentState, currentData);

  return root;
}

/**
 * Updates the state and data of the HUD.
 *
 * @param {'listening' | 'analyzing' | 'matched' | 'error' | 'minimized'} state
 * @param {object} [data={}]
 */
export function updateHudState(state, data = {}) {
  const root = document.getElementById(HUD_ROOT_ID);
  if (!root || !root.shadowRoot) return;

  const hud = root.shadowRoot.querySelector('.quran-hud');
  if (!hud) return;

  if (state !== 'minimized') {
    previousState = state;
    previousData = { ...data };
  }

  currentState = state;
  currentData = { ...data };

  renderHud(root.shadowRoot, hud, currentState, currentData);
}

/**
 * Cleans up and removes the HUD from the DOM.
 */
export function destroyFloatingHud() {
  stopTts();
  tafsirOpen = false;
  tafsirLoading = false;
  tafsirError = null;
  activeTafsirMode = 'quick';
  activeTafsirVerseKey = null;
  tafsirCache.clear();

  if (cleanupDragListeners) {
    cleanupDragListeners();
    cleanupDragListeners = null;
  }

  const root = document.getElementById(HUD_ROOT_ID);
  if (root && root.parentNode) {
    root.parentNode.removeChild(root);
  }

  activeCallbacks = {};
  currentState = 'listening';
  currentData = {};
  previousState = 'listening';
  previousData = {};
}

/**
 * Generates the HTML for the Tafsir Drawer inside the HUD.
 */
function renderTafsirDrawerHtml(data) {
  const verseKey = activeTafsirVerseKey || data.verseKey || '';
  const cacheKey = `${verseKey}:${activeTafsirMode}`;
  const currentTafsir = tafsirCache.get(cacheKey);

  const parts = verseKey.split(':');
  const surahNum = parts[0] || data.surahNumber || 1;
  const ayahNum = parts[1] || data.ayahStart || 1;
  const classicalUrl = currentTafsir?.quranComUrl || `https://quran.com/${surahNum}/${ayahNum}/tafsirs`;

  const isSyncMismatch = Boolean(data.verseKey && activeTafsirVerseKey && data.verseKey !== activeTafsirVerseKey);

  let bodyContent = '';
  if (tafsirLoading) {
    bodyContent = `
      <div class="tafsir-loading">
        <div class="tafsir-spinner"></div>
        <span>Synthesizing reflections from Ibn Kathir, Ma'arif al-Qur'an & Tazkirul Quran...</span>
      </div>
    `;
  } else if (tafsirError) {
    bodyContent = `
      <div class="tafsir-error">
        <p>${escapeHtml(tafsirError)}</p>
        <button class="tafsir-retry-btn">Retry</button>
      </div>
    `;
  } else {
    bodyContent = `
      <div class="tafsir-audio-player">
        <button class="tts-play-btn">${isSpeaking ? '⏸ Pause Audio' : '🔊 Listen to Tafsir'}</button>
        <div class="tts-speed-selector">
          <button class="tts-speed-btn ${ttsRate === 1 ? 'active' : ''}" data-rate="1">1x</button>
          <button class="tts-speed-btn ${ttsRate === 1.25 ? 'active' : ''}" data-rate="1.25">1.25x</button>
          <button class="tts-speed-btn ${ttsRate === 1.5 ? 'active' : ''}" data-rate="1.5">1.5x</button>
        </div>
      </div>
      <div class="tafsir-content">${escapeHtml(currentTafsir?.text || '')}</div>
      <div class="tafsir-sources-note">Synthesized from authentic classical commentaries: Ibn Kathir, Ma'arif al-Qur'an, and Tazkirul Quran.</div>
      <a class="quran-tafsir-link" href="${escapeHtml(classicalUrl)}" target="_blank" rel="noopener noreferrer">
        View Full Classical Texts on Quran.com ↗
      </a>
    `;
  }

  return `
    <div class="tafsir-drawer">
      <div class="tafsir-header">
        <div class="tafsir-title-row">
          <span class="tafsir-title">📖 Tafsir & Reflections</span>
          <span class="tafsir-verse-tag">${escapeHtml(verseKey)}</span>
        </div>
        <div class="tafsir-tabs">
          <button class="tafsir-tab ${activeTafsirMode === 'quick' ? 'active' : ''}" data-mode="quick">⚡ 60-90s Quick</button>
          <button class="tafsir-tab ${activeTafsirMode === 'detailed' ? 'active' : ''}" data-mode="detailed">📖 Detailed</button>
          <button class="tafsir-tab ${activeTafsirMode === 'comprehensive' ? 'active' : ''}" data-mode="comprehensive">🏛️ Comprehensive</button>
        </div>
      </div>
      ${
        isSyncMismatch
          ? `
        <div class="tafsir-sync-pill">
          <span>Viewing Tafsir for ${escapeHtml(activeTafsirVerseKey)} • Live is at ${escapeHtml(data.verseKey)}</span>
          <button class="sync-switch-btn">Switch to ${escapeHtml(data.verseKey)}</button>
        </div>
      `
          : ''
      }
      <div class="tafsir-body">
        ${bodyContent}
      </div>
    </div>
  `;
}

/**
 * Internal render function that updates the HUD DOM based on current state.
 */
function renderHud(shadow, hud, state, data) {
  if (state === 'minimized') {
    hud.className = 'quran-hud is-minimized';
    const pillLabel = data.surahName
      ? `${escapeHtml(data.surahName)} (${escapeHtml(data.verseKey || '')})`
      : 'Quran Identifier';
    hud.innerHTML = `
      <div class="hud-pill" title="Click to expand Quran Verse Identifier">
        <span class="pill-dot"></span>
        <span>${pillLabel}</span>
      </div>
    `;

    const pill = hud.querySelector('.hud-pill');
    if (pill) {
      pill.onclick = () => {
        updateHudState(previousState || 'listening', previousData);
      };
    }
    return;
  }

  hud.className = 'quran-hud';

  let headerTitleHtml = '';
  if (state === 'matched') {
    headerTitleHtml = `
      <div class="hud-title-container">
        <span class="surah-title">${escapeHtml(data.surahName || 'Identified Verse')}</span>
        ${data.verseKey ? `<span class="verse-badge">${escapeHtml(data.verseKey)}</span>` : ''}
        ${data.isStreaming ? `<span class="live-stream-badge"><span class="pulse-rec-dot"></span><span>Live</span></span>` : ''}
      </div>
    `;
  } else if (state === 'error') {
    headerTitleHtml = `<span class="hud-title">Notice</span>`;
  } else {
    headerTitleHtml = `<span class="hud-title">Quran Verse Identifier</span>`;
  }

  let bodyHtml = '';

  if (state === 'listening') {
    const activeSource = data.source || 'tab';
    bodyHtml = `
      <div class="listening-card">
        <div class="live-rec-badge">
          <span class="pulse-rec-dot"></span>
          <span>Listening to Recitation</span>
          <span class="live-source-tag">${activeSource === 'mic' ? 'Microphone' : 'Tab Audio'}</span>
        </div>
        <div class="radar-container">
          <div class="radar-wave"></div>
          <div class="radar-wave"></div>
          <div class="radar-wave"></div>
          <div class="radar-core"></div>
        </div>
        <div class="audio-wave-visualizer" aria-label="Audio stream activity">
          <div class="wave-bar" style="--h: 24px; animation-delay: 0.05s;"></div>
          <div class="wave-bar" style="--h: 38px; animation-delay: 0.22s;"></div>
          <div class="wave-bar" style="--h: 18px; animation-delay: 0.1s;"></div>
          <div class="wave-bar" style="--h: 44px; animation-delay: 0.35s;"></div>
          <div class="wave-bar" style="--h: 28px; animation-delay: 0.15s;"></div>
          <div class="wave-bar" style="--h: 48px; animation-delay: 0.28s;"></div>
          <div class="wave-bar" style="--h: 32px; animation-delay: 0.08s;"></div>
          <div class="wave-bar" style="--h: 20px; animation-delay: 0.42s;"></div>
          <div class="wave-bar" style="--h: 42px; animation-delay: 0.18s;"></div>
          <div class="wave-bar" style="--h: 30px; animation-delay: 0.3s;"></div>
          <div class="wave-bar" style="--h: 46px; animation-delay: 0.12s;"></div>
          <div class="wave-bar" style="--h: 22px; animation-delay: 0.25s;"></div>
          <div class="wave-bar" style="--h: 36px; animation-delay: 0.38s;"></div>
          <div class="wave-bar" style="--h: 26px; animation-delay: 0.14s;"></div>
        </div>
        <div class="hud-status">Listening for Quran recitation...</div>
        <div class="hud-status-hint">Keep Quran audio reciting clearly</div>
        <div class="source-toggle">
          <button class="toggle-btn ${activeSource === 'tab' ? 'active' : ''}" data-source="tab">
            Tab Audio
          </button>
          <button class="toggle-btn ${activeSource === 'mic' ? 'active' : ''}" data-source="mic">
            Microphone
          </button>
        </div>
        <button class="cancel-btn">Cancel</button>
      </div>
    `;
  } else if (state === 'analyzing') {
    bodyHtml = `
      <div class="analyzing-card">
        <div class="transcribe-badge">
          <span class="transcribe-sparkle">✦</span>
          <span>Transcribing Recitation</span>
          <span class="pulse-rec-dot"></span>
        </div>
        <div class="analyzing-spinner"></div>
        <div class="hud-status">${escapeHtml(data.message || 'Transcribing recitation & matching Ayah with Gemini...')}</div>
        <div class="hud-status-hint">Analyzing audio frequencies & identifying Quran verse</div>
        <div class="shimmer-track">
          <div class="shimmer-bar"></div>
        </div>
        <div class="transcribe-steps">
          <div class="transcribe-step done">
            <span class="step-icon">✓</span>
            <span>Audio captured</span>
          </div>
          <div class="transcribe-step active">
            <span class="step-icon">●</span>
            <span>Transcribing Arabic speech</span>
          </div>
          <div class="transcribe-step pending">
            <span class="step-icon">○</span>
            <span>Verifying & fetching translation</span>
          </div>
        </div>
      </div>
    `;
  } else if (state === 'matched') {
    const quranUrl = data.verseKey
      ? `https://quran.com/${data.verseKey.replace(':', '/')}`
      : 'https://quran.com';

    const confidencePercent = data.confidence ? Math.round(data.confidence * 100) : null;
    const authorName = data.translationAuthor || 'Saheeh International';

    bodyHtml = `
      <div class="verse-meta-banner">
        <div class="meta-col">
          <span class="meta-label">Surah</span>
          <span class="meta-value">${escapeHtml(data.surahName || 'Surah')}</span>
        </div>
        <div class="meta-col" style="text-align: right;">
          <span class="meta-label">Ayat Range</span>
          <span class="verse-badge">${escapeHtml(data.verseKey || '')}</span>
        </div>
        ${
          confidencePercent
            ? `
        <div class="meta-col" style="text-align: right;">
          <span class="meta-label">Match</span>
          <span class="meta-confidence">${confidencePercent}%</span>
        </div>`
            : ''
        }
      </div>

      <div class="arabic-container">
        <div class="arabic-header">
          <span class="arabic-badge">القرآن الكريم • Uthmani Calligraphy</span>
        </div>
        <div class="arabic-text" dir="rtl">${escapeHtml(data.arabicText || '')}</div>
      </div>

      ${
        data.recitedArabic
          ? `
      <div class="recited-transcript-row">
        <span class="recited-tag">🎙️ Transcribed:</span>
        <span class="recited-text" dir="rtl">"${escapeHtml(data.recitedArabic)}"</span>
      </div>`
          : ''
      }

      <div class="translation-container">
        <div class="translation-header">
          <div class="translation-badge">
            <svg class="translation-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
            </svg>
            <span>English Translation</span>
          </div>
          <span class="translation-source">${escapeHtml(authorName)}</span>
        </div>
        <div class="translation-text">${escapeHtml(data.translationText || '')}</div>
      </div>

      <div class="hud-stream-bar">
        <button class="stream-toggle-btn ${data.isStreaming ? 'is-streaming' : ''}">
          ${data.isStreaming ? '⏸ Pause Live Following' : '▶ Follow Live Recitation'}
        </button>
        <button class="tafsir-toggle-btn ${tafsirOpen ? 'active' : ''}">
          ${tafsirOpen ? '✕ Close Tafsir' : '📖 Tafsir & Reflections'}
        </button>
      </div>

      ${tafsirOpen ? renderTafsirDrawerHtml(data) : ''}

      <div class="hud-actions">
        <button class="copy-btn">📋 Copy Ayah & Translation</button>
        <a class="quran-link" href="${escapeHtml(quranUrl)}" target="_blank" rel="noopener noreferrer">
          Quran.com ↗
        </a>
      </div>
      <button class="listen-again-btn">🔄 Identify Another Verse</button>
    `;
  } else if (state === 'error') {
    const errorTitle = data.isApiKeyMissing
      ? 'Gemini API Key Required'
      : (data.isMicPermissionMissing
        ? 'Microphone Permission Required'
        : 'Recitation Not Identified');

    bodyHtml = `
      <div class="error-card">
        <div class="error-icon">⚠️</div>
        <div class="error-title">${escapeHtml(errorTitle)}</div>
        <div class="error-message">${escapeHtml(data.message || 'Unable to identify Quran recitation in this audio sample.')}</div>
        <div class="error-actions">
          ${
            data.isApiKeyMissing
              ? `<button class="open-settings-btn">⚙️ Configure API Key</button>`
              : (data.isMicPermissionMissing
                ? `<button class="open-settings-btn">🎙️ Grant Microphone Access</button>`
                : `<button class="try-again-btn">🔄 Try Identifying Again</button>`)
          }
        </div>
      </div>
    `;
  }

  hud.innerHTML = `
    <div class="hud-header">
      <div class="drag-handle">
        <svg class="hud-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
        </svg>
        ${headerTitleHtml}
      </div>
      <div class="header-controls">
        <button class="header-btn minimize-btn" title="Minimize">—</button>
        <button class="header-btn close-btn" title="Close">✕</button>
      </div>
    </div>
    <div class="hud-body">
      ${bodyHtml}
    </div>
  `;

  // Attach interactive listeners
  const closeBtn = hud.querySelector('.close-btn');
  if (closeBtn) {
    closeBtn.onclick = () => {
      activeCallbacks.onCancel?.();
      destroyFloatingHud();
    };
  }

  const minBtn = hud.querySelector('.minimize-btn');
  if (minBtn) {
    minBtn.onclick = () => {
      updateHudState('minimized', data);
    };
  }

  if (state === 'listening') {
    const cancelBtn = hud.querySelector('.cancel-btn');
    if (cancelBtn) {
      cancelBtn.onclick = () => {
        activeCallbacks.onCancel?.();
        destroyFloatingHud();
      };
    }

    const sourceButtons = hud.querySelectorAll('.toggle-btn');
    sourceButtons.forEach((btn) => {
      btn.onclick = () => {
        const selected = btn.getAttribute('data-source');
        currentData.source = selected;
        activeCallbacks.onSourceChange?.(selected);
        sourceButtons.forEach((b) => {
          b.classList.toggle('active', b.getAttribute('data-source') === selected);
        });
      };
    });
  }

  if (state === 'matched') {
    const streamBtn = hud.querySelector('.stream-toggle-btn');
    if (streamBtn) {
      streamBtn.onclick = () => {
        if (data.isStreaming) {
          activeCallbacks.onStopStream?.();
        } else {
          activeCallbacks.onStartStream?.();
        }
      };
    }

    const tafsirBtn = hud.querySelector('.tafsir-toggle-btn');
    if (tafsirBtn) {
      tafsirBtn.onclick = () => {
        if (tafsirOpen) {
          tafsirOpen = false;
          stopTts();
          rerenderHud();
        } else {
          tafsirOpen = true;
          activeTafsirVerseKey = data.verseKey || `${data.surahNumber || 1}:${data.ayahStart || 1}`;
          const parts = activeTafsirVerseKey.split(':');
          const sNum = parseInt(parts[0], 10) || data.surahNumber || 1;
          const aNum = parseInt(parts[1], 10) || data.ayahStart || 1;
          loadTafsir(data, sNum, aNum, activeTafsirMode);
        }
      };
    }

    const tabBtns = hud.querySelectorAll('.tafsir-tab');
    tabBtns.forEach((btn) => {
      btn.onclick = () => {
        const mode = btn.getAttribute('data-mode');
        if (mode && mode !== activeTafsirMode) {
          activeTafsirMode = mode;
          const parts = (activeTafsirVerseKey || data.verseKey || '').split(':');
          const sNum = parseInt(parts[0], 10) || data.surahNumber || 1;
          const aNum = parseInt(parts[1], 10) || data.ayahStart || 1;
          loadTafsir(data, sNum, aNum, mode);
        }
      };
    });

    const syncSwitchBtn = hud.querySelector('.sync-switch-btn');
    if (syncSwitchBtn) {
      syncSwitchBtn.onclick = () => {
        stopTts();
        activeTafsirVerseKey = data.verseKey;
        const parts = (activeTafsirVerseKey || '').split(':');
        const sNum = parseInt(parts[0], 10) || data.surahNumber || 1;
        const aNum = parseInt(parts[1], 10) || data.ayahStart || 1;
        loadTafsir(data, sNum, aNum, activeTafsirMode);
      };
    }

    const ttsPlayBtn = hud.querySelector('.tts-play-btn');
    if (ttsPlayBtn) {
      ttsPlayBtn.onclick = () => {
        const verseKey = activeTafsirVerseKey || data.verseKey || '';
        const cacheKey = `${verseKey}:${activeTafsirMode}`;
        const curTafsir = tafsirCache.get(cacheKey);
        if (curTafsir?.text) {
          playTts(curTafsir.text);
        }
      };
    }

    const speedBtns = hud.querySelectorAll('.tts-speed-btn');
    speedBtns.forEach((btn) => {
      btn.onclick = () => {
        const rateVal = parseFloat(btn.getAttribute('data-rate'));
        if (rateVal) {
          ttsRate = rateVal;
          if (isSpeaking) {
            const verseKey = activeTafsirVerseKey || data.verseKey || '';
            const curTafsir = tafsirCache.get(`${verseKey}:${activeTafsirMode}`);
            if (curTafsir?.text) {
              stopTts();
              playTts(curTafsir.text);
            }
          } else {
            rerenderHud();
          }
        }
      };
    });

    const retryBtn = hud.querySelector('.tafsir-retry-btn');
    if (retryBtn) {
      retryBtn.onclick = () => {
        const parts = (activeTafsirVerseKey || data.verseKey || '').split(':');
        const sNum = parseInt(parts[0], 10) || data.surahNumber || 1;
        const aNum = parseInt(parts[1], 10) || data.ayahStart || 1;
        loadTafsir(data, sNum, aNum, activeTafsirMode);
      };
    }

    const copyBtn = hud.querySelector('.copy-btn');
    if (copyBtn) {
      copyBtn.onclick = () => {
        const textParts = [];
        if (data.arabicText) textParts.push(data.arabicText);
        if (data.translationText) textParts.push(`"${data.translationText}"`);
        if (data.surahName) {
          textParts.push(`— Surah ${data.surahName} (${data.verseKey || ''})`);
        }
        const textToCopy = textParts.join('\n\n').trim();

        copyBtn.textContent = '✓ Copied!';
        copyBtn.classList.add('copied');

        if (navigator?.clipboard?.writeText) {
          navigator.clipboard.writeText(textToCopy).catch(() => {});
        }

        setTimeout(() => {
          const currentCopyBtn = hud.querySelector('.copy-btn');
          if (currentCopyBtn) {
            currentCopyBtn.textContent = '📋 Copy Ayah & Translation';
            currentCopyBtn.classList.remove('copied');
          }
        }, 2000);
      };
    }

    const listenAgainBtn = hud.querySelector('.listen-again-btn');
    if (listenAgainBtn) {
      listenAgainBtn.onclick = () => {
        activeCallbacks.onIdentifyAgain?.();
        updateHudState('listening', { source: currentData.source || 'tab' });
      };
    }
  }

  if (state === 'error') {
    const tryAgainBtn = hud.querySelector('.try-again-btn');
    if (tryAgainBtn) {
      tryAgainBtn.onclick = () => {
        activeCallbacks.onIdentifyAgain?.();
        updateHudState('listening', { source: currentData.source || 'tab' });
      };
    }

    const settingsBtn = hud.querySelector('.open-settings-btn');
    if (settingsBtn) {
      settingsBtn.onclick = () => {
        if (globalThis.chrome?.runtime?.openOptionsPage) {
          globalThis.chrome.runtime.openOptionsPage();
        }
      };
    }
  }
}

/**
 * Bounds-clamped dragging logic for both Pointer and Mouse events.
 */
function initDragging(shadowRoot, hudElement) {
  let isDragging = false;
  let hasDragged = false;
  let startX = 0;
  let startY = 0;
  let initialLeft = 0;
  let initialTop = 0;

  function onPointerDown(e) {
    if (isDragging || (e.button !== undefined && e.button !== 0)) return;

    // Check if clicked inside a drag handle or pill
    const handle = e.target.closest('.drag-handle, .hud-pill');
    if (!handle) return;

    // Ignore interactive elements
    if (e.target.closest('button, a, input, select')) return;

    isDragging = true;
    hasDragged = false;
    startX = e.clientX;
    startY = e.clientY;

    const rect = hudElement.getBoundingClientRect();
    if (hudElement.style.left && hudElement.style.top) {
      initialLeft = parseFloat(hudElement.style.left) || rect.left || 0;
      initialTop = parseFloat(hudElement.style.top) || rect.top || 0;
    } else {
      initialLeft = rect.left || 0;
      initialTop = rect.top || 0;
    }

    hudElement.style.left = `${initialLeft}px`;
    hudElement.style.top = `${initialTop}px`;
    hudElement.style.right = 'auto';
    hudElement.style.bottom = 'auto';

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('mousemove', onPointerMove);
    window.addEventListener('mouseup', onPointerUp);
  }

  function onPointerMove(e) {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    if (!hasDragged && (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4)) {
      hasDragged = true;
    }

    const hudWidth = hudElement.offsetWidth || hudElement.getBoundingClientRect().width || 320;
    const hudHeight = hudElement.offsetHeight || hudElement.getBoundingClientRect().height || 200;

    const winWidth = window.innerWidth || 1024;
    const winHeight = window.innerHeight || 768;

    const maxLeft = Math.max(0, winWidth - hudWidth);
    const maxTop = Math.max(0, winHeight - hudHeight);

    const targetLeft = initialLeft + deltaX;
    const targetTop = initialTop + deltaY;

    const clampedLeft = Math.max(0, Math.min(targetLeft, maxLeft));
    const clampedTop = Math.max(0, Math.min(targetTop, maxTop));

    hudElement.style.left = `${clampedLeft}px`;
    hudElement.style.top = `${clampedTop}px`;
  }

  function onPointerUp() {
    if (!isDragging) return;
    isDragging = false;

    if (hasDragged) {
      const suppressClick = (clickEvent) => {
        clickEvent.stopImmediatePropagation();
        clickEvent.preventDefault();
        shadowRoot.removeEventListener('click', suppressClick, true);
      };
      shadowRoot.addEventListener('click', suppressClick, true);
      setTimeout(() => {
        shadowRoot.removeEventListener('click', suppressClick, true);
      }, 50);
    }

    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('mousemove', onPointerMove);
    window.removeEventListener('mouseup', onPointerUp);
  }

  shadowRoot.addEventListener('pointerdown', onPointerDown);
  shadowRoot.addEventListener('mousedown', onPointerDown);

  return () => {
    onPointerUp();
    shadowRoot.removeEventListener('pointerdown', onPointerDown);
    shadowRoot.removeEventListener('mousedown', onPointerDown);
  };
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
