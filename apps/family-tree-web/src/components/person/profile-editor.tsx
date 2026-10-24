'use client';
import * as React from 'react';
import { Controller, useFieldArray, useForm, type Control, type UseFormRegister } from 'react-hook-form';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import { CONTACT_VISIBILITY, GENDERS, type PersonDto, type PersonUpdate } from '@super-project/types';
import { useApi } from '@/lib/api';
import { qk, useClans } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { PartialDateInput } from '@/components/forms/partial-date-input';
import { PlaceInput } from '@/components/forms/place-input';

type FormValues = Omit<PersonUpdate, 'previousNames' | 'nicknames'> & { previousNames: string; nicknames: string; customFields: { key: string; value: string }[] };

function toForm(p: PersonDto): FormValues {
  return {
    givenName: p.givenName,
    patronymic: p.patronymic ?? '',
    clanName: p.clanName ?? '',
    clanId: p.clanId,
    maidenName: p.maidenName ?? '',
    previousNames: p.previousNames.join(', '),
    nicknames: p.nicknames.join(', '),
    nameMongolScript: p.nameMongolScript ?? '',
    gender: p.gender,
    ethnicity: p.ethnicity ?? '',
    birthDate: p.birthDate,
    birthPlace: p.birthPlace,
    isLiving: p.isLiving,
    deathDate: p.deathDate,
    deathPlace: p.deathPlace,
    burialPlace: p.burialPlace,
    causeOfDeath: p.causeOfDeath ?? '',
    memorial: p.memorial ?? '',
    residence: p.residence,
    education: p.education,
    occupation: p.occupation ?? '',
    workplaces: p.workplaces,
    militaryService: p.militaryService ?? '',
    awards: p.awards,
    achievements: p.achievements ?? '',
    hobbies: p.hobbies ?? '',
    favorites: p.favorites ?? '',
    biography: p.biography ?? '',
    favoriteQuote: p.favoriteQuote ?? '',
    messageToDescendants: p.messageToDescendants ?? '',
    contacts: p.contacts ?? { phone: '', email: '', address: '', social: '' },
    contactsVisibility: p.contactsVisibility,
    customFields: p.customFields.map((f) => ({ key: f.key, value: f.value })),
  };
}

const blank = (s: string | null | undefined) => (s && s.trim() ? s.trim() : null);
const list = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);
const yearOrNull = (v: unknown) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));

