'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { Camera, CameraOff, ScanLine, X } from 'lucide-react';

export default function QRScannerModal({
  isOpen,
  onClose,
  onScan,
  title = 'Scan QR Code',
}) {
  const scannerContainerId = useId().replace(/:/g, '_');
  const scannerRef = useRef(null);
  const scannedRef = useRef(false);
  const [manualValue, setManualValue] = useState('');
  const [isStarting, setIsStarting] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [restartToken, setRestartToken] = useState(0);

  const stopAndClearScanner = async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;

    if (!scanner) return;

    try {
      const state = typeof scanner.getState === 'function' ? scanner.getState() : null;
      const isRunning = state === 2 || state === 3;

      if (isRunning) {
        await scanner.stop();
      }
    } catch (_) {
      // Ignore stop errors when scanner never fully started or already stopped.
    }

    try {
      await scanner.clear();
    } catch (_) {
      // Ignore clear errors from detached scanner state.
    }
  };

  useEffect(() => {
    if (!isOpen) {
      scannedRef.current = false;
      setCameraError('');
      return;
    }

    let cancelled = false;

    const startScanner = async () => {
      setIsStarting(true);
      setCameraError('');

      try {
        const { Html5Qrcode } = await import('html5-qrcode');
        if (cancelled) return;

        const scanner = new Html5Qrcode(scannerContainerId, {
          verbose: false,
        });
        scannerRef.current = scanner;

        const onDecode = (decodedText) => {
          if (scannedRef.current) return;
          scannedRef.current = true;
          onScan?.(decodedText);
        };

        const startConfigs = [
          { facingMode: 'environment' },
          { facingMode: 'user' },
        ];

        let started = false;

        for (const cameraConfig of startConfigs) {
          try {
            await scanner.start(cameraConfig, { fps: 10, qrbox: 220 }, onDecode, () => {});
            started = true;
            break;
          } catch (_) {
            // Try next camera strategy.
          }
        }

        if (!started) {
          const cameras = await Html5Qrcode.getCameras();
          if (Array.isArray(cameras) && cameras.length > 0) {
            await scanner.start(cameras[0].id, { fps: 10, qrbox: 220 }, onDecode, () => {});
            started = true;
          }
        }

        if (!started) {
          throw new Error('Unable to start camera scanner');
        }
      } catch (error) {
        setCameraError('Camera unavailable. Allow browser camera permission or use manual code entry below.');
      } finally {
        if (!cancelled) {
          setIsStarting(false);
        }
      }
    };

    startScanner();

    return () => {
      cancelled = true;
      stopAndClearScanner();
    };
  }, [isOpen, onScan, scannerContainerId, restartToken]);

  const handleRetryCamera = async () => {
    setCameraError('');
    scannedRef.current = false;
    await stopAndClearScanner();
    setRestartToken((currentToken) => currentToken + 1);
  };

  const handleManualSubmit = (event) => {
    event.preventDefault();
    const value = manualValue.trim();
    if (!value) return;
    setManualValue('');
    onScan?.(value);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-xl bg-white border border-gray-200 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-indigo-600" />
            {title}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition"
            aria-label="Close scanner"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
            <div id={scannerContainerId} className="w-full min-h-64" />
            {isStarting && (
              <p className="text-xs text-gray-500 mt-2 inline-flex items-center gap-1">
                <Camera className="w-3.5 h-3.5" /> Starting camera...
              </p>
            )}
            {cameraError && (
              <div className="mt-2 space-y-2">
                <p className="text-xs text-amber-700 inline-flex items-center gap-1">
                  <CameraOff className="w-3.5 h-3.5" /> {cameraError}
                </p>
                <button
                  type="button"
                  onClick={handleRetryCamera}
                  className="text-xs px-3 py-1.5 rounded-md border border-amber-300 text-amber-800 hover:bg-amber-50 transition"
                >
                  Retry Camera
                </button>
              </div>
            )}
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Manual Code Entry
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={manualValue}
                onChange={(event) => setManualValue(event.target.value)}
                placeholder="Enter scanned work order code"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
              >
                Use
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
