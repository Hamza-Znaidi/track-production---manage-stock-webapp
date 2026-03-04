'use client';

import AppDropdown from '@/components/AppDropdown';

export default function StageWorkerDropdown({
  selectedWorkerId,
  availableWorkers,
  onSelect,
}) {
  const options = [
    { value: '', label: 'Assign later' },
    ...availableWorkers.map((worker) => ({
      value: String(worker.id),
      label: worker.username,
    })),
  ];

  return (
    <AppDropdown
      value={selectedWorkerId}
      onValueChange={onSelect}
      options={options}
      placeholder="Assign later"
      className="bg-white"
    />
  );
}