export function ProfileEditor({ person, treeId, onDone }: { person: PersonDto; treeId: string; onDone: () => void }) {
  const t = useTranslations('profile');
  const tg = useTranslations('gender');
  const tc = useTranslations('common');
  const locale = useLocale();
  const api = useApi();
  const qc = useQueryClient();
  const clans = useClans();
  const form = useForm<FormValues>({ defaultValues: toForm(person) });
  const { register, control, watch, handleSubmit, formState } = form;
  const isLiving = watch('isLiving');

  const onSubmit = handleSubmit(async (v) => {
    const { customFields, contacts, ...rest } = v;
    const body: PersonUpdate = {
      ...rest,
      givenName: v.givenName?.trim() || person.givenName,
      patronymic: blank(v.patronymic),
      clanName: blank(v.clanName),
      maidenName: blank(v.maidenName),
      previousNames: list(v.previousNames),
      nicknames: list(v.nicknames),
      nameMongolScript: blank(v.nameMongolScript),
      ethnicity: blank(v.ethnicity),
      causeOfDeath: blank(v.causeOfDeath),
      memorial: blank(v.memorial),
      occupation: blank(v.occupation),
      militaryService: blank(v.militaryService),
      achievements: blank(v.achievements),
      hobbies: blank(v.hobbies),
      favorites: blank(v.favorites),
      biography: blank(v.biography),
      favoriteQuote: blank(v.favoriteQuote),
      messageToDescendants: blank(v.messageToDescendants),
      contacts: contacts && Object.values(contacts).some((x) => x && String(x).trim()) ? contacts : null,
      education: (v.education ?? []).filter((e) => e.institution.trim()).map((e) => ({ ...e, fromYear: yearOrNull(e.fromYear), toYear: yearOrNull(e.toYear) })),
      workplaces: (v.workplaces ?? []).filter((w) => w.organization.trim()).map((w) => ({ ...w, fromYear: yearOrNull(w.fromYear), toYear: yearOrNull(w.toYear) })),
      awards: (v.awards ?? []).filter((a) => a.title.trim()).map((a) => ({ ...a, year: yearOrNull(a.year) })),
    };
    if (body.isLiving) {
      body.deathDate = null;
      body.deathPlace = null;
      body.burialPlace = null;
    }
    try {
      await api.patch(`/trees/${treeId}/persons/${person.id}`, body);
      const before = JSON.stringify(person.customFields.map((f) => [f.key, f.value]));
      const after = customFields.filter((f) => f.key.trim());
      if (before !== JSON.stringify(after.map((f) => [f.key, f.value]))) {
        await api.put(`/trees/${treeId}/persons/${person.id}/custom-fields`, { fields: after });
      }
      await Promise.all([qc.invalidateQueries({ queryKey: qk.person(treeId, person.id) }), qc.invalidateQueries({ queryKey: qk.graph(treeId) })]);
      toast.success(tc('saved'));
      onDone();
    } catch {
      toast.error(tc('error'));
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-8" noValidate>
      <Fieldset title={t('sections.names')}>
        <Grid>
          <Field id="givenName" label={t('givenName')}>
            <Input id="givenName" {...register('givenName', { required: true })} aria-invalid={!!formState.errors.givenName} />
          </Field>
          <Field id="patronymic" label={t('patronymic')} hint={t('patronymicHint')}>
            <Input id="patronymic" {...register('patronymic')} />
          </Field>
          <Field id="clanName" label={t('clanName')}>
            <Input id="clanName" {...register('clanName')} />
          </Field>
          <Field id="clanId" label={t('clanLink')}>
            <Controller
              control={control}
              name="clanId"
              render={({ field }) => (
                <Select value={field.value ?? 'none'} onValueChange={(v) => field.onChange(v === 'none' ? null : v)}>
                  <SelectTrigger id="clanId">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {clans.data?.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {locale === 'mn' ? c.nameMn : c.nameEn}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>
          <Field id="maidenName" label={t('maidenName')}>
            <Input id="maidenName" {...register('maidenName')} />
          </Field>
          <Field id="previousNames" label={t('previousNames')} hint={t('commaHint')}>
            <Input id="previousNames" {...register('previousNames')} />
          </Field>
          <Field id="nicknames" label={t('nicknames')} hint={t('commaHint')}>
            <Input id="nicknames" {...register('nicknames')} />
          </Field>
          <Field id="nameMongolScript" label={t('mongolScript')}>
            <Input id="nameMongolScript" lang="mn-Mong" className="font-mongol" {...register('nameMongolScript')} />
          </Field>
          <Field id="gender" label={t('gender')}>
            <Controller
              control={control}
              name="gender"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="gender">
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
          </Field>
          <Field id="ethnicity" label={t('ethnicity')}>
            <Input id="ethnicity" {...register('ethnicity')} />
          </Field>
        </Grid>
      </Fieldset>

      <Fieldset title={t('sections.lifeDeath')}>
        <Controller control={control} name="birthDate" render={({ field }) => <PartialDateInput id="birthDate" label={t('birthDate')} value={field.value} onChange={field.onChange} />} />
        <Controller control={control} name="birthPlace" render={({ field }) => <PlaceInput id="birthPlace" label={t('birthPlace')} value={field.value} onChange={field.onChange} />} />
        <div className="flex items-center justify-between gap-3 rounded-lg border p-3">
          <Label htmlFor="isLiving">{t('isLiving')}</Label>
          <Controller control={control} name="isLiving" render={({ field }) => <Switch id="isLiving" checked={!!field.value} onCheckedChange={field.onChange} />} />
        </div>
        {isLiving ? (
          <Controller control={control} name="residence" render={({ field }) => <PlaceInput id="residence" label={t('residence')} value={field.value} onChange={field.onChange} />} />
        ) : (
          <>
            <Controller control={control} name="deathDate" render={({ field }) => <PartialDateInput id="deathDate" label={t('deathDate')} value={field.value} onChange={field.onChange} />} />
            <Controller control={control} name="deathPlace" render={({ field }) => <PlaceInput id="deathPlace" label={t('deathPlace')} value={field.value} onChange={field.onChange} />} />
            <Controller control={control} name="burialPlace" render={({ field }) => <PlaceInput id="burialPlace" label={t('burialPlace')} value={field.value} onChange={field.onChange} />} />
            <Field id="causeOfDeath" label={t('causeOfDeath')} hint={t('optional')}>
              <Input id="causeOfDeath" {...register('causeOfDeath')} />
            </Field>
            <Field id="memorial" label={t('memorial')}>
              <Textarea id="memorial" rows={3} {...register('memorial')} />
            </Field>
          </>
        )}
      </Fieldset>

      <Fieldset title={t('sections.work')}>
        <Grid>
          <Field id="occupation" label={t('occupation')}>
            <Input id="occupation" {...register('occupation')} />
          </Field>
        </Grid>
        <ArrayEditor
          control={control}
          register={register}
          name="education"
          title={t('education')}
          empty={{ institution: '', degree: '', field: '', fromYear: null, toYear: null }}
          fields={[
            { key: 'institution', label: t('institution') },
            { key: 'field', label: t('field') },
            { key: 'degree', label: t('degree') },
            { key: 'fromYear', label: t('fromYear'), numeric: true },
            { key: 'toYear', label: t('toYear'), numeric: true },
          ]}
        />
        <ArrayEditor
          control={control}
          register={register}
          name="workplaces"
          title={t('workplaces')}
          empty={{ organization: '', position: '', fromYear: null, toYear: null }}
          fields={[
            { key: 'organization', label: t('organization') },
            { key: 'position', label: t('position') },
            { key: 'fromYear', label: t('fromYear'), numeric: true },
            { key: 'toYear', label: t('toYear'), numeric: true },
          ]}
        />
        <Field id="militaryService" label={t('militaryService')}>
          <Textarea id="militaryService" rows={2} {...register('militaryService')} />
        </Field>
        <ArrayEditor
          control={control}
          register={register}
          name="awards"
          title={t('awards')}
          empty={{ title: '', year: null, description: '' }}
          fields={[
            { key: 'title', label: t('awardTitle') },
            { key: 'year', label: t('year'), numeric: true },
            { key: 'description', label: t('awardDescription') },
          ]}
        />
        <Field id="achievements" label={t('achievements')}>
          <Textarea id="achievements" rows={3} {...register('achievements')} />
        </Field>
      </Fieldset>

      <Fieldset title={t('sections.story')}>
        <Field id="biography" label={t('biography')}>
          <Textarea id="biography" rows={8} {...register('biography')} />
        </Field>
        <Grid>
          <Field id="hobbies" label={t('hobbies')}>
            <Textarea id="hobbies" rows={2} {...register('hobbies')} />
          </Field>
          <Field id="favorites" label={t('favorites')}>
            <Textarea id="favorites" rows={2} {...register('favorites')} />
          </Field>
        </Grid>
        <Field id="favoriteQuote" label={t('favoriteQuote')}>
          <Input id="favoriteQuote" {...register('favoriteQuote')} />
        </Field>
        <Field id="messageToDescendants" label={t('messageToDescendants')}>
          <Textarea id="messageToDescendants" rows={4} {...register('messageToDescendants')} />
        </Field>
      </Fieldset>

      {isLiving && (
        <Fieldset title={t('sections.contacts')} description={t('contactsHint')}>
          <Grid>
            <Field id="phone" label={t('phone')}>
              <Input id="phone" type="tel" {...register('contacts.phone')} />
            </Field>
            <Field id="email" label={t('email')}>
              <Input id="email" type="email" {...register('contacts.email')} />
            </Field>
            <Field id="address" label={t('address')}>
              <Input id="address" {...register('contacts.address')} />
            </Field>
            <Field id="social" label={t('social')}>
              <Input id="social" {...register('contacts.social')} />
            </Field>
            <Field id="contactsVisibility" label={t('contactsVisibility')}>
              <Controller
                control={control}
                name="contactsVisibility"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="contactsVisibility">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CONTACT_VISIBILITY.map((c) => (
                        <SelectItem key={c} value={c}>
                          {t(`visibility.${c}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </Field>
          </Grid>
        </Fieldset>
      )}

      <Fieldset title={t('sections.custom')} description={t('customHint')}>
        <CustomFields control={control} register={register} />
      </Fieldset>

      <div className="sticky bottom-0 -mx-4 flex justify-end gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur">
        <Button type="button" variant="outline" onClick={onDone}>
          {tc('cancel')}
        </Button>
        <Button type="submit" disabled={formState.isSubmitting}>
          {formState.isSubmitting ? tc('saving') : tc('save')}
        </Button>
      </div>
    </form>
  );
}

function Fieldset({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-4">
      <legend className="font-serif text-xl font-semibold">{title}</legend>
      {description && <p className="-mt-2 text-sm text-muted-foreground">{description}</p>}
      {children}
    </fieldset>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

type ArrayName = 'education' | 'workplaces' | 'awards';

function ArrayEditor({
  control,
  register,
  name,
  title,
  fields,
  empty,
}: {
  control: Control<FormValues>;
  register: UseFormRegister<FormValues>;
  name: ArrayName;
  title: string;
  fields: { key: string; label: string; numeric?: boolean }[];
  empty: Record<string, unknown>;
}) {
  const tc = useTranslations('common');
  const arr = useFieldArray({ control, name: name as 'education' });
  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">{title}</p>
      {arr.fields.map((f, i) => (
        <div key={f.id} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[repeat(auto-fit,minmax(8rem,1fr))_auto]">
          {fields.map((fd) => (
            <Input
              key={fd.key}
              aria-label={fd.label}
              placeholder={fd.label}
              inputMode={fd.numeric ? 'numeric' : undefined}
              {...register(`${name}.${i}.${fd.key}` as 'education.0.institution')}
            />
          ))}
          <Button type="button" size="icon" variant="ghost" onClick={() => arr.remove(i)} aria-label={tc('remove')}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => arr.append(empty as never)}>
        <Plus /> {tc('add')}
      </Button>
    </div>
  );
}

function CustomFields({ control, register }: { control: Control<FormValues>; register: UseFormRegister<FormValues> }) {
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const arr = useFieldArray({ control, name: 'customFields' });
  return (
    <div className="space-y-2">
      {arr.fields.map((f, i) => (
        <div key={f.id} className="grid grid-cols-[1fr_2fr_auto] gap-2">
          <Input aria-label={t('customKey')} placeholder={t('customKey')} {...register(`customFields.${i}.key`)} />
          <Input aria-label={t('customValue')} placeholder={t('customValue')} {...register(`customFields.${i}.value`)} />
          <Button type="button" size="icon" variant="ghost" onClick={() => arr.remove(i)} aria-label={tc('remove')}>
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => arr.append({ key: '', value: '' })}>
        <Plus /> {t('addCustom')}
      </Button>
    </div>
  );
}
