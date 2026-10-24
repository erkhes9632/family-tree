'use client';
import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { Check, Copy, Link2, LogOut, Mail, QrCode, Trash2, UserMinus, X } from 'lucide-react';
import { CLANS } from '@super-project/genealogy';
import { TREE_PRIVACY, TREE_ROLES, type InvitationDto, type TreePrivacy, type TreeRole } from '@super-project/types';
import { useRouter } from '@/i18n/navigation';
import { ApiError, useApi } from '@/lib/api';
import { useAuthState } from '@/lib/auth';
import { SITE_URL } from '@/lib/config';
import { qk, useFriendRequests, useGraph, useInvalidatingMutation, useInvitations, useMembers } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { PRIVACY_ICONS } from '@/components/dashboard/create-tree-dialog';
import { HistoryList } from '@/components/person/history-list';
import { useTreeContext } from '@/components/tree/tree-context';

export default function SettingsPage() {
  const tree = useTreeContext();
  const t = useTranslations('settings');
  if (!tree.access.role) return <EmptyState className="m-6" title={t('membersOnly')} />;
  const admin = tree.access.canManage;
  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <Tabs defaultValue={admin ? 'general' : 'members'}>
        <TabsList>
          {admin && <TabsTrigger value="general">{t('tabs.general')}</TabsTrigger>}
          <TabsTrigger value="members">{t('tabs.members')}</TabsTrigger>
          {admin && <TabsTrigger value="invitations">{t('tabs.invitations')}</TabsTrigger>}
          {admin && tree.privacy === 'friends' && <TabsTrigger value="friends">{t('tabs.friends')}</TabsTrigger>}
          <TabsTrigger value="history">{t('tabs.history')}</TabsTrigger>
        </TabsList>
        {admin && (
          <TabsContent value="general">
            <General />
          </TabsContent>
        )}
        <TabsContent value="members">
          <Members />
        </TabsContent>
        {admin && (
          <TabsContent value="invitations">
            <Invitations />
          </TabsContent>
        )}
        {admin && (
          <TabsContent value="friends">
            <Friends />
          </TabsContent>
        )}
        <TabsContent value="history">
          <HistoryList treeId={tree.id} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function General() {
  const tree = useTreeContext();
  const t = useTranslations('settings');
  const tp = useTranslations('privacy');
  const tc = useTranslations('common');
  const locale = useLocale();
  const api = useApi();
  const router = useRouter();
  const graph = useGraph(tree.id);
  const [name, setName] = React.useState(tree.name);
  const [description, setDescription] = React.useState(tree.description ?? '');
  const [privacy, setPrivacy] = React.useState<TreePrivacy>(tree.privacy);
  const [clanId, setClanId] = React.useState(tree.clanId ?? 'none');
  const [rootPersonId, setRoot] = React.useState(tree.rootPersonId ?? 'none');
  const save = useInvalidatingMutation(
    () => api.patch(`/trees/${tree.id}`, { name, description: description || null, privacy, clanId: clanId === 'none' ? null : clanId, rootPersonId: rootPersonId === 'none' ? null : rootPersonId }),
    [qk.tree(tree.id), qk.trees],
  );
  const del = useInvalidatingMutation(() => api.del(`/trees/${tree.id}`), [qk.trees]);

  return (
    <div className="space-y-8">
      <form
        className="grid max-w-2xl gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await save.mutateAsync(undefined);
            toast.success(tc('saved'));
          } catch {
            toast.error(tc('error'));
          }
        }}
      >
        <div className="grid gap-1.5">
          <Label htmlFor="s-name">{t('name')}</Label>
          <Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="s-desc">{t('description')}</Label>
          <Textarea id="s-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-medium">{t('privacy')}</legend>
          {TREE_PRIVACY.map((p) => {
            const Icon = PRIVACY_ICONS[p];
            return (
              <label key={p} className={cn('flex cursor-pointer gap-3 rounded-lg border p-3 hover:bg-muted', privacy === p && 'border-primary bg-primary/5')}>
                <input type="radio" name="privacy" value={p} checked={privacy === p} onChange={() => setPrivacy(p)} className="mt-1 accent-[var(--primary)]" />
                <span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <Icon className="size-4" /> {tp(`${p}.label`)}
                  </span>
                  <span className="text-sm text-muted-foreground">{tp(`${p}.long`)}</span>
                </span>
              </label>
            );
          })}
          <p className="text-xs text-muted-foreground">{t('livingNote')}</p>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>{t('clan')}</Label>
            <Select value={clanId} onValueChange={setClanId}>
              <SelectTrigger aria-label={t('clan')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {CLANS.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {locale === 'mn' ? c.nameMn : c.nameEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>{t('rootPerson')}</Label>
            <Select value={rootPersonId} onValueChange={setRoot}>
              <SelectTrigger aria-label={t('rootPerson')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {graph.data?.persons.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.givenName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Button type="submit" disabled={save.isPending}>
            {save.isPending ? tc('saving') : tc('save')}
          </Button>
        </div>
      </form>

      <section className="max-w-2xl rounded-xl border border-destructive/40 p-4">
        <h3 className="font-sans font-semibold text-destructive">{t('danger')}</h3>
        <p className="mb-3 text-sm text-muted-foreground">{t('deleteText')}</p>
        <ConfirmDialog
          trigger={
            <Button variant="destructive">
              <Trash2 /> {t('deleteTree')}
            </Button>
          }
          title={t('deleteConfirm', { name: tree.name })}
          description={t('deleteText')}
          confirmLabel={t('deleteTree')}
          cancelLabel={tc('cancel')}
          onConfirm={async () => {
            try {
              await del.mutateAsync(undefined);
              router.push('/dashboard');
            } catch {
              toast.error(tc('error'));
            }
          }}
        />
      </section>
    </div>
  );
}

function Members() {
  const tree = useTreeContext();
  const t = useTranslations('settings');
  const tr = useTranslations('roles');
  const tc = useTranslations('common');
  const api = useApi();
  const router = useRouter();
  const { userId } = useAuthState();
  const members = useMembers(tree.id);
  const graph = useGraph(tree.id);
  const keys = [qk.members(tree.id)];
  const setRole = useInvalidatingMutation((v: { userId: string; role: TreeRole }) => api.patch(`/trees/${tree.id}/members/${v.userId}`, { role: v.role }), keys);
  const remove = useInvalidatingMutation((id: string) => api.del(`/trees/${tree.id}/members/${id}`), keys);
  const err = (e: unknown) => toast.error(e instanceof ApiError && e.status === 409 ? t('lastAdmin') : tc('error'));

  if (members.isLoading) return <Skeleton className="h-40" />;
  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-xl border bg-card">
        {members.data?.map((m) => {
          const person = m.personId ? graph.data?.persons.find((p) => p.id === m.personId) : undefined;
          const self = m.userId === userId;
          return (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {m.displayName ?? m.email ?? m.userId} {self && <Badge variant="outline">{t('you')}</Badge>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {[m.email, person && t('linkedAs', { name: person.givenName })].filter(Boolean).join(' · ')}
                </p>
              </div>
              {tree.access.canManage && !self ? (
                <>
                  <Select value={m.role} onValueChange={(role) => setRole.mutateAsync({ userId: m.userId, role: role as TreeRole }).catch(err)}>
                    <SelectTrigger className="h-9 w-32" aria-label={t('role')}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TREE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {tr(r)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <ConfirmDialog
                    trigger={
                      <Button size="icon-sm" variant="ghost" aria-label={t('remove')}>
                        <UserMinus />
                      </Button>
                    }
                    title={t('removeConfirm')}
                    confirmLabel={t('remove')}
                    cancelLabel={tc('cancel')}
                    onConfirm={async () => {
                      await remove.mutateAsync(m.userId).catch(err);
                    }}
                  />
                </>
              ) : (
                <Badge variant="secondary">{tr(m.role)}</Badge>
              )}
            </li>
          );
        })}
      </ul>
      <ConfirmDialog
        trigger={
          <Button variant="outline">
            <LogOut /> {t('leave')}
          </Button>
        }
        title={t('leaveConfirm')}
        confirmLabel={t('leave')}
        cancelLabel={tc('cancel')}
        onConfirm={async () => {
          try {
            await api.del(`/trees/${tree.id}/members/${userId}`);
            router.push('/dashboard');
          } catch (e) {
            err(e);
          }
        }}
      />
    </div>
  );
}

function Invitations() {
  const tree = useTreeContext();
  const t = useTranslations('invites');
  const tr = useTranslations('roles');
  const tc = useTranslations('common');
  const locale = useLocale();
  const api = useApi();
  const graph = useGraph(tree.id);
  const invites = useInvitations(tree.id);
  const [kind, setKind] = React.useState<'link' | 'email'>('link');
  const [email, setEmail] = React.useState('');
  const [role, setRole] = React.useState<TreeRole>('viewer');
  const [days, setDays] = React.useState('14');
  const [personId, setPersonId] = React.useState('none');
  const [message, setMessage] = React.useState('');
  const [created, setCreated] = React.useState<(InvitationDto & { url: string }) | null>(null);
  const create = useInvalidatingMutation(
    () =>
      api.post<InvitationDto & { url: string }>(`/trees/${tree.id}/invitations`, {
        kind,
        email: kind === 'email' ? email : undefined,
        role,
        expiresInDays: Number(days),
        personId: personId === 'none' ? null : personId,
        message: message || undefined,
      }),
    [qk.invitations(tree.id)],
  );
  const revoke = useInvalidatingMutation((id: string) => api.del(`/trees/${tree.id}/invitations/${id}`), [qk.invitations(tree.id)]);
  const unclaimed = graph.data?.persons.filter((p) => !p.userId) ?? [];
  const urlFor = (token: string) => `${SITE_URL}${locale === 'mn' ? '' : '/en'}/invite/${token}`;
  const fmt = new Intl.DateTimeFormat(locale === 'mn' ? 'mn-MN' : 'en-GB', { dateStyle: 'medium' });

  return (
    <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
      <form
        className="grid h-fit gap-3 rounded-xl border bg-card p-4"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            const inv = await create.mutateAsync(undefined);
            setCreated(inv);
            setEmail('');
            setMessage('');
            if (kind === 'email') toast.success(t('emailSent'));
          } catch (err) {
            toast.error(err instanceof ApiError && err.status === 429 ? t('rateLimited') : tc('error'));
          }
        }}
      >
        <h3 className="font-sans font-semibold">{t('new')}</h3>
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t('kind')}>
          {(['link', 'email'] as const).map((k) => (
            <Button key={k} type="button" role="radio" aria-checked={kind === k} variant={kind === k ? 'default' : 'outline'} onClick={() => setKind(k)}>
              {k === 'link' ? <Link2 /> : <Mail />} {t(`kinds.${k}`)}
            </Button>
          ))}
        </div>
        {kind === 'email' && (
          <div className="grid gap-1.5">
            <Label htmlFor="inv-email">{t('email')}</Label>
            <Input id="inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <div className="grid gap-1.5">
            <Label>{t('role')}</Label>
            <Select value={role} onValueChange={(v) => setRole(v as TreeRole)}>
              <SelectTrigger aria-label={t('role')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TREE_ROLES.map((r) => (
                  <SelectItem key={r} value={r}>
                    {tr(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label>{t('expires')}</Label>
            <Select value={days} onValueChange={setDays}>
              <SelectTrigger aria-label={t('expires')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {['1', '7', '14', '30', '90'].map((d) => (
                  <SelectItem key={d} value={d}>
                    {t('days', { n: Number(d) })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label>{t('linkPerson')}</Label>
          <Select value={personId} onValueChange={setPersonId}>
            <SelectTrigger aria-label={t('linkPerson')}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">{t('noPerson')}</SelectItem>
              {unclaimed.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.givenName} {p.patronymic ? `(${p.patronymic})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t('linkPersonHint')}</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="inv-msg">{t('message')}</Label>
          <Textarea id="inv-msg" rows={2} value={message} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <Button type="submit" disabled={create.isPending}>
          {kind === 'email' ? t('send') : t('createLink')}
        </Button>
      </form>

      <div className="space-y-3">
        {created && created.kind === 'link' && <ShareInvite url={urlFor(created.token)} onClose={() => setCreated(null)} />}
        <h3 className="font-sans font-semibold">{t('list')}</h3>
        {!invites.data?.length ? (
          <EmptyState title={t('none')} />
        ) : (
          <ul className="divide-y rounded-xl border bg-card">
            {invites.data.map((i) => {
              const state = i.revokedAt ? 'revoked' : i.expiresAt < Date.now() ? 'expired' : i.maxUses != null && i.useCount >= i.maxUses ? 'used' : 'active';
              return (
                <li key={i.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <span className="rounded-md bg-muted p-1.5">{i.kind === 'email' ? <Mail className="size-4" /> : <Link2 className="size-4" />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{i.email ?? t('kinds.link')}</p>
                    <p className="text-xs text-muted-foreground">
                      {tr(i.role)} · {t('usedCount', { n: i.useCount })} · {t('until', { date: fmt.format(i.expiresAt) })}
                    </p>
                  </div>
                  <Badge variant={state === 'active' ? 'blue' : 'secondary'}>{t(`state.${state}`)}</Badge>
                  {state === 'active' && (
                    <>
                      <ShareDialog url={urlFor(i.token)} />
                      <Button size="icon-sm" variant="ghost" aria-label={t('revoke')} onClick={() => revoke.mutateAsync(i.id).catch(() => toast.error(tc('error')))}>
                        <X />
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const tc = useTranslations('common');
  const [done, setDone] = React.useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check /> : <Copy />} {done ? tc('copied') : tc('copy')}
    </Button>
  );
}

function ShareInvite({ url, onClose }: { url: string; onClose?: () => void }) {
  const t = useTranslations('invites');
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-primary/40 bg-card p-4 sm:flex-row sm:items-start">
      <div className="rounded-lg bg-white p-2">
        <QRCodeSVG value={url} size={148} marginSize={1} title={t('qr')} />
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="font-medium">{t('shareTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('shareText')}</p>
        <Input readOnly value={url} onFocus={(e) => e.currentTarget.select()} aria-label={t('link')} />
        <div className="flex flex-wrap gap-2">
          <CopyButton text={url} />
          {typeof navigator !== 'undefined' && 'share' in navigator && (
            <Button size="sm" variant="outline" onClick={() => navigator.share({ url }).catch(() => undefined)}>
              {t('shareNative')}
            </Button>
          )}
          {onClose && (
            <Button size="sm" variant="ghost" onClick={onClose}>
              {t('done')}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ShareDialog({ url }: { url: string }) {
  const t = useTranslations('invites');
  const tc = useTranslations('common');
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="icon-sm" variant="ghost" aria-label={t('qr')}>
          <QrCode />
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogHeader>
          <DialogTitle>{t('shareTitle')}</DialogTitle>
          <DialogDescription>{t('shareText')}</DialogDescription>
        </DialogHeader>
        <ShareInvite url={url} />
      </DialogContent>
    </Dialog>
  );
}

function Friends() {
  const tree = useTreeContext();
  const t = useTranslations('friends');
  const tc = useTranslations('common');
  const api = useApi();
  const reqs = useFriendRequests(tree.id);
  const decide = useInvalidatingMutation((v: { userId: string; status: 'approved' | 'rejected' }) => api.patch(`/trees/${tree.id}/friend-requests/${v.userId}`, { status: v.status }), [qk.friends(tree.id)]);
  const remove = useInvalidatingMutation((userId: string) => api.del(`/trees/${tree.id}/friend-requests/${userId}`), [qk.friends(tree.id)]);
  if (reqs.isLoading) return <Skeleton className="h-32" />;
  if (!reqs.data?.length) return <EmptyState title={t('empty')} description={t('emptyText')} />;
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {reqs.data.map((r) => (
        <li key={r.userId} className="flex flex-wrap items-center gap-3 p-3 text-sm">
          <div className="min-w-0 flex-1">
            <p className="font-medium">{r.displayName ?? r.email ?? r.userId}</p>
            <p className="text-xs text-muted-foreground">{r.email}</p>
          </div>
          <Badge variant={r.status === 'approved' ? 'blue' : 'secondary'}>{t(`status.${r.status}`)}</Badge>
          {r.status !== 'approved' && (
            <Button size="sm" onClick={() => decide.mutateAsync({ userId: r.userId, status: 'approved' }).catch(() => toast.error(tc('error')))}>
              {t('approve')}
            </Button>
          )}
          {r.status === 'pending' && (
            <Button size="sm" variant="outline" onClick={() => decide.mutateAsync({ userId: r.userId, status: 'rejected' }).catch(() => toast.error(tc('error')))}>
              {t('reject')}
            </Button>
          )}
          {r.status === 'approved' && (
            <Button size="sm" variant="ghost" onClick={() => remove.mutateAsync(r.userId).catch(() => toast.error(tc('error')))}>
              {t('revoke')}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}
