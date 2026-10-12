export const VideoThumbnail = (function () {
  'use strict';

  var DEF = {
    maxWidth:   960,
    quality:    0.92,
    candidates: 6,
    blankMean:  8,
    blankSD:    6
  };

  var host = null;
  function getHost() {
    if (host) return host;
    if (typeof document === 'undefined') throw new Error('VideoThumbnail requires a DOM');
    host = document.createElement('div');
    host.setAttribute('aria-hidden', 'true');
    host.style.cssText =
      'position:fixed;top:0;left:0;width:320px;height:180px;' +
      'overflow:hidden;opacity:.01;pointer-events:none;z-index:-1;';
    (document.body || document.documentElement).appendChild(host);
    return host;
  }

  var probe = null, pctx = null;
  function getProbe() {
    if (probe) return pctx;
    probe = document.createElement('canvas');
    probe.width = 64; probe.height = 36;
    pctx = probe.getContext('2d', { willReadFrequently: true });
    return pctx;
  }

  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function stampOf(s) { return Number(s).toFixed(2).replace('.', '_'); }
  function stripExt(n) { return String(n || '').replace(/\.[^.]+$/, '') || 'thumbnail'; }

  function loadVideo(url, onBuffer) {
    return new Promise(function (resolve, reject) {
      var v = document.createElement('video');
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.setAttribute('muted', '');
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.preload = 'auto';
      v.src = url;
      getHost().appendChild(v);

      var settled = false;
      var timer = setTimeout(function () {
        if (!settled) { settled = true; reject(new Error('Timed out reading this video')); }
      }, 25000);

      v.addEventListener('progress', function () {
        if (!onBuffer) return;
        try {
          if (v.duration && v.buffered.length) {
            onBuffer(v.buffered.end(v.buffered.length - 1) / v.duration);
          }
        } catch (e) {}
      });

      v.addEventListener('loadedmetadata', function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      }, { once: true });

      v.addEventListener('error', function () {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(new Error('This video format could not be decoded'));
      }, { once: true });
    });
  }

  function releaseVideo(v) {
    if (!v) return;
    try {
      v.pause();
      v.removeAttribute('src');
      v.load();
      if (v.parentNode) v.parentNode.removeChild(v);
    } catch (e) {}
  }

  function waitForData(v) {
    return new Promise(function (resolve) {
      if (v.readyState >= 2) return resolve();
      var to = setTimeout(resolve, 8000);
      v.addEventListener('loadeddata', function () { clearTimeout(to); resolve(); }, { once: true });
    });
  }

  function seek(v, t) {
    return new Promise(function (resolve) {
      var done = false, to;
      function fin() {
        if (done) return;
        done = true;
        clearTimeout(to);
        v.removeEventListener('seeked', fin);
        resolve();
      }
      to = setTimeout(fin, 5000);
      v.addEventListener('seeked', fin);
      try { v.currentTime = t; } catch (e) { fin(); }
    });
  }

  function settle(v) {
    return new Promise(function (resolve) {
      var done = false;
      function fin() { if (done) return; done = true; resolve(); }
      if (typeof v.requestVideoFrameCallback === 'function') {
        try { v.requestVideoFrameCallback(function () { fin(); }); } catch (e) {}
      }
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { setTimeout(fin, 40); });
      });
      setTimeout(fin, 700);
    });
  }

  function toBlob(canvas, quality) {
    return new Promise(function (resolve) {
      if (canvas.toBlob) canvas.toBlob(function (b) { resolve(b); }, 'image/jpeg', quality);
      else resolve(null);
    });
  }

  function analyze(src, opts) {
    var ctx = getProbe(), d;
    try {
      ctx.drawImage(src, 0, 0, 64, 36);
      d = ctx.getImageData(0, 0, 64, 36).data;
    } catch (e) {
      return { blank: false, score: 50 };
    }
    var n = d.length / 4, sum = 0, sum2 = 0, satSum = 0;
    for (var i = 0; i < d.length; i += 4) {
      var l = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
      sum += l; sum2 += l * l;
      satSum += Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]);
    }
    var mean = sum / n;
    var sd   = Math.sqrt(Math.max(0, sum2 / n - mean * mean));
    var sat  = satSum / n;
    return {
      blank: (mean < opts.blankMean && sd < opts.blankSD),
      score: sd * 1.0 + sat * 0.6 - Math.abs(mean - 118) * 0.35
    };
  }

  async function grabFrame(video, ctx, canvas, t, dur, opts) {
    await seek(video, t);
    await settle(video);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    var a = analyze(canvas, opts);
    if (!a.blank) return a;

    var t2 = Math.min(t + 0.05, Math.max(0, dur - 0.03));
    if (t2 !== t) {
      await seek(video, t2);
      await settle(video);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      a = analyze(canvas, opts);
      if (!a.blank) return a;
    }

    try {
      await seek(video, t);
      var p = video.play();
      if (p && typeof p.then === 'function') { try { await p; } catch (e) {} }
      await sleep(120);
      video.pause();
      await settle(video);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      a = analyze(canvas, opts);
    } catch (e) {}
    return a;
  }

  async function generate(input, options) {
    input = input || {};
    var srcFile = input.file;
    if (!srcFile) throw new Error('No video file provided');

    var opts = Object.assign({}, DEF, options || {});
    var srcName     = input.name || srcFile.name || 'video';
    var srcModified = (typeof input.lastModified === 'number') ? input.lastModified : (srcFile.lastModified || Date.now());
    var srcRes      = input.resolution || null;

    var onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
    function tick(pct, label) { if (onProgress) onProgress(pct, label); }

    var url = URL.createObjectURL(srcFile);
    var video = null;

    try {
      tick(2, 'Opening video…');
      video = await loadVideo(url, function (p) {
        tick(2 + p * 16, 'Buffering… ' + Math.round(p * 100) + '%');
      });

      var dur = video.duration;
      var vw  = video.videoWidth  || (srcRes && srcRes.width)  || 0;
      var vh  = video.videoHeight || (srcRes && srcRes.height) || 0;

      if (!isFinite(dur) || dur <= 0 || !vw || !vh) {
        throw new Error('Could not read video metadata');
      }

      tick(19, 'Decoding…');
      await waitForData(video);

      var maxW  = opts.maxWidth || DEF.maxWidth;
      var scale = Math.min(1, maxW / vw);
      var cw    = Math.max(2, Math.round(vw * scale));
      var ch    = Math.max(2, Math.round(vh * scale));

      var canvas = document.createElement('canvas');
      canvas.width  = cw;
      canvas.height = ch;
      var ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, cw, ch);

      var count = Math.max(1, opts.candidates || DEF.candidates);
      var times = [];
      for (var i = 0; i < count; i++) {
        var frac = (count === 1) ? 0.35 : 0.08 + (0.80 * i) / (count - 1);
        times.push(Math.min(frac * dur, Math.max(0, dur - 0.05)));
      }

      var cands = [];
      for (var k = 0; k < times.length; k++) {
        tick(20 + (k / times.length) * 78, 'Analysing frame ' + (k + 1) + '/' + times.length + '…');
        var info;
        try { info = await grabFrame(video, ctx, canvas, times[k], dur, opts); }
        catch (e) { continue; }

        var blob = await toBlob(canvas, opts.quality || DEF.quality);
        if (!blob) continue;

        cands.push({ time: times[k], blob: blob, w: cw, h: ch, score: info.score, blank: info.blank });
      }

      if (!cands.length) throw new Error('No frames could be captured from this video');

      cands.sort(function (a, b) {
        if (a.blank !== b.blank) return a.blank ? 1 : -1;
        return b.score - a.score;
      });

      var best = cands[0];
      tick(100, 'Done');

      return {
        file:         best.blob,
        name:         stripExt(srcName) + '_' + stampOf(best.time) + 's.jpg',
        lastModified: Date.now(),
        resolution:   { width: best.w, height: best.h },
        timestamp:    best.time,
        source: { name: srcName, lastModified: srcModified, resolution: { width: vw, height: vh }, duration: dur }
      };
    } finally {
      try { URL.revokeObjectURL(url); } catch (e) {}
      releaseVideo(video);
    }
  }

  return { generate: generate, defaults: DEF };
})();