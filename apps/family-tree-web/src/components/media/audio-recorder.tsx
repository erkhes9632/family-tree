'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Mic, Pause, Play, RotateCcw, Square, Upload } from 'lucide-react';
import type { PartialDate } from '@super-project/types';
import { useApi } from '@/lib/api';
import { useGraph } from '@/lib/queries';
import { uploadMedia } from '@/lib/upload';
import { formatDuration } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PartialDateInput } from '@/components/forms/partial-date-input';
import { PersonPicker } from './person-picker';

type Phase = 'idle' | 'recording' | 'paused' | 'stopped';

function pickMime(): string {
  const options = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
  return options.find((m) => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(m)) ?? '';
}

/** Record an audio story in the browser (MediaRecorder), or upload an existing audio file, and save it as a story. */
export function AudioStoryDialog({ treeId, defaultPersonId, trigger }: { treeId: string; defaultPersonId?: string; trigger?: React.ReactNode }) {
  const t = useTranslations('recorder');
  const tc = useTranslations('common');
  const api = useApi();
  const qc = useQueryClient();
  const graph = useGraph(treeId);
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<Phase>('idle');
  const [elapsed, setElapsed] = React.useState(0);
  const [blob, setBlob] = React.useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [date, setDate] = React.useState<PartialDate | null>(null);
  const [personIds, setPersonIds] = React.useState<string[]>(defaultPersonId ? [defaultPersonId] : []);
  const [progress, setProgress] = React.useState<number | null>(null);
  const [level, setLevel] = React.useState(0);
  const recorder = React.useRef<MediaRecorder | null>(null);
  const chunks = React.useRef<Blob[]>([]);
  const stream = React.useRef<MediaStream | null>(null);
  const timer = React.useRef<number | null>(null);
  const raf = React.useRef<number | null>(null);
  const supported = typeof window !== 'undefined' && typeof MediaRecorder !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const stopTracks = () => {
    stream.current?.getTracks().forEach((tr) => tr.stop());
    stream.current = null;
    if (timer.current) window.clearInterval(timer.current);
    if (raf.current) cancelAnimationFrame(raf.current);
  };
  React.useEffect(() => () => stopTracks(), []);
  React.useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  function reset() {
    stopTracks();
    setPhase('idle');
    setElapsed(0);
    setBlob(null);
    setPreviewUrl(null);
    setProgress(null);
    chunks.current = [];
  }

  async function start() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      stream.current = s;
      const mime = pickMime();
      const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      rec.onstop = () => {
        const b = new Blob(chunks.current, { type: rec.mimeType || mime || 'audio/webm' });
        setBlob(b);
        setPreviewUrl(URL.createObjectURL(b));
        stopTracks();
      };
      rec.start(1000);
      recorder.current = rec;
      setPhase('recording');
      setElapsed(0);
      timer.current = window.setInterval(() => {
        if (recorder.current?.state === 'recording') setElapsed((x) => x + 1);
      }, 1000);
      // simple input level meter
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(s).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128));
        setLevel(peak / 128);
        raf.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      toast.error(t('micDenied'));
    }
  }

  function pause() {
    recorder.current?.pause();
    setPhase('paused');
  }
  function resume() {
    recorder.current?.resume();
    setPhase('recording');
  }
  function stop() {
    recorder.current?.stop();
    setPhase('stopped');
    setLevel(0);
  }

  async function save() {
    if (!blob || !title.trim()) return;
    try {
      setProgress(0);
      const media = await uploadMedia(api, treeId, blob, {
        kind: 'audio',
        durationSec: elapsed || undefined,
        meta: { title: title.trim(), description: description || null, date, personIds, category: 'story' },
        onProgress: setProgress,
      });
      await api.post(`/trees/${treeId}/stories`, { title: title.trim(), description: description || null, mediaId: media.id, personId: personIds[0] ?? null, date });
      await qc.invalidateQueries({ queryKey: ['tree', treeId] });
      toast.success(t('saved'));
      setOpen(false);
      reset();
      setTitle('');
      setDescription('');
    } catch (err) {
      setProgress(null);
      toast.error(err instanceof Error ? err.message : tc('error'));
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (progress !== null) return;
        setOpen(o);
        if (!o) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline">
            <Mic /> {t('button')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')} className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 rounded-xl border bg-muted/40 p-5">
          <div className="font-serif text-4xl tabular-nums" aria-live="polite" aria-label={t('elapsed')}>
            {formatDuration(elapsed)}
          </div>
          <div className="flex h-8 items-end gap-1" aria-hidden>
            {Array.from({ length: 16 }, (_, i) => (
              <span key={i} className="w-1.5 rounded-full bg-primary transition-[height]" style={{ height: `${phase === 'recording' ? Math.max(8, Math.min(100, level * 260 * (0.5 + ((i * 7) % 5) / 8))) : 8}%` }} />
            ))}
          </div>
          {!supported ? (
            <p className="text-center text-sm text-muted-foreground">{t('unsupported')}</p>
          ) : (
            <div className="flex flex-wrap justify-center gap-2">
              {phase === 'idle' && (
                <Button onClick={start} size="lg">
                  <Mic /> {t('record')}
                </Button>
              )}
              {phase === 'recording' && (
                <>
                  <Button variant="outline" onClick={pause}>
                    <Pause /> {t('pause')}
                  </Button>
                  <Button variant="destructive" onClick={stop}>
                    <Square /> {t('stop')}
                  </Button>
                </>
              )}
              {phase === 'paused' && (
                <>
                  <Button variant="outline" onClick={resume}>
                    <Play /> {t('resume')}
                  </Button>
                  <Button variant="destructive" onClick={stop}>
                    <Square /> {t('stop')}
                  </Button>
                </>
              )}
              {phase === 'stopped' && (
                <Button variant="outline" onClick={reset}>
                  <RotateCcw /> {t('rerecord')}
                </Button>
              )}
            </div>
          )}
          {previewUrl && <audio src={previewUrl} controls className="w-full" aria-label={t('preview')} />}
          {phase === 'idle' && (
            <label className="cursor-pointer text-sm text-primary underline-offset-4 hover:underline">
              <Upload className="mr-1 inline size-4" />
              {t('uploadFile')}
              <input
                type="file"
                accept="audio/*"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setBlob(f);
                    setPreviewUrl(URL.createObjectURL(f));
                    setPhase('stopped');
                    if (!title) setTitle(f.name.replace(/\.[^.]+$/, ''));
                  }
                }}
              />
            </label>
          )}
        </div>

        {phase === 'stopped' && blob && (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="story-title">{t('storyTitle')}</Label>
              <Input id="story-title" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="story-desc">{t('storyDescription')}</Label>
              <Textarea id="story-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <PartialDateInput id="story-date" label={t('storyDate')} value={date} onChange={setDate} />
            <PersonPicker persons={graph.data?.persons ?? []} value={personIds} onChange={setPersonIds} label={t('about')} />
            {progress !== null && (
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full bg-primary transition-all" style={{ width: `${progress * 100}%` }} />
              </div>
            )}
            <Button onClick={save} disabled={!title.trim() || progress !== null}>
              {progress !== null ? t('saving') : t('save')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
