import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Camera, Image as ImageIcon, Trash2, X, RefreshCw, Video, Square, Circle, Play,
  Mic, Loader2, Sparkles,
  Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight,
  MapPin, User, FileText, CheckCircle, AlertTriangle, Send, Menu, FileDown, Download, LogIn, LogOut, UserPlus
} from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

// ============================================================================
// 1. TYPES & INTERFACES
// ============================================================================
interface InspectionFormState {
  collaboratorName: string;
  dateTime: string;
  collaboratorArea: string;
  unit: string;
  location: string;
  description: string;
  photoInspection: File | null;
  immediateActionDescription: string;
  isResolvedImmediately: boolean | null; // null represents unselected
  photoResolution: File | null;
  responsiblePerson: string;
  resolutionDeadline: string;
  suggestions: string;
  latitude?: string;
  longitude?: string;
}

declare global {
  interface Window {
    html2pdf: any;
  }
}

// ============================================================================
// 2. SERVICES (GEMINI AI & CONFIG)
// ============================================================================

// ----------------------------------------------------------------------------
// !!! CONFIGURAÇÃO API !!!
// ----------------------------------------------------------------------------
const API_KEY = "AIzaSyCfsM1XGSnNqZawYhX8sR670-Q9kLArQZk"; 
// ----------------------------------------------------------------------------

// URL DO SCRIPT GOOGLE (Backend)
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxG8Y9NQz7mVRnqvFWEb394a5B-uIGLifQRcUOdbP-nWZ269WEJ5WWKWUFlvdwTa3Dr/exec';

const ai = new GoogleGenAI({ apiKey: API_KEY });

const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio,
            },
          },
          {
            text: "Transcreva o áudio a seguir exatamente como foi falado. Se houver ruído, ignore e foque na fala. Retorne apenas o texto transcrito.",
          },
        ],
      },
    });

    return response.text || "";
  } catch (error) {
    console.error("Error transcribing audio:", error);
    return "Erro na transcrição. Verifique sua conexão.";
  }
};

// ============================================================================
// 3. COMPONENTS
// ============================================================================

// --- Component: AudioRecorder ---
const AudioRecorder: React.FC<{ onTranscriptionComplete: (text: string) => void }> = ({ onTranscriptionComplete }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        await handleTranscribe(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Não foi possível acessar o microfone.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
    }
  };

  const handleTranscribe = async (blob: Blob) => {
    setIsProcessing(true);
    try {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        const base64Content = base64data.split(',')[1];
        const text = await transcribeAudio(base64Content, 'audio/webm');
        onTranscriptionComplete(text);
        setIsProcessing(false);
      };
    } catch (error) {
      console.error(error);
      setIsProcessing(false);
      alert("Erro ao processar áudio.");
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2">
      {!isRecording && !isProcessing && (
        <button
          type="button"
          onClick={startRecording}
          className="flex items-center gap-2 px-4 py-2 bg-brand-gray text-white rounded-md hover:bg-slate-600 transition-colors text-sm font-medium"
        >
          <Mic className="w-4 h-4" />
          Gravar Nota de Áudio
        </button>
      )}

      {isRecording && (
        <button
          type="button"
          onClick={stopRecording}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium animate-pulse"
        >
          <Square className="w-4 h-4 fill-current" />
          Parar Gravação
        </button>
      )}

      {isProcessing && (
        <div className="flex items-center gap-2 text-brand-blue text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin" />
          <Sparkles className="w-4 h-4 text-brand-green" />
          Transcrevendo com IA...
        </div>
      )}
    </div>
  );
};

// --- Component: FileInput ---
interface FileInputProps {
  label: string;
  onChange: (file: File | null) => void;
  selectedFile: File | null;
  id: string;
}

