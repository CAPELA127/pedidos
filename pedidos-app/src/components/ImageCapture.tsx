'use client';

import React, { useRef, useState, useEffect } from 'react';
import { Camera, Upload, X } from 'lucide-react';

interface ImageCaptureProps {
  onImageCapture: (file: File, source: 'camera' | 'upload') => void;
  disabled?: boolean;
}

export default function ImageCapture({ onImageCapture, disabled = false }: ImageCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [dragActive, setDragActive] = useState(false);

  // Detectar mobile
  useEffect(() => {
    const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    setIsMobile(mobile);
  }, []);

  // Iniciar cámara
  const startCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: isMobile ? 'environment' : 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
        setIsCameraActive(true);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      alert('No se pudo acceder a la cámara. Usa el cargador de archivos.');
    }
  };

  // Detener cámara
  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsCameraActive(false);
    }
  };

  // Tomar foto
  const takePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);

        canvasRef.current.toBlob(blob => {
          if (blob) {
            const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
            onImageCapture(file, 'camera');
            stopCamera();
          }
        }, 'image/jpeg', 0.95);
      }
    }
  };

  // Manejo de file picker
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageCapture(file, 'upload');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Drag & drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onImageCapture(file, 'upload');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {/* Input file oculto — id obligatorio para que el label lo active en iOS */}
      <input
        ref={fileInputRef}
        id="image-file-input"
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
        disabled={disabled || isCameraActive}
      />

      {/* Modo cámara activa */}
      {isCameraActive && (
        <div className="relative bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full h-auto"
            style={{ transform: isMobile ? 'none' : 'scaleX(-1)' }}
          />

          <div className="absolute inset-0 flex flex-col items-center justify-between p-4">
            {/* Botón cerrar */}
            <button
              onClick={stopCamera}
              className="self-start p-2 bg-red-500 text-white rounded-full hover:bg-red-600"
              title="Cerrar cámara"
            >
              <X size={20} />
            </button>

            {/* Botón tomar foto */}
            <button
              onClick={takePhoto}
              className="p-4 bg-blue-500 text-white rounded-full hover:bg-blue-600 shadow-lg"
              title="Tomar foto"
            >
              <Camera size={28} />
            </button>
          </div>

          {/* Canvas oculto para captura */}
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Modo file picker / drag & drop */}
      {!isCameraActive && (
        <div className="flex flex-col gap-2">
          {/* Drag & drop zone — label activa el input en iOS sin .click() */}
          <label
            htmlFor={disabled ? undefined : 'image-file-input'}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300 bg-gray-50 hover:border-blue-400'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <Upload size={24} className="mx-auto mb-2 text-gray-600" />
            <p className="text-sm font-medium text-gray-700">
              {dragActive ? 'Suelta la imagen' : 'Arrastra imagen o haz clic'}
            </p>
            <p className="text-xs text-gray-500">JPG, PNG o WebP • Máx 5MB</p>
          </label>

          {/* Botones de acción */}
          <div className="flex gap-2">
            {/* Botón cámara (solo mobile) */}
            {isMobile && (
              <button
                onClick={startCamera}
                disabled={disabled}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                  disabled
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-green-500 text-white hover:bg-green-600 active:scale-95'
                }`}
              >
                <Camera size={18} />
                <span className="text-sm">Cámara</span>
              </button>
            )}

            {/* Botón archivo — label nativo, funciona en iOS Safari */}
            <label
              htmlFor={disabled ? undefined : 'image-file-input'}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors ${
                disabled
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 text-white hover:bg-blue-600 active:scale-95 cursor-pointer'
              }`}
            >
              <Upload size={18} />
              <span className="text-sm">Archivo</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
