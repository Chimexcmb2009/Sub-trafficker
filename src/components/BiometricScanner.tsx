import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Fingerprint,
  KeyRound,
  Loader2,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Upload,
  X,
} from 'lucide-react';
import { apiRequest } from '../lib/apiClient';
import { FaceVerificationStatus } from '../types';
import {
  authenticatePasskey,
  isPlatformAuthenticatorAvailable,
  isWebAuthnSupported,
  registerPasskey,
} from '../utils/webauthn';

interface BiometricScannerProps {
  mode: 'face' | 'fingerprint' | 'passkey';
  actionType?: 'register' | 'verify';
  userEmail?: string;
  hasFaceReference?: boolean;
  initialFaceStatus?: FaceVerificationStatus;
  onSuccess: (payload?: { faceStatus?: FaceVerificationStatus; provider?: string; confidence?: number | null }) => void;
  onCancel: () => void;
}

const STATUS_BADGE: Record<FaceVerificationStatus, { label: string; classes: string }> = {
  pending: { label: 'Pending', classes: 'bg-slate-800 text-slate-300 border-slate-700' },
  processing: { label: 'Processing', classes: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  verified: { label: 'Verified', classes: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  failed: { label: 'Failed', classes: 'bg-red-500/15 text-red-300 border-red-500/30' },
  retry_required: { label: 'Requires Another Attempt', classes: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
};

export const BiometricScanner: React.FC<BiometricScannerProps> = ({
  mode,
  actionType = 'verify',
  userEmail,
  hasFaceReference = false,
  initialFaceStatus = 'pending',
  onSuccess,
  onCancel,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [faceStatus, setFaceStatus] = useState<FaceVerificationStatus>(initialFaceStatus);
  const [hasRef, setHasRef] = useState<boolean>(hasFaceReference);
  const [capturedPreview, setCapturedPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [webAuthnReady, setWebAuthnReady] = useState<boolean>(false);

  useEffect(() => {
    isPlatformAuthenticatorAvailable().then(setWebAuthnReady);
  }, []);

  useEffect(() => {
    if (mode !== 'face') return;

    let active = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraReady(true);
      } catch (err: any) {
        setCameraError(
          err?.message || 'Camera permission unavailable. Upload a clear portrait image below or enable camera permissions.'
        );
      }
    })();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [mode]);

  const captureFrame = (): string | null => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return null;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    setCapturedPreview(dataUrl);
    return dataUrl;
  };

  const handleFileUpload = (file: File | undefined, isReference: boolean) => {
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setFeedback('Image must be under 4 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = String(reader.result || '');
      if (isReference) {
        await submitReferencePhoto(dataUrl);
      } else {
        setCapturedPreview(dataUrl);
        await submitLiveFaceVerification(dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const submitReferencePhoto = async (imageBase64: string) => {
    setSubmitting(true);
    setFeedback(null);
    const res = await apiRequest('/api/verification/face/reference', {
      method: 'POST',
      body: JSON.stringify({ imageBase64 }),
    });
    setSubmitting(false);

    if (res.ok && res.data.status) {
      setHasRef(true);
      setFaceStatus('pending');
      setCapturedPreview(null);
      setFeedback('Reference portrait saved securely. Now capture your live selfie to compare and verify.');
    } else {
      setFeedback(res.data?.message || 'Could not save reference portrait.');
    }
  };

  const submitLiveFaceVerification = async (frameDataUrl: string) => {
    setSubmitting(true);
    setFaceStatus('processing');
    setFeedback('Submitting live frame to identity verification provider...');

    const res = await apiRequest<{
      faceStatus?: FaceVerificationStatus;
      provider?: string;
      confidence?: number | null;
    }>('/api/verification/face/verify', {
      method: 'POST',
      body: JSON.stringify({ liveSelfieBase64: frameDataUrl }),
    });

    setSubmitting(false);
    const nextStatus = res.data?.faceStatus || (res.ok && res.data?.status ? 'verified' : 'retry_required');
    setFaceStatus(nextStatus);
    setFeedback(res.data?.message || 'Verification completed.');

    if (res.ok && res.data?.status && nextStatus === 'verified') {
      onSuccess({
        faceStatus: 'verified',
        provider: res.data.provider,
        confidence: res.data.confidence ?? null,
      });
    }
  };

  const handleCaptureClick = async () => {
    const frame = capturedPreview || captureFrame();
    if (!frame) {
      setFeedback('Camera stream is not ready yet. Wait a moment or upload an image file.');
      return;
    }
    if (!hasRef) {
      await submitReferencePhoto(frame);
    } else {
      await submitLiveFaceVerification(frame);
    }
  };

  const handleWebAuthnAction = async () => {
    setSubmitting(true);
    setFeedback(null);
    if (actionType === 'register') {
      const res = await registerPasskey('Sub Trafficker OS Biometric');
      setSubmitting(false);
      if (res.success) {
        onSuccess();
      } else {
        setFeedback(res.error || 'Passkey registration failed.');
      }
    } else {
      const res = await authenticatePasskey(userEmail);
      setSubmitting(false);
      if (res.success) {
        onSuccess();
      } else {
        setFeedback(res.error || 'Passkey verification failed.');
      }
    }
  };

  if (mode === 'face') {
    const badge = STATUS_BADGE[faceStatus];
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Camera className="w-5 h-5 text-amber-400" />
                Identity Face Verification
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                {hasRef
                  ? 'Step 2: Capture a live selfie to match against your stored reference identity photo.'
                  : 'Step 1: Capture or upload your clear reference identity portrait first.'}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <span className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${badge.classes}`}>
              {faceStatus === 'verified' ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : faceStatus === 'processing' ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5" />
              )}
              Status: {badge.label}
            </span>
            {hasRef && (
              <label className="text-xs text-amber-400 hover:text-amber-300 cursor-pointer underline">
                Replace reference photo
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleFileUpload(e.target.files?.[0], true)}
                />
              </label>
            )}
          </div>

          <div className="mt-4 relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900 flex items-center justify-center">
            {capturedPreview ? (
              <img src={capturedPreview} alt="Captured frame" className="h-full w-full object-cover" />
            ) : cameraError ? (
              <div className="p-4 text-center space-y-3">
                <ShieldAlert className="w-8 h-8 text-amber-400 mx-auto" />
                <p className="text-xs text-slate-300">{cameraError}</p>
                <label className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700 cursor-pointer">
                  <Upload className="w-4 h-4" />
                  {hasRef ? 'Upload Live Selfie Image' : 'Upload Reference ID Photo'}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files?.[0], !hasRef)}
                  />
                </label>
              </div>
            ) : (
              <>
                <video ref={videoRef} playsInline muted className="h-full w-full object-cover scale-x-[-1]" />
                {!cameraReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70">
                    <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
                  </div>
                )}
              </>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {feedback && (
            <div
              className={`mt-4 rounded-xl border p-3 text-xs leading-relaxed ${
                faceStatus === 'verified'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                  : faceStatus === 'failed' || faceStatus === 'retry_required'
                    ? 'border-red-500/30 bg-red-500/10 text-red-200'
                    : 'border-slate-700 bg-slate-900 text-slate-200'
              }`}
            >
              {feedback}
            </div>
          )}

          <div className="mt-5 flex items-center gap-3">
            {capturedPreview && (
              <button
                type="button"
                onClick={() => setCapturedPreview(null)}
                disabled={submitting}
                className="min-h-[44px] flex-1 rounded-xl border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-200 hover:bg-slate-800 inline-flex items-center justify-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Retake
              </button>
            )}
            <button
              type="button"
              onClick={handleCaptureClick}
              disabled={submitting || (!cameraReady && !capturedPreview)}
              className="min-h-[44px] flex-1 rounded-xl bg-amber-500 px-4 text-xs font-bold text-slate-950 hover:bg-amber-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {hasRef ? 'Submit & Compare Face' : 'Save Reference Portrait'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Real WebAuthn OS Platform Authenticator (Passkey / Fingerprint / Face ID / Windows Hello)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950 p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {mode === 'fingerprint' ? (
                <Fingerprint className="w-5 h-5 text-emerald-400" />
              ) : (
                <KeyRound className="w-5 h-5 text-amber-400" />
              )}
              {actionType === 'register' ? 'Register OS Passkey / Biometric' : 'Authenticate via WebAuthn Passkey'}
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Uses your operating system&apos;s hardware WebAuthn authenticator (Touch ID, Face ID, Android Biometrics, or Windows Hello).
            </p>
          </div>
          <button
            onClick={onCancel}
            className="min-w-[44px] min-h-[44px] inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-5 rounded-xl border border-slate-800 bg-slate-900/70 p-4 text-xs text-slate-300 space-y-2">
          <p className="font-semibold text-white">
            Hardware Support:{' '}
            <span className={webAuthnReady ? 'text-emerald-400' : 'text-amber-400'}>
              {isWebAuthnSupported()
                ? webAuthnReady
                  ? 'Platform Biometric Authenticator Available'
                  : 'WebAuthn Supported (External/Cross-Device Key)'
                : 'Unsupported Browser'}
            </span>
          </p>
          <p className="text-slate-400">
            Websites cannot access raw fingerprint sensors or Face ID templates directly. Authentication is verified cryptographically by our backend using FIDO2 signatures.
          </p>
        </div>

        {feedback && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{feedback}</div>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[44px] flex-1 rounded-xl border border-slate-700 bg-slate-900 text-xs font-semibold text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleWebAuthnAction}
            disabled={submitting || !isWebAuthnSupported()}
            className="min-h-[44px] flex-1 rounded-xl bg-emerald-500 px-4 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-50 inline-flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            {actionType === 'register' ? 'Enroll Device Passkey' : 'Continue with Passkey'}
          </button>
        </div>
      </div>
    </div>
  );
};
