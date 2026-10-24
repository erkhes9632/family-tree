'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Bell, BellOff, Mail } from 'lucide-react';
import { REMINDER_KINDS, type NotificationPrefs, type ReminderKind } from '@super-project/types';
import { useApi } from '@/lib/api';
import { disablePush, enablePush } from '@/lib/push';
import { qk, useInvalidatingMutation, useNotificationPrefs } from '@/lib/queries';
import { RequireAuth } from '@/components/auth/require-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

const TIMEZONES = ['Asia/Ulaanbaatar', 'Asia/Hovd', 'Asia/Choibalsan', 'Asia/Seoul', 'Asia/Tokyo', 'Asia/Shanghai', 'Europe/Berlin', 'Europe/London', 'America/New_York', 'America/Los_Angeles', 'Australia/Sydney', 'UTC'];

export default function AccountSettingsPage() {
  return (
    <RequireAuth>
      <Prefs />
    </RequireAuth>
  );
}

function Prefs() {
  const t = useTranslations('notifications');
  const tu = useTranslations('upcoming');
  const tc = useTranslations('common');
  const api = useApi();
  const prefs = useNotificationPrefs();
  const [v, setV] = React.useState<NotificationPrefs | null>(null);
  React.useEffect(() => {
    if (prefs.data && !v) setV({ emailEnabled: prefs.data.emailEnabled, pushEnabled: prefs.data.pushEnabled, daysBefore: prefs.data.daysBefore, kinds: prefs.data.kinds, timezone: prefs.data.timezone });
  }, [prefs.data, v]);
  const save = useInvalidatingMutation((body: NotificationPrefs) => api.put('/me/notification-prefs', body), [qk.prefs]);
  if (!v) return <Skeleton className="mx-auto my-8 h-96 max-w-2xl" />;

  const toggleKind = (k: ReminderKind) => setV({ ...v, kinds: v.kinds.includes(k) ? v.kinds.filter((x) => x !== k) : [...v.kinds, k] });
  const zones = TIMEZONES.includes(v.timezone) ? TIMEZONES : [v.timezone, ...TIMEZONES];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-semibold">{t('title')}</h1>
      <Card>
        <CardHeader>
          <CardTitle>{t('reminders')}</CardTitle>
          <CardDescription>{t('remindersText')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="n-email" className="flex items-center gap-2">
              <Mail className="size-4" /> {t('email')}
              {prefs.data?.emailAddress && <span className="text-xs font-normal text-muted-foreground">({prefs.data.emailAddress})</span>}
            </Label>
            <Switch id="n-email" checked={v.emailEnabled} onCheckedChange={(c) => setV({ ...v, emailEnabled: c })} />
          </div>
          <div className="flex items-center justify-between gap-4">
            <Label htmlFor="n-push" className="flex items-center gap-2">
              <Bell className="size-4" /> {t('push')}
            </Label>
            <Switch
              id="n-push"
              checked={v.pushEnabled}
              onCheckedChange={async (c) => {
                if (c) {
                  const res = await enablePush(api).catch(() => 'unsupported' as const);
                  if (res !== 'ok') {
                    toast.error(t(`pushError.${res}`));
                    return;
                  }
                  toast.success(t('pushOn'));
                } else {
                  await disablePush(api);
                }
                setV({ ...v, pushEnabled: c });
              }}
            />
          </div>
          <div className="grid gap-1.5">
            <Label>{t('daysBefore')}</Label>
            <Select value={String(v.daysBefore)} onValueChange={(d) => setV({ ...v, daysBefore: Number(d) })}>
              <SelectTrigger aria-label={t('daysBefore')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[0, 1, 2, 3, 7, 14].map((d) => (
                  <SelectItem key={d} value={String(d)}>
                    {d === 0 ? t('sameDay') : t('nDays', { n: d })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t('kinds')}</legend>
            {REMINDER_KINDS.map((k) => (
              <label key={k} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-sm">
                {tu(`kind.${k}`, { years: 0, hasYears: 'no' })}
                <Switch checked={v.kinds.includes(k)} onCheckedChange={() => toggleKind(k)} aria-label={tu(`kind.${k}`, { years: 0, hasYears: 'no' })} />
              </label>
            ))}
          </fieldset>
          <div className="grid gap-1.5">
            <Label>{t('timezone')}</Label>
            <Select value={v.timezone} onValueChange={(z) => setV({ ...v, timezone: z })}>
              <SelectTrigger aria-label={t('timezone')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {zones.map((z) => (
                  <SelectItem key={z} value={z}>
                    {z}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t('timezoneHint')}</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={async () => {
                try {
                  await save.mutateAsync(v);
                  toast.success(tc('saved'));
                } catch {
                  toast.error(tc('error'));
                }
              }}
              disabled={save.isPending}
            >
              {tc('save')}
            </Button>
            {!v.emailEnabled && !v.pushEnabled && (
              <p className="flex items-center gap-1 text-sm text-muted-foreground">
                <BellOff className="size-4" /> {t('allOff')}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
