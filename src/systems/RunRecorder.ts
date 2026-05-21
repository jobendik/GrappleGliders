/**
 * Run recorder. Wraps MediaRecorder on the game canvas so the player can
 * download/share a WebM clip of their run. Best-effort: silently no-ops on
 * browsers where MediaRecorder + canvas.captureStream() isn't supported
 * (older Safari, weird WebViews).
 *
 * Cap on duration: 30 seconds. Most viral clips are under 15s, and longer
 * blobs make sharing annoying. If a run exceeds the cap, the recorder keeps
 * a rolling tail — at game over we trim to the most recent N seconds.
 *
 * The recorder doesn't capture audio — game audio is procedural and routed
 * through WebAudio destination, not the canvas mediastream. Music is the
 * player's own soundtrack memory; the visual clip is what they share.
 */

const MIME_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

/** Maximum clip length we keep, in seconds. Longer runs trim from the start. */
const MAX_DURATION_S = 30;
/** Timeslice for MediaRecorder. Smaller → more granular trimming. */
const TIMESLICE_MS = 1000;

export class RunRecorder {
  private canvas: HTMLCanvasElement;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;
  private mimeType: string | null = null;
  private supported: boolean;
  private finalizedBlob: Blob | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.supported = this.detectSupport();
  }

  /** Whether the environment supports recording. */
  isSupported(): boolean {
    return this.supported;
  }

  /**
   * Start a new recording. If a previous one is active it's discarded. Safe
   * to call repeatedly; subsequent calls during an active recording no-op.
   */
  start(): void {
    if (!this.supported) return;
    if (this.recorder && this.recorder.state === 'recording') return;
    this.finalizedBlob = null;
    this.chunks.length = 0;
    try {
      const stream =
        typeof (this.canvas as HTMLCanvasElement & { captureStream?: (fps?: number) => MediaStream }).captureStream ===
        'function'
          ? (this.canvas as HTMLCanvasElement & { captureStream: (fps?: number) => MediaStream }).captureStream(30)
          : null;
      if (!stream) {
        this.supported = false;
        return;
      }
      const mime = this.pickMime();
      if (!mime) {
        this.supported = false;
        return;
      }
      this.mimeType = mime;
      this.recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 2_500_000,
      });
      this.recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data && e.data.size > 0) {
          this.chunks.push(e.data);
          // Soft cap memory — keep at most MAX_DURATION_S worth of slices.
          const maxSlices = Math.ceil((MAX_DURATION_S * 1000) / TIMESLICE_MS) + 2;
          while (this.chunks.length > maxSlices) this.chunks.shift();
        }
      };
      this.recorder.onerror = () => {
        // Bail silently — replays are a nice-to-have, never block gameplay.
        this.supported = false;
      };
      this.recorder.start(TIMESLICE_MS);
      this.startedAt = performance.now();
    } catch (err) {
      console.warn('RunRecorder: start failed', err);
      this.supported = false;
      this.recorder = null;
    }
  }

  /**
   * Stop the active recording, if any. The clip is held in memory and
   * accessible via getClipBlob() until the next start() or discard().
   */
  stop(): void {
    const rec = this.recorder;
    if (!rec) return;
    if (rec.state === 'inactive') return;
    try {
      // Finalize on the next 'stop' event — MediaRecorder may flush one more chunk.
      const promise = new Promise<void>((resolve) => {
        rec.onstop = () => {
          if (this.chunks.length > 0 && this.mimeType) {
            this.finalizedBlob = new Blob(this.chunks, { type: this.mimeType });
          }
          resolve();
        };
        try {
          rec.stop();
        } catch {
          resolve();
        }
      });
      // Fire-and-forget — callers don't await.
      void promise;
    } catch (err) {
      console.warn('RunRecorder: stop failed', err);
    }
  }

  /** True if a finalized clip is available for export. */
  hasClip(): boolean {
    return !!this.finalizedBlob;
  }

  /** Returns the finalized clip blob, or null if none. */
  getClipBlob(): Blob | null {
    return this.finalizedBlob;
  }

  /**
   * Force-finalize immediately. Useful when the host code needs to read the
   * clip before MediaRecorder's async 'stop' event fires (e.g., user clicks
   * "Save Clip" right after dying). Synthesizes a blob from whatever chunks
   * have been emitted so far.
   */
  finalizeNow(): Blob | null {
    if (this.finalizedBlob) return this.finalizedBlob;
    if (this.chunks.length === 0 || !this.mimeType) return null;
    this.finalizedBlob = new Blob(this.chunks, { type: this.mimeType });
    return this.finalizedBlob;
  }

  /** Drop the held clip. */
  discard(): void {
    this.finalizedBlob = null;
    this.chunks.length = 0;
  }

  /** Run duration in seconds since start(). */
  elapsed(): number {
    if (!this.startedAt) return 0;
    return (performance.now() - this.startedAt) / 1000;
  }

  private detectSupport(): boolean {
    if (typeof MediaRecorder === 'undefined') return false;
    if (typeof (this.canvas as HTMLCanvasElement & { captureStream?: () => MediaStream }).captureStream !== 'function')
      return false;
    return this.pickMime() !== null;
  }

  private pickMime(): string | null {
    for (const candidate of MIME_CANDIDATES) {
      try {
        if (MediaRecorder.isTypeSupported(candidate)) return candidate;
      } catch {
        // Some browsers throw on isTypeSupported for exotic strings — skip.
      }
    }
    return null;
  }
}
