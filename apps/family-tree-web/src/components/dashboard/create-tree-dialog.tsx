'use client';
import * as React from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { z } from 'zod';
import { Globe, Lock, Plus, Users } from 'lucide-react';
import { GENDERS, TREE_PRIVACY, type TreeWithAccess } from '@super-project/types';
import { useRouter } from '@/i18n/navigation';
import { useApi } from '@/lib/api';
import { qk, useInvalidatingMutation } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).optional(),
  privacy: z.enum(TREE_PRIVACY),
  startWithSelf: z.boolean(),
  givenName: z.string().max(120).optional(),
  patronymic: z.string().max(120).optional(),
  gender: z.enum(GENDERS),
  birthYear: z.string().regex(/^\d{0,4}$/).optional(),
});
type Values = z.infer<typeof schema>;

export const PRIVACY_ICONS = { family: Lock, friends: Users, public: Globe } as const;

export function CreateTreeDialog({ trigger }: { trigger?: React.ReactNode }) {
  const t = useTranslations('createTree');
  const tp = useTranslations('privacy');
  const tg = useTranslations('gender');
  const tc = useTranslations('common');
  const api = useApi();
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', description: '', privacy: 'family', startWithSelf: true, givenName: '', patronymic: '', gender: 'unknown', birthYear: '' },
  });
  const startWithSelf = form.watch('startWithSelf');
  const create = useInvalidatingMutation(
    (v: Values) =>
      api.post<TreeWithAccess>('/trees', {
        name: v.name,
        description: v.description || null,
        privacy: v.privacy,
        self:
          v.startWithSelf && v.givenName?.trim()
            ? {
                givenName: v.givenName.trim(),
                patronymic: v.patronymic?.trim() || null,
                gender: v.gender,
                isLiving: true,
                birthDate: v.birthYear ? { year: Number(v.birthYear), qualifier: 'exact' } : null,
              }
            : undefined,
      }),
    [qk.trees],
  );

  const onSubmit = form.handleSubmit(async (v) => {
    if (v.startWithSelf && !v.givenName?.trim()) {
      form.setError('givenName', { message: tc('required') });
      return;
    }
    try {
      const tree = await create.mutateAsync(v);
      setOpen(false);
      form.reset();
      toast.success(t('created'));
      router.push(`/trees/${tree.id}`);
    } catch {
      toast.error(tc('error'));
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus /> {t('button')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <div className="grid gap-1.5">
            <Label htmlFor="tree-name">{t('name')}</Label>
            <Input id="tree-name" placeholder={t('namePlaceholder')} aria-invalid={!!form.formState.errors.name} {...form.register('name')} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="tree-desc">{t('about')}</Label>
            <Textarea id="tree-desc" rows={2} {...form.register('description')} />
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-1 text-sm font-medium">{t('privacy')}</legend>
            <Controller
              control={form.control}
              name="privacy"
              render={({ field }) => (
                <div role="radiogroup" className="grid gap-2 sm:grid-cols-3">
                  {TREE_PRIVACY.map((p) => {
                    const Icon = PRIVACY_ICONS[p];
                    const active = field.value === p;
                    return (
                      <button
                        key={p}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => field.onChange(p)}
                        className={cn('rounded-lg border p-3 text-left transition-colors hover:bg-muted', active && 'border-primary bg-primary/5 ring-1 ring-primary')}
                      >
                        <Icon className="mb-1 size-4 text-primary" />
                        <span className="block text-sm font-medium">{tp(`${p}.label`)}</span>
                        <span className="block text-xs text-muted-foreground">{tp(`${p}.short`)}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            />
          </fieldset>
          <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
            <Label htmlFor="self">{t('startWithSelf')}</Label>
            <Controller control={form.control} name="startWithSelf" render={({ field }) => <Switch id="self" checked={field.value} onCheckedChange={field.onChange} />} />
          </div>
          {startWithSelf && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="self-given">{t('yourName')}</Label>
                <Input id="self-given" aria-invalid={!!form.formState.errors.givenName} {...form.register('givenName')} />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="self-pat">{t('yourPatronymic')}</Label>
                <Input id="self-pat" {...form.register('patronymic')} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('gender')}</Label>
                <Controller
                  control={form.control}
                  name="gender"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger aria-label={t('gender')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDERS.map((g) => (
                          <SelectItem key={g} value={g}>
                            {tg(g)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="self-year">{t('birthYear')}</Label>
                <Input id="self-year" inputMode="numeric" {...form.register('birthYear')} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? tc('saving') : t('submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
