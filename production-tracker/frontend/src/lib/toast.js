'use client';

import { useState } from 'react';
import { toast } from 'sonner';

export function notifySuccess(message, options = {}) {
  toast.success(message, options);
}

export function notifyError(message, options = {}) {
  toast.error(message, options);
}

export function notifyInfo(message, options = {}) {
  toast(message, options);
}

export function confirmToast({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
}) {
  const toastId = toast(title, {
    description,
    duration: 12000,
    action: {
      label: confirmLabel,
      onClick: async () => {
        toast.dismiss(toastId);
        await onConfirm?.();
      },
    },
    cancel: {
      label: cancelLabel,
      onClick: () => {
        toast.dismiss(toastId);
      },
    },
  });

  return toastId;
}

function NumberPromptToast({
  toastId,
  title,
  description,
  defaultValue,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onInvalid,
}) {
  const [value, setValue] = useState(defaultValue);

  const handleConfirm = async () => {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      onInvalid?.();
      return;
    }

    toast.dismiss(toastId);
    await onConfirm?.(parsed);
  };

  return (
    <div className="w-full max-w-sm rounded-lg border border-gray-200 bg-white p-3 shadow-md">
      <p className="text-sm font-semibold text-gray-900">{title}</p>
      {description ? <p className="mt-1 text-xs text-gray-600">{description}</p> : null}

      <input
        type="number"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="mt-3 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none"
      />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={handleConfirm}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white"
        >
          {confirmLabel}
        </button>
        <button
          type="button"
          onClick={() => toast.dismiss(toastId)}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700"
        >
          {cancelLabel}
        </button>
      </div>
    </div>
  );
}

export function promptNumberToast({
  title,
  description,
  defaultValue = '',
  confirmLabel = 'Apply',
  cancelLabel = 'Cancel',
  onConfirm,
  onInvalid,
  duration = 25000,
}) {
  const toastId = toast.custom((id) => (
    <NumberPromptToast
      toastId={id}
      title={title}
      description={description}
      defaultValue={String(defaultValue)}
      confirmLabel={confirmLabel}
      cancelLabel={cancelLabel}
      onConfirm={onConfirm}
      onInvalid={onInvalid}
    />
  ), {
    duration,
  });

  return toastId;
}
