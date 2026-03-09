'use client';

import { Download, QrCode } from 'lucide-react';

export default function WorkOrderQRCode({
  workOrderNumber,
  qrCode,
  compact = false,
}) {
  if (!qrCode) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <p className="text-sm text-gray-500">QR code not available for this work order.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 inline-flex items-center gap-2">
          <QrCode className="w-4 h-4 text-indigo-600" />
          Work Order QR
        </h3>
        <a
          href={qrCode}
          download={`${workOrderNumber || 'workorder'}-qr.png`}
          className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-700"
        >
          <Download className="w-3.5 h-3.5" /> Download
        </a>
      </div>

      <div className={`rounded-lg border border-gray-200 bg-gray-50 p-3 flex items-center justify-center ${compact ? 'max-w-40' : ''}`}>
        <img
          src={qrCode}
          alt={`QR code for ${workOrderNumber || 'work order'}`}
          className={compact ? 'w-28 h-28' : 'w-44 h-44'}
        />
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Scan to search <span className="font-mono text-gray-700">{workOrderNumber}</span>
      </p>
    </div>
  );
}
