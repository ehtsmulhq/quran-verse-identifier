import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  setupAudioCapture,
  startRecording,
  stopRecording,
  startStreaming,
  stopStreaming,
  blobToBase64,
  handleMessage
} from '../../src/offscreen/offscreen.js';

describe('Offscreen Audio Capture', () => {
  let mockTrack;
  let mockStream;
  let mockSourceNode;
  let mockAudioContext;
  let mockRecorderInstance;

  class MockMediaRecorder {
    static isTypeSupported = vi.fn().mockImplementation((mime) => {
      return mime.startsWith('audio/webm');
    });

    constructor(stream, options = {}) {
      this.stream = stream;
      this.mimeType = options.mimeType || 'audio/webm;codecs=opus';
      this.state = 'inactive';
      this.ondataavailable = null;
      this.onstop = null;
      this.onerror = null;
      mockRecorderInstance = this;
    }

    start() {
      this.state = 'recording';
    }

    stop() {
      if (this.state === 'inactive') return;
      this.state = 'inactive';
      if (this.ondataavailable) {
        this.ondataavailable({
          data: new Blob(['dummy-audio-bytes'], { type: this.mimeType })
        });
      }
      if (this.onstop) {
        this.onstop();
      }
    }
  }

  class MockFileReader {
    readAsDataURL(blob) {
      queueMicrotask(async () => {
        if (this.shouldFail) {
          this.error = new Error('File reading failed');
          if (this.onerror) this.onerror(this.error);
          return;
        }
        let base64 = 'ZHVtbXktYXVkaW8tZGF0YQ==';
        if (blob && typeof blob.text === 'function') {
          try {
            const text = await blob.text();
            base64 = Buffer.from(text).toString('base64');
          } catch (_) {}
        }
        this.result = `data:${blob?.type || 'audio/webm'};base64,${base64}`;
        if (this.onloadend) this.onloadend();
      });
    }
  }

  beforeEach(() => {
    vi.useFakeTimers();

    mockTrack = {
      kind: 'audio',
      stop: vi.fn(),
      enabled: true
    };

    mockStream = {
      getAudioTracks: vi.fn().mockReturnValue([mockTrack]),
      getTracks: vi.fn().mockReturnValue([mockTrack])
    };

    mockSourceNode = {
      connect: vi.fn(),
      disconnect: vi.fn()
    };

    mockAudioContext = {
      state: 'running',
      destination: { id: 'speakers-destination' },
      createMediaStreamSource: vi.fn().mockReturnValue(mockSourceNode),
      resume: vi.fn().mockResolvedValue(),
      close: vi.fn().mockResolvedValue()
    };

    globalThis.AudioContext = vi.fn().mockImplementation(() => mockAudioContext);
    globalThis.MediaRecorder = MockMediaRecorder;
    globalThis.FileReader = MockFileReader;

    try {
      Object.defineProperty(globalThis.navigator, 'mediaDevices', {
        value: {
          getUserMedia: vi.fn().mockResolvedValue(mockStream)
        },
        configurable: true,
        writable: true
      });
    } catch {
      Object.defineProperty(globalThis, 'navigator', {
        value: {
          mediaDevices: {
            getUserMedia: vi.fn().mockResolvedValue(mockStream)
          }
        },
        configurable: true,
        writable: true
      });
    }

    globalThis.chrome = {
      runtime: {
        onMessage: {
          addListener: vi.fn(),
          removeListener: vi.fn()
        },
        sendMessage: vi.fn().mockResolvedValue({})
      }
    };
  });

  afterEach(() => {
    stopRecording();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('setupAudioCapture', () => {
    it('connects stream to AudioContext destination so sound is not muted in user headphones', () => {
      const result = setupAudioCapture(mockStream, mockAudioContext);

      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
      expect(mockSourceNode.connect).toHaveBeenCalledWith(mockAudioContext.destination);
      expect(result.sourceNode).toBe(mockSourceNode);
      expect(result.destination).toBe(mockAudioContext.destination);
    });

    it('resumes AudioContext if suspended due to browser autoplay policies', async () => {
      mockAudioContext.state = 'suspended';

      setupAudioCapture(mockStream, mockAudioContext);

      expect(mockAudioContext.resume).toHaveBeenCalled();
    });

    it('creates new AudioContext if none was provided', () => {
      const result = setupAudioCapture(mockStream);

      expect(globalThis.AudioContext).toHaveBeenCalled();
      expect(result.destination).toBe(mockAudioContext.destination);
    });
  });

  describe('blobToBase64', () => {
    it('converts Blob to clean Base64 string without data URL prefix', async () => {
      const blob = new Blob(['test-audio-content'], { type: 'audio/webm' });
      const base64 = await blobToBase64(blob);

      const expected = Buffer.from('test-audio-content').toString('base64');
      expect(base64).toBe(expected);
    });

    it('rejects if FileReader encounters an error', async () => {
      class FailingReader extends MockFileReader {
        constructor() {
          super();
          this.shouldFail = true;
        }
      }
      globalThis.FileReader = FailingReader;

      const blob = new Blob(['content']);
      await expect(blobToBase64(blob)).rejects.toThrow('File reading failed');
    });
  });

  describe('startRecording', () => {
    it('captures mic using navigator.mediaDevices.getUserMedia with audio: true', async () => {
      const recordPromise = startRecording('mic', null, 5000);
      await Promise.resolve();

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: true
      });

      // Does not connect mic to destination to prevent feedback loop
      expect(mockSourceNode.connect).not.toHaveBeenCalled();

      // Trigger recorder stop
      mockRecorderInstance.stop();

      const result = await recordPromise;
      expect(result.base64).toBeTruthy();
      expect(result.mimeType).toBe('audio/webm;codecs=opus');
    });

    it('captures tab audio using chromeMediaSource: tab and streamId with unmuted pass-through', async () => {
      const streamId = 'test-stream-id-123';
      const recordPromise = startRecording('tab', streamId, 5000);
      await Promise.resolve();

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: streamId
          }
        },
        video: false
      });

      // Crucial: connects tab stream to destination so tab video audio continues playing
      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
      expect(mockSourceNode.connect).toHaveBeenCalledWith(mockAudioContext.destination);

      mockRecorderInstance.stop();

      const result = await recordPromise;
      expect(result.base64).toBeTruthy();
      expect(result.mimeType).toBe('audio/webm;codecs=opus');
    });

    it('auto-stops recording after durationMs expires', async () => {
      const recordPromise = startRecording('tab', 'stream-xyz', 3000);
      await Promise.resolve();

      // Advance timers by 3000ms
      vi.advanceTimersByTime(3000);

      const result = await recordPromise;
      expect(result.base64).toBeTruthy();
      expect(mockTrack.stop).toHaveBeenCalled();
    });

    it('handles getUserMedia failure by rejecting', async () => {
      navigator.mediaDevices.getUserMedia.mockRejectedValue(new Error('Permission denied'));

      await expect(startRecording('mic')).rejects.toThrow('Permission denied');
    });
  });

  describe('stopRecording', () => {
    it('halts active MediaRecorder and stops all media tracks cleanly', async () => {
      const recordPromise = startRecording('tab', 'id-1', 5000);
      await Promise.resolve();

      expect(mockRecorderInstance.state).toBe('recording');

      stopRecording();

      expect(mockRecorderInstance.state).toBe('inactive');
      expect(mockTrack.stop).toHaveBeenCalled();
      expect(mockAudioContext.close).toHaveBeenCalled();

      const result = await recordPromise;
      expect(result.base64).toBeTruthy();
    });

    it('is safe to call when not recording', () => {
      expect(() => stopRecording()).not.toThrow();
    });
  });

  describe('handleMessage and Chrome Runtime Messaging', () => {
    it('handles START_RECORDING message and sends RECORDING_COMPLETE upon finish', async () => {
      const message = {
        target: 'offscreen',
        type: 'START_RECORDING',
        source: 'tab',
        streamId: 'tab-stream-456',
        durationMs: 4000
      };

      const sendResponse = vi.fn();
      const handling = handleMessage(message, {}, sendResponse);
      expect(handling).toBe(true);

      await Promise.resolve();

      vi.advanceTimersByTime(4000);

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true
          })
        );
      });

      expect(globalThis.chrome.runtime.sendMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'RECORDING_COMPLETE',
          data: expect.objectContaining({
            base64: expect.any(String),
            mimeType: 'audio/webm;codecs=opus'
          })
        })
      );
    });

    it('handles START_RECORDING error and sends RECORDING_ERROR', async () => {
      navigator.mediaDevices.getUserMedia.mockRejectedValue(new Error('Audio device busy'));

      const message = {
        target: 'offscreen',
        type: 'START_RECORDING',
        source: 'mic'
      };

      const sendResponse = vi.fn();
      handleMessage(message, {}, sendResponse);

      await vi.waitFor(() => {
        expect(sendResponse).toHaveBeenCalledWith({
          success: false,
          error: 'Audio device busy'
        });
      });

      expect(globalThis.chrome.runtime.sendMessage).toHaveBeenCalledWith({
        type: 'RECORDING_ERROR',
        error: 'Audio device busy'
      });
    });

    it('handles STOP_RECORDING message and triggers stopRecording', async () => {
      const recordPromise = startRecording('mic');
      await Promise.resolve();
      expect(mockRecorderInstance.state).toBe('recording');

      const message = {
        target: 'offscreen',
        type: 'STOP_RECORDING'
      };

      const sendResponse = vi.fn();
      const handling = handleMessage(message, {}, sendResponse);
      expect(handling).toBe(true);

      expect(mockRecorderInstance.state).toBe('inactive');
      expect(sendResponse).toHaveBeenCalledWith({ success: true });

      await recordPromise;
    });

    it('ignores messages without target: offscreen', () => {
      const sendResponse = vi.fn();
      const handling = handleMessage({ type: 'START_RECORDING' }, {}, sendResponse);
      expect(handling).toBe(false);
      expect(sendResponse).not.toHaveBeenCalled();
    });

    it('handles START_STREAMING and STOP_STREAMING with audio pass-through preserved', async () => {
      const streamId = 'stream-live-456';
      const sendStartResponse = vi.fn();

      const startMsg = {
        target: 'offscreen',
        type: 'START_STREAMING',
        source: 'tab',
        streamId,
        intervalMs: 4500
      };

      const handlingStart = handleMessage(startMsg, {}, sendStartResponse);
      expect(handlingStart).toBe(true);
      await Promise.resolve();

      expect(mockAudioContext.createMediaStreamSource).toHaveBeenCalledWith(mockStream);
      expect(mockSourceNode.connect).toHaveBeenCalledWith(mockAudioContext.destination);

      await vi.waitFor(() => {
        expect(sendStartResponse).toHaveBeenCalledWith(
          expect.objectContaining({ success: true, streaming: true })
        );
      });

      const sendStopResponse = vi.fn();
      const stopMsg = {
        target: 'offscreen',
        type: 'STOP_STREAMING'
      };

      const handlingStop = handleMessage(stopMsg, {}, sendStopResponse);
      expect(handlingStop).toBe(true);

      expect(sendStopResponse).toHaveBeenCalledWith({ success: true });
      expect(mockTrack.stop).toHaveBeenCalled();
    });
  });
});

