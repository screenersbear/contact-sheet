// Slides with a video in them export as MP4. The slide is drawn over and over
// while its videos play, and the browser records that canvas, so a slide takes
// as long to make as it takes to watch.
import { SLIDE_W, slideH, framesOnSlide, placement } from './model.js';
import { drawSlide } from './render.js';
import { openVideo } from './photos.js';

export const MAX_VIDEO_S = 60; // the longest video Instagram takes in a carousel
const FPS = 30;
const MAX_SOUND_BYTES = 300 * 1024 * 1024; // past this, reading the sound could run an iPhone out of memory
const TYPES = [
  ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'mp4'],
  ['video/mp4;codecs=avc1,mp4a.40.2', 'mp4'],
  ['video/mp4', 'mp4'],
  ['video/webm;codecs=vp9,opus', 'webm'],
  ['video/webm', 'webm'],
];

function recorderType() {
  if (!window.MediaRecorder || !HTMLCanvasElement.prototype.captureStream) return null;
  return TYPES.find(([t]) => MediaRecorder.isTypeSupported(t)) || null;
}
export const canRecordVideo = () => !!recorderType();

export const hasVideo = (p, photos, i) =>
  framesOnSlide(p, i).some((f) => f.photoId && photos[f.photoId] && photos[f.photoId].kind === 'video');

// Must start from a tap, or the sound stays switched off on an iPhone.
export function startSound() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  const ctx = new Ctx();
  ctx.resume().catch(() => {});
  return ctx;
}

// The sound comes from the file itself, so the video can stay muted and play
// without a tap. A video with no sound just gives nothing back.
async function soundOf(audio, photo, out, length) {
  if (!audio || photo.original.size > MAX_SOUND_BYTES) return null;
  try {
    const buffer = await audio.decodeAudioData(await photo.original.arrayBuffer());
    const node = audio.createBufferSource();
    node.buffer = buffer;
    node.loop = buffer.duration < length - 0.05;
    node.connect(out);
    return node;
  } catch {
    return null;
  }
}

// Makes one slide's video. `host` shows it being made. `stillOpen` says whether
// to carry on. `openSource` opens a still photo at a given scale.
export async function recordSlide(p, photos, i, { audio, host, openSource, onTime, stillOpen }) {
  const [mime, ext] = recorderType();
  const W = SLIDE_W;
  const H = slideH(p) - (slideH(p) % 2); // video sizes have to be even
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  host.appendChild(canvas);
  const ctx = canvas.getContext('2d', { colorSpace: 'srgb', alpha: false });

  const frames = framesOnSlide(p, i).filter((f) => f.photoId && photos[f.photoId]);
  const open = new Map();
  const videos = [];
  const sounds = [];
  let stream = null;
  try {
    for (const f of frames) {
      const id = f.photoId;
      if (open.has(id)) continue;
      const photo = photos[id];
      if (photo.kind === 'video') {
        const opened = await openVideo(photo.original);
        videos.push(opened);
        open.set(id, { photo, src: opened.video });
      } else {
        const scale = Math.max(...frames.filter((o) => o.photoId === id).map((o) => placement(o, photo).s));
        const opened = await openSource(photo, scale);
        open.set(id, opened);
      }
    }
    const lengths = videos.map((v) => v.video.duration).filter(Number.isFinite);
    const length = Math.min(MAX_VIDEO_S, Math.max(1, ...lengths));
    videos.forEach(({ video }) => {
      video.currentTime = 0;
      // A shorter video on the slide starts again until the longest ends.
      video.loop = !(video.duration >= length - 0.05);
    });

    const draw = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      drawSlide(ctx, p, i, (id) => open.get(id) || null, { smooth: 'medium' });
    };
    draw();
    stream = canvas.captureStream(FPS);
    if (audio) {
      const out = audio.createMediaStreamDestination();
      for (const [, o] of open) {
        if (o.photo.kind !== 'video') continue;
        const node = await soundOf(audio, o.photo, out, length);
        if (node) sounds.push(node);
      }
      if (sounds.length) out.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    }

    const chunks = [];
    const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 12_000_000, audioBitsPerSecond: 160_000 });
    rec.ondataavailable = (e) => e.data && e.data.size && chunks.push(e.data);
    const stopped = new Promise((done, fail) => {
      rec.onstop = done;
      rec.onerror = () => fail(new Error('Recording failed'));
    });

    await Promise.all(videos.map(({ video }) => video.play()));
    rec.start(1000);
    sounds.forEach((n) => n.start());
    const t0 = performance.now();
    await new Promise((done, fail) => {
      let over = false;
      const end = (err) => {
        if (over) return;
        over = true;
        clearTimeout(guard);
        document.removeEventListener('visibilitychange', away);
        if (err) fail(err);
        else done();
      };
      // Put away, the videos stop and the recording would be spoiled.
      const away = () => document.hidden && end(new Error('The app was put away'));
      document.addEventListener('visibilitychange', away);
      const guard = setTimeout(end, length * 1000 + 500);
      const step = () => {
        if (over) return;
        if (!stillOpen()) return end(new Error('Closed'));
        const t = (performance.now() - t0) / 1000;
        if (t >= length) return end();
        draw();
        if (onTime) onTime(t, length);
        requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
    rec.stop();
    await stopped;
    const type = mime.split(';')[0];
    return { blob: new Blob(chunks, { type }), mime: type, ext, width: W, height: H, isVideo: true };
  } finally {
    sounds.forEach((n) => {
      try {
        n.stop();
      } catch {}
      n.disconnect();
    });
    if (stream) stream.getTracks().forEach((t) => t.stop());
    videos.forEach((v) => v.release());
    open.forEach((o) => o.release && o.release());
    canvas.remove();
    canvas.width = canvas.height = 0;
  }
}
