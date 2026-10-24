'use client';
import * as React from 'react';
import { AlertDialog as AD } from 'radix-ui';
import { buttonVariants } from './button';
import { cn } from '@/lib/utils';

/** Simple confirm dialog. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive = true,
  onConfirm,
  open,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  title: string;
  description?: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void | Promise<void>;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}) {
  return (
    <AD.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <AD.Trigger asChild>{trigger}</AD.Trigger>}
      <AD.Portal>
        <AD.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <AD.Content className="fixed top-1/2 left-1/2 z-50 grid w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl border bg-popover p-6 shadow-xl">
          <AD.Title className="font-serif text-lg font-semibold">{title}</AD.Title>
          {description && <AD.Description className="text-sm text-muted-foreground">{description}</AD.Description>}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AD.Cancel className={buttonVariants({ variant: 'outline' })}>{cancelLabel}</AD.Cancel>
            <AD.Action className={cn(buttonVariants({ variant: destructive ? 'destructive' : 'default' }))} onClick={() => void onConfirm()}>
              {confirmLabel}
            </AD.Action>
          </div>
        </AD.Content>
      </AD.Portal>
    </AD.Root>
  );
}