const FileInput: React.FC<FileInputProps> = ({ label, onChange, selectedFile, id }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('environment');
  const [captureMode, setCaptureMode] = useState<'photo' | 'video'>('photo');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  useEffect(() => {
    if (isRecording) {
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRecording]);

  const startCamera = async () => {
    setCameraError(null);
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: facingMode },
        audio: captureMode === 'video' 
      });
      setStream(mediaStream);
      setIsCameraOpen(true);
    } catch (err) {
      console.error("Erro ao acessar câmera:", err);
      setCameraError("Não foi possível acessar a câmera/microfone. Verifique as permissões.");
    }
  };

  useEffect(() => {
    if (isCameraOpen) startCamera();
  }, [facingMode, captureMode]);

  useEffect(() => {
    if (isCameraOpen && videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [isCameraOpen, stream]);

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsCameraOpen(false);
    setIsRecording(false);
    setRecordingTime(0);
  };

  const toggleCamera = () => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
  };

  const capturePhoto = (e: React.MouseEvent) => {
    e.preventDefault();
    if (videoRef.current) {
      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        if (facingMode === 'user') {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `foto_${Date.now()}.jpg`, { type: "image/jpeg" });
            onChange(file);
            stopCamera();
          }
        }, 'image/jpeg', 0.8);
      }
    }
  };

  const startRecordingVideo = () => {
    if (!stream) return;
    try {
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const file = new File([blob], `video_${Date.now()}.webm`, { type: 'video/webm' });
        onChange(file);
        stopCamera();
      };
      mediaRecorder.start();
      setIsRecording(true);
    } catch (e) {
      console.error("Erro ao iniciar gravação:", e);
      setCameraError("Erro ao gravar vídeo. Dispositivo incompatível.");
    }
  };

  const stopRecordingVideo = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onChange(e.target.files[0]);
    }
    e.target.value = '';
  };

  const isVideo = selectedFile?.type.startsWith('video/');

  return (
    <div className="w-full">
      <label className="block text-sm font-semibold text-brand-blue mb-2">{label}</label>
      
      {previewUrl ? (
        <div className="relative border-2 border-brand-green border-solid rounded-lg p-2 bg-gray-50 text-center">
          {isVideo ? (
            <video src={previewUrl} controls className="mx-auto h-48 max-w-full object-contain rounded-md shadow-sm bg-black" />
          ) : (
            <img src={previewUrl} alt="Preview" className="mx-auto h-48 object-contain rounded-md shadow-sm" />
          )}
          <div className="mt-2 flex items-center justify-between px-2">
             <span className="text-xs text-gray-600 truncate max-w-[200px]">{selectedFile?.name}</span>
             <button type="button" onClick={() => onChange(null)} className="flex items-center gap-1 text-red-600 text-sm hover:text-red-800 font-medium p-2 bg-red-50 rounded">
                <Trash2 className="w-4 h-4" /> Remover
              </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={() => { setIsCameraOpen(true); setCaptureMode('photo'); }} className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-blue-50 hover:border-brand-blue transition-colors group">
               <Camera className="w-8 h-8 text-gray-400 group-hover:text-brand-blue mb-2" />
               <span className="text-sm font-medium text-gray-600 group-hover:text-brand-blue">Câmera / Vídeo</span>
            </button>
            <label htmlFor={`${id}_gallery`} className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-green-50 hover:border-brand-green transition-colors group">
               <ImageIcon className="w-8 h-8 text-gray-400 group-hover:text-brand-green mb-2" />
               <span className="text-sm font-medium text-gray-600 group-hover:text-brand-green">Galeria</span>
               <input id={`${id}_gallery`} type="file" accept="image/*,video/*" className="sr-only" onChange={handleFileChange} />
            </label>
          </div>
          {cameraError && <p className="text-red-500 text-xs mt-2">{cameraError}</p>}
        </>
      )}

      {isCameraOpen && (
        <div className="fixed inset-0 z-[60] bg-black bg-opacity-95 flex flex-col items-center justify-center p-0 sm:p-4">
          <div className="w-full h-full sm:max-w-lg sm:h-auto sm:max-h-[90vh] bg-black rounded-none sm:rounded-xl overflow-hidden relative shadow-2xl flex flex-col">
            <div className="absolute top-0 left-0 right-0 z-20 p-4 flex justify-between items-center bg-gradient-to-b from-black/70 to-transparent">
              <button onClick={toggleCamera} className="text-white p-2 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md">
                <RefreshCw className="w-5 h-5" />
              </button>
              {isRecording && (
                <div className="flex items-center gap-2 px-3 py-1 bg-red-600 rounded-full animate-pulse">
                   <div className="w-2 h-2 bg-white rounded-full"></div>
                   <span className="text-white text-xs font-mono font-bold">{formatTime(recordingTime)}</span>
                </div>
              )}
              <button onClick={stopCamera} className="text-white p-2 rounded-full bg-white/20 hover:bg-red-500/80 backdrop-blur-md">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="relative flex-1 bg-gray-900 w-full flex items-center justify-center overflow-hidden">
               <video ref={videoRef} autoPlay playsInline muted={!isRecording} className={`w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`} />
            </div>

            <div className="p-6 bg-gray-900 flex flex-col gap-6">
              {!isRecording && (
                <div className="flex justify-center gap-8 text-sm font-medium">
                  <button onClick={() => setCaptureMode('photo')} className={`pb-1 ${captureMode === 'photo' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400'}`}>FOTO</button>
                  <button onClick={() => setCaptureMode('video')} className={`pb-1 ${captureMode === 'video' ? 'text-yellow-400 border-b-2 border-yellow-400' : 'text-gray-400'}`}>VÍDEO</button>
                </div>
              )}
              <div className="flex items-center justify-center">
                {captureMode === 'photo' ? (
                  <button type="button" onClick={capturePhoto} className="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center group focus:outline-none">
                    <div className="w-16 h-16 bg-white rounded-full group-active:scale-90 transition-transform"></div>
                  </button>
                ) : (
                  <button type="button" onClick={isRecording ? stopRecordingVideo : startRecordingVideo} className={`w-20 h-20 rounded-full border-4 flex items-center justify-center group focus:outline-none transition-colors ${isRecording ? 'border-red-500' : 'border-white'}`}>
                    <div className={`transition-all duration-300 ${isRecording ? 'w-10 h-10 bg-red-500 rounded-md' : 'w-16 h-16 bg-red-500 rounded-full group-active:scale-90'}`}></div>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Component: DateTimePicker ---
const DateTimePicker: React.FC<{ label: string; value: string; onChange: (value: string) => void; name: string }> = ({ label, value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value) setViewDate(new Date(value));
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const months = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const daysOfWeek = ["D", "S", "T", "Q", "Q", "S", "S"];

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };
  const handleNextMonth = (e: React.MouseEvent) => {
    e.preventDefault();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleDateSelect = (day: number) => {
    const currentTime = value ? new Date(value) : new Date();
    const hours = value ? currentTime.getHours() : new Date().getHours();
    const minutes = value ? currentTime.getMinutes() : new Date().getMinutes();
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day, hours, minutes);
    const offset = newDate.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(newDate.getTime() - offset)).toISOString().slice(0, 16);
    onChange(localISOTime);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const timeValue = e.target.value;
    if (!timeValue) return;
    const [hours, minutes] = timeValue.split(':').map(Number);
    const currentDate = value ? new Date(value) : new Date();
    const newDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), hours, minutes);
    const offset = newDate.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(newDate.getTime() - offset)).toISOString().slice(0, 16);
    onChange(localISOTime);
  };

  const renderCalendarDays = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);
    const days = [];
    for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} className="h-8 w-8"></div>);
    const selectedDate = value ? new Date(value) : null;
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = selectedDate && selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
      const isToday = new Date().getDate() === day && new Date().getMonth() === month && new Date().getFullYear() === year;
      days.push(
        <button key={day} type="button" onClick={() => handleDateSelect(day)} className={`h-9 w-9 text-sm rounded-full flex items-center justify-center transition-all duration-200 ${isSelected ? 'bg-brand-blue text-white font-bold shadow-md' : isToday ? 'bg-brand-green/20 text-brand-blue font-bold border border-brand-green' : 'hover:bg-gray-100 text-gray-700'}`}>{day}</button>
      );
    }
    return days;
  };

  const formatDisplayValue = (isoString: string) => {
    if (!isoString) return '';
    return new Date(isoString).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      <label className="block text-sm font-medium text-brand-gray flex items-center gap-1 mb-1"><CalendarIcon className="w-4 h-4" /> {label}</label>
      <div onClick={() => setIsOpen(!isOpen)} className="w-full rounded-md border-gray-300 shadow-sm border bg-gray-50 p-2.5 flex items-center justify-between cursor-pointer hover:bg-white transition-colors">
        <span className={`${value ? 'text-gray-900' : 'text-gray-400'}`}>{value ? formatDisplayValue(value) : 'Selecione data e hora...'}</span>
        <CalendarIcon className="w-5 h-5 text-gray-400" />
      </div>
      {isOpen && (
        <div className="absolute z-50 mt-2 p-4 bg-white/95 backdrop-blur-sm rounded-xl shadow-2xl border border-gray-200 w-[320px] animate-in fade-in zoom-in-95 duration-200 origin-top-left left-0 sm:left-auto">
          <div className="flex items-center justify-between mb-4 px-1">
            <span className="text-gray-800 font-semibold text-base capitalize">{months[viewDate.getMonth()]} {viewDate.getFullYear()}</span>
            <div className="flex gap-1">
              <button onClick={handlePrevMonth} className="p-1 hover:bg-gray-100 rounded-md text-gray-600"><ChevronLeft className="w-5 h-5" /></button>
              <button onClick={handleNextMonth} className="p-1 hover:bg-gray-100 rounded-md text-gray-600"><ChevronRight className="w-5 h-5" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2 text-center">{daysOfWeek.map(day => <span key={day} className="text-xs font-medium text-gray-500 h-8 flex items-center justify-center">{day}</span>)}</div>
          <div className="grid grid-cols-7 gap-1 mb-4 place-items-center">{renderCalendarDays()}</div>
          <div className="h-px bg-gray-200 w-full mb-4"></div>
          <div className="flex items-center justify-between gap-4">
             <div className="flex items-center gap-2 text-gray-700 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 w-full">
               <Clock className="w-4 h-4 text-brand-green" />
               <input type="time" value={value ? value.split('T')[1] : ''} onChange={handleTimeChange} className="bg-transparent border-none focus:ring-0 text-sm font-semibold p-0 w-full text-right text-brand-blue cursor-pointer" />
             </div>
             <button type="button" onClick={() => setIsOpen(false)} className="bg-brand-blue text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">OK</button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 4. MAIN APP LOGIC
// ============================================================================

const initialFormState: InspectionFormState = {
  collaboratorName: '', dateTime: '', collaboratorArea: '', unit: '', location: '', description: '',
  photoInspection: null, immediateActionDescription: '', isResolvedImmediately: null, photoResolution: null,
  responsiblePerson: '', resolutionDeadline: '', suggestions: '', latitude: '', longitude: ''
};

const processMediaFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.match(/image.*/)) {
        // Se for vídeo, apenas retorna o base64 puro (CUIDADO: VIDEOS SÃO GRANDES)
        // Para o Drive, filtraremos isso no submit.
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = (err) => reject(err);
        return;
    }
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        // OTIMIZAÇÃO CRÍTICA PARA ENVIO AO DRIVE
        // Redução para 800px e qualidade 0.5 para garantir payload pequeno (<5MB total)
        const MAX_WIDTH = 800; 
        const MAX_HEIGHT = 800;
        let width = img.width; let height = img.height;
        if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
        else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        // Qualidade 0.5 para equilibrar tamanho/qualidade
        resolve(canvas.toDataURL('image/jpeg', 0.5).split(',')[1]);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

const PDFMediaAttachment: React.FC<{ file: File | null; label: string }> = ({ file, label }) => {
  const [src, setSrc] = React.useState<string | null>(null);
  React.useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setSrc(url);
      return () => URL.revokeObjectURL(url);
    }
  }, [file]);
  if (!file || !src) return null;
  const isVideo = file.type.startsWith('video/');
  return (
    <div className="mt-4 break-inside-avoid">
      <p className="text-sm font-bold text-gray-600 mb-2">{label}</p>
      <div className="border border-gray-200 rounded-lg overflow-hidden p-1 bg-white">
        {isVideo ? (
           <div className="h-40 bg-gray-100 flex flex-col items-center justify-center p-4 text-center border-2 border-dashed border-gray-300 rounded">
              <Video className="w-12 h-12 text-gray-400 mb-2" />
              <p className="text-sm font-semibold text-gray-700">Arquivo de Vídeo Anexado</p>
              <p className="text-xs text-gray-500">{file.name}</p>
              <p className="text-[10px] text-gray-400 mt-1">(Vídeos não são reproduzidos em impressões PDF. Consulte o link no Drive.)</p>
           </div>
        ) : (
           <img src={src} alt={label} className="w-full h-auto max-h-[400px] object-contain mx-auto" />
        )}
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [formData, setFormData] = useState<InspectionFormState>(initialFormState);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [lastPdfUrl, setLastPdfUrl] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => setFormData(prev => ({ ...prev, latitude: position.coords.latitude.toString(), longitude: position.coords.longitude.toString() })),
        (error) => console.warn("GPS error:", error.message),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setIsMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAuthAction = (action: 'login' | 'logout' | 'register') => {
    setIsMenuOpen(false);
    if (action === 'login') { setIsLoggedIn(true); alert("Login efetuado (Simulação)"); }
    else if (action === 'logout') { setIsLoggedIn(false); alert("Logout efetuado"); }
    else alert("Redirecionando...");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const downloadPDF = (base64Data: string, fileName: string) => {
    const linkSource = `data:application/pdf;base64,${base64Data}`;
    const downloadLink = document.createElement("a");
    downloadLink.href = linkSource;
    downloadLink.download = fileName;
    downloadLink.click();
    setLastPdfUrl(linkSource);
  };

  const generatePDF = async (): Promise<string> => {
    if (!printRef.current) return '';
    printRef.current.style.display = 'block';
    // REDUZIDO SCALE PARA 1.2 PARA DIMINUIR TAMANHO DO ARQUIVO ENVIADO AO GOOGLE
    const opt = {
      margin: [10, 10, 10, 10], filename: `inspecao.pdf`, image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 1.2, useCORS: true, logging: false, scrollY: 0, windowWidth: 800 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
    };
    try {
      const pdfDataUri = await window.html2pdf().set(opt).from(printRef.current).outputPdf('datauristring');
      printRef.current.style.display = 'none';
      return pdfDataUri.split(',')[1];
    } catch (e) {
      if (printRef.current) printRef.current.style.display = 'none';
      throw new Error("Falha na geração do PDF visual.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      setLoadingStep('Verificando localização...');
      let finalFormData = { ...formData };
      if ((!finalFormData.latitude || finalFormData.latitude === '') && "geolocation" in navigator) {
        try {
          const position: any = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 }));
          finalFormData.latitude = position.coords.latitude.toString();
          finalFormData.longitude = position.coords.longitude.toString();
        } catch (err) { finalFormData.latitude = "Erro"; finalFormData.longitude = "Erro"; }
      }

      setLoadingStep('Gerando PDF do relatório...');
      const pdfBase64 = await generatePDF();
      const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const safeName = finalFormData.collaboratorName.replace(/[^a-zA-Z0-9]/g, '_') || 'Colaborador';
      const pdfFileName = `Relatorio_${safeName}_${dateStr}.pdf`;
      downloadPDF(pdfBase64, pdfFileName);

      setLoadingStep('Processando arquivos...');
      const filesPayload = [];
      
      // 1. Sempre envia o PDF
      filesPayload.push({ fileName: pdfFileName, mimeType: 'application/pdf', base64: pdfBase64, fieldName: 'relatorio_completo' });

      // 2. Processa Evidência da Inspeção
      if (finalFormData.photoInspection) {
        // IMPORTANTE: Só envia para o drive se for IMAGEM. Vídeos bloqueados por tamanho no Apps Script.
        if (finalFormData.photoInspection.type.startsWith('image/')) {
          const base64Media = await processMediaFile(finalFormData.photoInspection);
          filesPayload.push({
            fileName: `Registro_Inspecao_${safeName}_${dateStr}.jpg`,
            mimeType: 'image/jpeg',
            base64: base64Media, fieldName: 'foto_inspecao'
          });
        }
      }

      // 3. Processa Evidência da Resolução
      if (finalFormData.photoResolution) {
        if (finalFormData.photoResolution.type.startsWith('image/')) {
          const base64Media = await processMediaFile(finalFormData.photoResolution);
          filesPayload.push({
            fileName: `Registro_Resolucao_${safeName}_${dateStr}.jpg`,
            mimeType: 'image/jpeg',
            base64: base64Media, fieldName: 'foto_resolucao'
          });
        }
      }

      setLoadingStep('Salvando dados no Drive...');
      
      // PAYLOAD OTIMIZADO PARA O BACKEND DO GOOGLE APPS SCRIPT
      const payload = {
          folderName: "inspeções Fagundes teste", // NOME DA PASTA SOLICITADO
          data: { 
            ...finalFormData, 
            latitude: finalFormData.latitude || "ND", 
            longitude: finalFormData.longitude || "ND",
            // Remove objetos de arquivo do JSON de dados para não poluir a planilha
            photoInspection: "", 
            photoResolution: "",
            // Garante formatação legível para a planilha
            dateTime: new Date(finalFormData.dateTime).toLocaleString('pt-BR'),
            isResolvedImmediately: finalFormData.isResolvedImmediately === true ? "SIM" : (finalFormData.isResolvedImmediately === false ? "NÃO" : "ND")
          },
          files: filesPayload
      };

      // LOG DE TAMANHO DE PAYLOAD PARA DEBUG
      const payloadSize = JSON.stringify(payload).length;
      console.log(`Tamanho do payload a ser enviado: ${(payloadSize / 1024 / 1024).toFixed(2)} MB`);

      if (payloadSize > 45 * 1024 * 1024) {
          alert("Atenção: Os arquivos são muito grandes (>45MB) e não serão salvos no Drive. O PDF foi gerado localmente.");
      }

      // Se houver vídeo anexado, avisa que não vai subir.
      const hasVideo = (finalFormData.photoInspection?.type.startsWith('video/') || finalFormData.photoResolution?.type.startsWith('video/'));
      if (hasVideo) {
          console.log("Vídeos detectados. Eles não serão enviados ao Drive para evitar falha no script (limite de tamanho).");
      }

      await fetch(`${GOOGLE_SCRIPT_URL}?t=${new Date().getTime()}`, {
        method: 'POST', redirect: 'follow', mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
      });
      setSubmitted(true);
    } catch (error) {
      console.error("Erro no envio:", error);
      alert("Erro ao salvar dados online. O PDF foi gerado localmente.");
    } finally {
      setIsSubmitting(false); setLoadingStep('');
    }
  };

  const handleReset = () => {
    setFormData(initialFormState); setSubmitted(false); setLastPdfUrl(null); window.scrollTo(0, 0);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center space-y-4 max-w-md w-full p-8 rounded-xl shadow-lg border-t-4 border-brand-green bg-white">
          <div className="w-16 h-16 bg-brand-green/20 rounded-full flex items-center justify-center mx-auto"><CheckCircle className="w-8 h-8 text-brand-green" /></div>
          <h2 className="text-2xl font-bold text-brand-blue">Inspeção Concluída!</h2>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 text-left">
             <p className="font-bold mb-2">Processo finalizado:</p>
             <ul className="list-disc list-inside space-y-1">
               <li>Relatório PDF baixado.</li>
               <li>Pasta: <strong>"inspeções Fagundes teste"</strong></li>
               <li>Planilha: <strong>"Controle de Inspeções"</strong> atualizada.</li>
             </ul>
             {(formData.photoInspection?.type.startsWith('video/') || formData.photoResolution?.type.startsWith('video/')) && (
               <p className="mt-2 text-xs text-orange-600 font-bold">Nota: Vídeos não são salvos no Drive devido ao tamanho, apenas no dispositivo.</p>
             )}
          </div>
          {lastPdfUrl && <a href={lastPdfUrl} download={`Relatorio_Inspecao.pdf`} className="flex items-center justify-center gap-2 w-full py-2 border border-brand-blue text-brand-blue rounded-lg font-semibold hover:bg-blue-50 transition-colors mt-4"><FileDown className="w-4 h-4" /> Baixar PDF Novamente</a>}
          <button onClick={handleReset} className="w-full py-3 bg-brand-blue text-white rounded-lg font-semibold hover:bg-blue-900 transition-colors mt-4">Nova Inspeção</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-brand-blue shadow-lg sticky top-0 z-50 no-print pt-[env(safe-area-inset-top)]">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-brand-green p-2 rounded-lg"><FileText className="text-white w-6 h-6" /></div>
            <div><h1 className="text-white text-xl font-bold tracking-wide uppercase">Inspeção de Campo</h1><p className="text-blue-200 text-xs">Sistema de Gestão de Segurança</p></div>
          </div>
          <div className="relative" ref={menuRef}>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-white p-2 hover:bg-blue-800 rounded-lg transition-colors"><Menu className="w-6 h-6" /></button>
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                {!isLoggedIn ? (
                  <>
                    <button onClick={() => handleAuthAction('login')} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"><div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-brand-blue shrink-0"><LogIn className="w-4 h-4" /></div><div><span className="font-semibold block">Entrar</span><span className="text-xs text-gray-500">Acesse sua conta</span></div></button>
                    <button onClick={() => handleAuthAction('register')} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"><div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center text-brand-green shrink-0"><UserPlus className="w-4 h-4" /></div><div><span className="font-semibold block">Cadastrar</span><span className="text-xs text-gray-500">Crie uma nova conta</span></div></button>
                  </>
                ) : (
                  <>
                    <div className="px-4 py-3 border-b border-gray-100 mb-1 bg-gray-50"><p className="text-sm font-semibold text-gray-800">Usuário Logado</p><p className="text-xs text-gray-500 truncate">colaborador@exemplo.com</p></div>
                    <button onClick={() => handleAuthAction('logout')} className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"><LogOut className="w-4 h-4" /><span className="font-medium">Sair</span></button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100">
          <div className="p-6 md:p-8 space-y-6">
            <h2 className="text-lg font-bold text-brand-blue border-b border-gray-100 pb-2 flex items-center gap-2"><User className="w-5 h-5 text-brand-green" /> Dados do Colaborador</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1"><label className="block text-sm font-medium text-brand-gray">Nome</label><input type="text" name="collaboratorName" required value={formData.collaboratorName} onChange={handleInputChange} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-blue focus:ring focus:ring-brand-blue/20 p-2.5 border bg-gray-50" placeholder="Digite o nome completo" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1"><label className="block text-sm font-medium text-brand-gray">Área</label><select name="collaboratorArea" required value={formData.collaboratorArea} onChange={handleInputChange} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-blue focus:ring focus:ring-brand-blue/20 p-2.5 border bg-gray-50"><option value="">Selecione...</option><option value="Produção">Produção</option><option value="Infraestrutura">Infraestrutura</option><option value="Manutenção">Manutenção</option><option value="Administrativo">Administrativo</option><option value="SESMT">SESMT</option></select></div>
                <div className="space-y-1"><label className="block text-sm font-medium text-brand-gray">Unidade</label><select name="unit" required value={formData.unit} onChange={handleInputChange} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-blue focus:ring focus:ring-brand-blue/20 p-2.5 border bg-gray-50"><option value="">Selecione...</option><option value="VL">VL</option><option value="VLN">VLN</option></select></div>
              </div>
              <div className="space-y-1"><DateTimePicker label="Data e Hora" name="dateTime" value={formData.dateTime} onChange={(val) => setFormData(prev => ({...prev, dateTime: val}))} /></div>
            </div>
          </div>

          <div className="h-2 bg-gray-50 w-full"></div>

          <div className="p-6 md:p-8 space-y-6">
            <h2 className="text-lg font-bold text-brand-blue border-b border-gray-100 pb-2 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-brand-green" /> Detalhes da Inspeção</h2>
            <div className="space-y-4">
              <div className="space-y-1"><label className="block text-sm font-medium text-brand-gray flex items-center gap-1"><MapPin className="w-4 h-4" /> Local</label><input type="text" name="location" required value={formData.location} onChange={handleInputChange} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-blue focus:ring focus:ring-brand-blue/20 p-2.5 border bg-gray-50" placeholder="Ex: Setor A, Máquina 3" /></div>
              <div>
                <label className="block text-sm font-medium text-brand-gray mb-1">Descrição</label>
                <div className="space-y-2">
                  <textarea name="description" required rows={4} value={formData.description} onChange={handleInputChange} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-blue focus:ring focus:ring-brand-blue/20 p-3 border bg-gray-50" placeholder="Descreva o que foi observado..." />
                  <AudioRecorder onTranscriptionComplete={(text) => setFormData(prev => ({ ...prev, description: prev.description ? `${prev.description} ${text}` : text }))} />
                </div>
              </div>
              <FileInput id="photoInspection" label="Evidência (Foto/Vídeo)" onChange={(f) => setFormData(prev => ({...prev, photoInspection: f}))} selectedFile={formData.photoInspection} />
            </div>
          </div>

          <div className="h-2 bg-gray-50 w-full"></div>

          <div className="p-6 md:p-8 space-y-6">
            <h2 className="text-lg font-bold text-brand-blue border-b border-gray-100 pb-2 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-brand-green" /> Ação e Tratativa</h2>
            <div>
              <label className="block text-sm font-medium text-brand-gray mb-1">Ação Imediata</label>
              <div className="space-y-2">
                <textarea name="immediateActionDescription" rows={3} value={formData.immediateActionDescription} onChange={handleInputChange} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-blue focus:ring focus:ring-brand-blue/20 p-3 border bg-gray-50" placeholder="Descreva a ação tomada..." />
                <AudioRecorder onTranscriptionComplete={(text) => setFormData(prev => ({ ...prev, immediateActionDescription: prev.immediateActionDescription ? `${prev.immediateActionDescription} ${text}` : text }))} />
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <span className="block text-sm font-bold text-brand-blue mb-3">Resolvida de imediato?</span>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="isResolvedImmediately" className="w-5 h-5 text-brand-green" checked={formData.isResolvedImmediately === true} onChange={() => setFormData(prev => ({ ...prev, isResolvedImmediately: true }))} /><span className="text-gray-700 font-medium">Sim</span></label>
                <label className="flex items-center gap-2 cursor-pointer"><input type="radio" name="isResolvedImmediately" className="w-5 h-5 text-red-500" checked={formData.isResolvedImmediately === false} onChange={() => setFormData(prev => ({ ...prev, isResolvedImmediately: false }))} /><span className="text-gray-700 font-medium">Não</span></label>
              </div>
            </div>

            {formData.isResolvedImmediately === true && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300"><FileInput id="photoResolution" label="Evidência da Regularização" onChange={(f) => setFormData(prev => ({...prev, photoResolution: f}))} selectedFile={formData.photoResolution} /></div>
            )}

            {formData.isResolvedImmediately === false && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300 bg-red-50 p-4 rounded-lg border border-red-100">
                <div className="space-y-1"><label className="block text-sm font-medium text-gray-700">Responsável</label><input type="text" name="responsiblePerson" value={formData.responsiblePerson} onChange={handleInputChange} className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring focus:ring-red-200 p-2.5 border bg-white" /></div>
                <div className="space-y-1"><label className="block text-sm font-medium text-gray-700">Prazo</label><input type="date" name="resolutionDeadline" value={formData.resolutionDeadline} onChange={handleInputChange} className="w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring focus:ring-red-200 p-2.5 border bg-white" /></div>
              </div>
            )}
          </div>

          <div className="h-2 bg-gray-50 w-full"></div>

          <div className="p-6 md:p-8 space-y-6">
            <h2 className="text-lg font-bold text-brand-blue flex items-center gap-2"><Sparkles className="w-5 h-5 text-brand-green" /> Sugestões</h2>
            <textarea name="suggestions" rows={3} value={formData.suggestions} onChange={handleInputChange} className="w-full rounded-md border-gray-300 shadow-sm focus:border-brand-blue focus:ring focus:ring-brand-blue/20 p-3 border bg-gray-50" placeholder="Ideias ou observações..." />
          </div>

          <div className="p-6 md:p-8 bg-gray-50 border-t border-gray-200 flex justify-end no-print">
            <button type="submit" disabled={isSubmitting} className={`flex items-center gap-2 px-8 py-3 rounded-lg font-bold shadow-md transition-all text-lg ${isSubmitting ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-brand-green text-white hover:bg-lime-600 transform active:scale-95'}`}>
              {isSubmitting ? <><Loader2 className="w-5 h-5 animate-spin" /> {loadingStep}</> : <><Send className="w-5 h-5" /> Salvar Relatório</>}
            </button>
          </div>
        </form>
        <footer className="text-center mt-8 mb-4 text-brand-gray text-xs no-print">
          <p>© {new Date().getFullYear()} Sistema de Inspeção. Todos os direitos reservados.</p>
          <p className="mt-1 font-medium">Desenvolvido por Welson</p>
        </footer>
      </main>

      <div ref={printRef} style={{ display: 'none', width: '210mm', backgroundColor: 'white', margin: '0 auto', padding: '20mm', color: 'black' }}>
        <div className="flex items-center gap-4 border-b-2 border-brand-blue pb-6 mb-8">
           <div className="bg-brand-blue p-3 rounded"><FileText className="text-white w-10 h-10" /></div>
           <div><h1 className="text-3xl font-bold text-brand-blue uppercase">Relatório de Inspeção</h1><p className="text-gray-500 mt-1">Gerado em {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR')}</p></div>
        </div>
        <div className="grid grid-cols-2 gap-6 mb-8 text-sm">
           <div className="space-y-1"><p className="text-gray-500 font-semibold uppercase text-xs">Colaborador</p><p className="font-medium text-lg border-b border-gray-200 pb-1">{formData.collaboratorName || '-'}</p></div>
           <div className="grid grid-cols-2 gap-2">
             <div className="space-y-1"><p className="text-gray-500 font-semibold uppercase text-xs">Área</p><p className="font-medium text-lg border-b border-gray-200 pb-1">{formData.collaboratorArea || '-'}</p></div>
             <div className="space-y-1"><p className="text-gray-500 font-semibold uppercase text-xs">Unidade</p><p className="font-medium text-lg border-b border-gray-200 pb-1">{formData.unit || '-'}</p></div>
           </div>
           <div className="space-y-1"><p className="text-gray-500 font-semibold uppercase text-xs">Data</p><p className="font-medium text-lg border-b border-gray-200 pb-1">{formData.dateTime ? new Date(formData.dateTime).toLocaleString('pt-BR') : '-'}</p></div>
           <div className="space-y-1"><p className="text-gray-500 font-semibold uppercase text-xs">Local</p><p className="font-medium text-lg border-b border-gray-200 pb-1">{formData.location || '-'}</p></div>
        </div>
        <div className="mb-8">
          <h3 className="text-brand-blue font-bold text-lg mb-2 uppercase border-b border-gray-200 pb-1">Descrição</h3>
          <p className="text-gray-800 text-justify leading-relaxed whitespace-pre-wrap">{formData.description || 'Nenhuma descrição fornecida.'}</p>
          <PDFMediaAttachment file={formData.photoInspection} label="Registro de Evidência" />
        </div>
        <div className="mb-8 break-inside-avoid">
          <h3 className="text-brand-blue font-bold text-lg mb-2 uppercase border-b border-gray-200 pb-1">Tratativa</h3>
          <div className="mb-4"><p className="font-bold text-sm text-gray-600">Ação Imediata:</p><p className="text-gray-800 whitespace-pre-wrap">{formData.immediateActionDescription || '-'}</p></div>
          <div className="grid grid-cols-2 gap-4 mb-4">
             <div><p className="font-bold text-sm text-gray-600">Resolvido?</p><p className={`font-bold ${formData.isResolvedImmediately ? 'text-green-600' : 'text-red-600'}`}>{formData.isResolvedImmediately === null ? '-' : (formData.isResolvedImmediately ? 'SIM' : 'NÃO')}</p></div>
             {!formData.isResolvedImmediately && (
               <><div><p className="font-bold text-sm text-gray-600">Responsável:</p><p>{formData.responsiblePerson || '-'}</p></div><div><p className="font-bold text-sm text-gray-600">Prazo:</p><p>{formData.resolutionDeadline ? new Date(formData.resolutionDeadline).toLocaleDateString('pt-BR') : '-'}</p></div></>
             )}
          </div>
          {formData.isResolvedImmediately && <PDFMediaAttachment file={formData.photoResolution} label="Evidência da Regularização" />}
        </div>
        {formData.suggestions && (
          <div className="mb-8 break-inside-avoid"><h3 className="text-brand-blue font-bold text-lg mb-2 uppercase border-b border-gray-200 pb-1">Sugestões</h3><p className="text-gray-800 whitespace-pre-wrap">{formData.suggestions}</p></div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 5. MOUNT
// ============================================================================
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

// Suppress benign resize errors
window.addEventListener('error', (e) => {
  if (e.message.includes('ResizeObserver')) e.stopImmediatePropagation();
});

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);