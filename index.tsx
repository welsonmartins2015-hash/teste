import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { 
  Camera, Image as ImageIcon, Trash2, X, RefreshCw, Video, Square, Circle, Play,
  Mic, Loader2, Sparkles,
  Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight,
  MapPin, User, FileText, CheckCircle, AlertTriangle, Send, Menu, FileDown, Download, LogIn, LogOut, UserPlus,
  ArrowLeft, ShieldCheck, ClipboardList, Construction, ThumbsUp, ThumbsDown, Users, MessageCircle, HelpCircle, Info, Lightbulb, CheckSquare
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

interface OACFormState {
  observerName: string;
  dateTime: string;
  area: string;
  taskDescription: string;
  peopleObserved: number;
  // Categories state: 'safe' | 'risk' | 'na' (not applicable/observed)
  categories: {
    epi: 'safe' | 'risk' | 'na';
    tools: 'safe' | 'risk' | 'na';
    procedures: 'safe' | 'risk' | 'na';
    position: 'safe' | 'risk' | 'na';
    order: 'safe' | 'risk' | 'na';
    reaction: 'safe' | 'risk' | 'na';
  };
  riskDescription: string;
  feedbackGiven: boolean;
  feedbackDescription: string;
  photoOAC?: File | null;
}

type AppView = 'landing' | 'inspection' | 'oac';

declare global {
  interface Window {
    html2pdf: any;
  }
}

// ============================================================================
// 2. SERVICES (GEMINI AI & CONFIG)
// ============================================================================

const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxG8Y9NQz7mVRnqvFWEb394a5B-uIGLifQRcUOdbP-nWZ269WEJ5WWKWUFlvdwTa3Dr/exec';

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

const processMediaFile = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (!file.type.match(/image.*/)) {
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
        const MAX_WIDTH = 800; 
        const MAX_HEIGHT = 800;
        let width = img.width; let height = img.height;
        if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } }
        else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.5).split(',')[1]);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

// ============================================================================
// 3. COMPONENTS
// ============================================================================

// --- Component: PDFMediaAttachment ---
const PDFMediaAttachment: React.FC<{ file: File | null; label: string }> = ({ file, label }) => {
  const [src, setSrc] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (file) {
      if (file.type.startsWith('video/')) {
         setSrc('video');
         return;
      }
      
      // Resize image and convert to DataURL for reliable PDF generation
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const MAX_WIDTH = 800; 
          const MAX_HEIGHT = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          if (ctx) {
             ctx.drawImage(img, 0, 0, width, height);
             setSrc(canvas.toDataURL('image/jpeg', 0.8));
          }
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    } else {
      setSrc(null);
    }
  }, [file]);

  if (!file || !src) return null;
  const isVideo = file.type.startsWith('video/');

  return (
    <div className="mt-6 break-inside-avoid">
      <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm inline-block w-full">
         <div className="mb-2 px-1 flex items-center justify-between">
           <p className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1"><ImageIcon className="w-3 h-3" /> {label}</p>
         </div>
         <div className="bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center min-h-[200px]">
           {isVideo ? (
              <div className="text-center p-6">
                 <Video className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                 <p className="text-xs text-gray-500 font-medium">Vídeo anexado (Ver no Drive)</p>
              </div>
           ) : (
              // Use plain img tag with max-width/height logic compatible with html2pdf
              <img src={src} alt={label} style={{ maxWidth: '100%', maxHeight: '400px', objectFit: 'contain' }} />
           )}
         </div>
      </div>
    </div>
  );
};

// --- Component: HelpGuide ---
const HelpGuide = ({ isOpen, onClose, type }: { isOpen: boolean; onClose: () => void; type: 'inspection' | 'oac' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm flex justify-end transition-opacity duration-300" onClick={onClose}>
      <div 
        className="w-full max-w-sm h-full bg-white shadow-2xl p-6 overflow-y-auto animate-in slide-in-from-right duration-300 border-l border-gray-200" 
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${type === 'inspection' ? 'bg-blue-50 text-brand-blue' : 'bg-green-50 text-brand-green'}`}>
              <Lightbulb className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-gray-800">Guia Rápido</h2>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
            <X className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {type === 'inspection' ? (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-bold text-brand-blue flex items-center gap-2"><MapPin className="w-4 h-4" /> Localização</h3>
              <p className="text-sm text-gray-600">Seja específico. Evite "Fábrica".</p>
              <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-700 border-l-4 border-brand-blue">
                <strong>Bom:</strong> "Setor de Solda, Cabine 3" <br/>
                <strong>Ruim:</strong> "Produção"
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-brand-blue flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Descrição do Problema</h3>
              <p className="text-sm text-gray-600">Descreva o que está errado e o risco potencial.</p>
              <div className="bg-gray-50 p-3 rounded-lg text-xs text-gray-700 border-l-4 border-brand-blue">
                <strong>Exemplo:</strong> "Extintor nº 45 com lacre rompido e despressurizado. Risco de falha em emergência."
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-brand-blue flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Ação Imediata</h3>
              <p className="text-sm text-gray-600">O que você fez na hora para mitigar o risco?</p>
              <ul className="list-disc list-inside text-xs text-gray-600 space-y-1 ml-1">
                <li>Isolei a área</li>
                <li>Parei a atividade</li>
                <li>Notifiquei o supervisor</li>
              </ul>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <h3 className="font-bold text-brand-green flex items-center gap-2"><Users className="w-4 h-4" /> O que é OAC?</h3>
              <p className="text-sm text-gray-600"><strong>Observação e Abordagem Comportamental.</strong> O foco aqui não são máquinas quebradas, mas sim como as pessoas estão trabalhando.</p>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-brand-green flex items-center gap-2"><ThumbsUp className="w-4 h-4" /> Como avaliar?</h3>
              <p className="text-sm text-gray-600">No checklist, toque nos botões para alternar o status:</p>
              <div className="grid gap-2 mt-2">
                 <div className="flex items-center gap-2 text-xs font-bold text-gray-500 bg-gray-100 p-2 rounded"><span className="w-3 h-3 rounded-full bg-gray-400"></span> Cinza: Não observado</div>
                 <div className="flex items-center gap-2 text-xs font-bold text-brand-green bg-green-50 p-2 rounded"><span className="w-3 h-3 rounded-full bg-brand-green"></span> Verde (1 clique): Comportamento Seguro</div>
                 <div className="flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 p-2 rounded"><span className="w-3 h-3 rounded-full bg-red-600"></span> Vermelho (2 cliques): Comportamento de Risco</div>
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="font-bold text-brand-green flex items-center gap-2"><MessageCircle className="w-4 h-4" /> Abordagem</h3>
              <p className="text-sm text-gray-600">A conversa é a parte mais importante!</p>
              <ul className="list-disc list-inside text-xs text-gray-600 space-y-1 ml-1 bg-green-50/50 p-3 rounded-lg border border-green-100">
                <li>Elogie os comportamentos seguros primeiro.</li>
                <li>Pergunte o "porquê" do comportamento de risco.</li>
                <li>Não puna, eduque.</li>
              </ul>
            </div>
          </div>
        )}
        
        <button onClick={onClose} className="w-full mt-8 bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-black transition-colors">
          Entendi
        </button>
      </div>
    </div>
  );
};

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
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-brand-gray border border-gray-200 rounded-full hover:bg-gray-200 transition-all text-sm font-medium shadow-sm active:scale-95"
        >
          <Mic className="w-4 h-4" />
          Gravar Nota de Áudio
        </button>
      )}

      {isRecording && (
        <button
          type="button"
          onClick={stopRecording}
          className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-full hover:bg-red-100 transition-colors text-sm font-medium animate-pulse"
        >
          <Square className="w-4 h-4 fill-current" />
          Parar Gravação
        </button>
      )}

      {isProcessing && (
        <div className="flex items-center gap-2 text-brand-blue text-sm font-medium px-2 py-1 bg-blue-50 rounded-full">
          <Loader2 className="w-4 h-4 animate-spin" />
          <Sparkles className="w-4 h-4 text-brand-green" />
          Processando IA...
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
        <div className="relative border border-brand-green/30 rounded-xl p-2 bg-white text-center shadow-sm">
          {isVideo ? (
            <video src={previewUrl} controls className="mx-auto h-48 max-w-full object-contain rounded-lg shadow-sm bg-black" />
          ) : (
            <img src={previewUrl} alt="Preview" className="mx-auto h-48 object-contain rounded-lg shadow-sm" />
          )}
          <div className="mt-3 flex items-center justify-between px-2">
             <span className="text-xs text-gray-500 truncate max-w-[200px] bg-gray-50 px-2 py-1 rounded">{selectedFile?.name}</span>
             <button type="button" onClick={() => onChange(null)} className="flex items-center gap-1 text-red-600 text-sm hover:text-red-800 font-medium px-3 py-1 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                <Trash2 className="w-4 h-4" /> Remover
              </button>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4">
            <button type="button" onClick={() => { setIsCameraOpen(true); setCaptureMode('photo'); }} className="flex flex-col items-center justify-center p-6 border border-gray-200 rounded-xl cursor-pointer bg-white hover:bg-blue-50 hover:border-brand-blue transition-all group shadow-sm hover:shadow-md">
               <div className="bg-blue-50 p-3 rounded-full mb-3 group-hover:bg-blue-100 transition-colors">
                 <Camera className="w-6 h-6 text-brand-blue" />
               </div>
               <span className="text-sm font-medium text-gray-600 group-hover:text-brand-blue">Câmera / Vídeo</span>
            </button>
            <label htmlFor={`${id}_gallery`} className="flex flex-col items-center justify-center p-6 border border-gray-200 rounded-xl cursor-pointer bg-white hover:bg-green-50 hover:border-brand-green transition-all group shadow-sm hover:shadow-md">
               <div className="bg-green-50 p-3 rounded-full mb-3 group-hover:bg-green-100 transition-colors">
                 <ImageIcon className="w-6 h-6 text-brand-green" />
               </div>
               <span className="text-sm font-medium text-gray-600 group-hover:text-brand-green">Galeria</span>
               <input id={`${id}_gallery`} type="file" accept="image/*,video/*" className="sr-only" onChange={handleFileChange} />
            </label>
          </div>
          {cameraError && <p className="text-red-500 text-xs mt-2 bg-red-50 p-2 rounded border border-red-100">{cameraError}</p>}
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
      <div onClick={() => setIsOpen(!isOpen)} className="w-full rounded-lg border border-gray-300 shadow-sm bg-white p-3 flex items-center justify-between cursor-pointer hover:border-brand-blue transition-all">
        <span className={`${value ? 'text-gray-900 font-medium' : 'text-gray-400'}`}>{value ? formatDisplayValue(value) : 'Selecione data e hora...'}</span>
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
// 4. NEW COMPONENTS (LANDING & OAC)
// ============================================================================

const LandingPage = ({ onSelect }: { onSelect: (view: 'inspection' | 'oac') => void }) => (
  <div className="min-h-screen bg-gradient-to-br from-brand-blue to-blue-900 flex flex-col items-center justify-center p-6 text-center">
    <div className="bg-white/95 backdrop-blur-md p-8 md:p-10 rounded-3xl shadow-2xl max-w-md w-full animate-in fade-in zoom-in duration-500 border border-white/20">
      <div className="mb-6 flex justify-center">
        <div className="w-20 h-20 bg-brand-green rounded-full flex items-center justify-center shadow-lg transform -rotate-12">
          <Sparkles className="w-10 h-10 text-white" />
        </div>
      </div>
      
      <h1 className="text-3xl md:text-4xl font-extrabold text-brand-blue mb-2 tracking-tight">Renovação!</h1>
      <p className="text-gray-500 mb-8 font-medium">Selecione o tipo de registro que deseja realizar</p>

      <div className="space-y-4">
        <button 
          onClick={() => onSelect('inspection')}
          className="w-full group bg-white border-2 border-brand-blue/10 hover:border-brand-blue hover:bg-blue-50/50 p-4 rounded-2xl flex items-center gap-4 transition-all duration-300 shadow-sm hover:shadow-lg transform hover:-translate-y-1"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-brand-blue group-hover:bg-brand-blue group-hover:text-white transition-colors">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div className="text-left">
            <span className="block text-lg font-bold text-gray-800 group-hover:text-brand-blue">Inspeção de Campo</span>
            <span className="text-xs text-gray-500">Registrar e auditar áreas</span>
          </div>
        </button>

        <button 
          onClick={() => onSelect('oac')}
          className="w-full group bg-white border-2 border-brand-green/10 hover:border-brand-green hover:bg-green-50/50 p-4 rounded-2xl flex items-center gap-4 transition-all duration-300 shadow-sm hover:shadow-lg transform hover:-translate-y-1"
        >
          <div className="w-12 h-12 rounded-xl bg-green-100 flex items-center justify-center text-brand-green group-hover:bg-brand-green group-hover:text-white transition-colors">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="text-left">
            <span className="block text-lg font-bold text-gray-800 group-hover:text-brand-green">OAC</span>
            <span className="text-xs text-gray-500">Observação de Atividade</span>
          </div>
        </button>
      </div>
      
      <p className="mt-8 text-xs text-gray-400 font-medium">Sistema de Gestão de Segurança</p>
    </div>
    
    <div className="mt-8 text-white/50 text-xs">Desenvolvido por Welson</div>
  </div>
);

const initialOACState: OACFormState = {
  observerName: '', dateTime: '', area: '', taskDescription: '', peopleObserved: 1,
  categories: { epi: 'na', tools: 'na', procedures: 'na', position: 'na', order: 'na', reaction: 'na' },
  riskDescription: '', feedbackGiven: false, feedbackDescription: '',
  photoOAC: null
};

const OACForm = ({ onBack, onSubmitSuccess }: { onBack: () => void, onSubmitSuccess: (url: string) => void }) => {
  const [formData, setFormData] = useState<OACFormState>(initialOACState);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const categoriesList = [
    { id: 'epi', label: 'EPI / EPC' },
    { id: 'tools', label: 'Ferramentas' },
    { id: 'procedures', label: 'Procedimentos' },
    { id: 'position', label: 'Posição / Corpo' },
    { id: 'order', label: 'Ordem e Limpeza' },
    { id: 'reaction', label: 'Reação das Pessoas' },
  ];

  const handleCategoryChange = (catId: keyof OACFormState['categories']) => {
    setFormData(prev => {
      const current = prev.categories[catId];
      // Cycle: na -> safe -> risk -> na
      const next = current === 'na' ? 'safe' : (current === 'safe' ? 'risk' : 'na');
      return { ...prev, categories: { ...prev.categories, [catId]: next } };
    });
  };

  const hasRisks = Object.values(formData.categories).includes('risk');

  const generatePDF = async (): Promise<string> => {
    if (!printRef.current) return '';
    printRef.current.style.display = 'block';
    
    // Add small delay to ensure images are rendered before capture
    await new Promise(resolve => setTimeout(resolve, 500));

    const opt = {
      margin: 0, filename: `OAC_${formData.observerName}.pdf`, image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 1.5, useCORS: true, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    try {
      const pdfDataUri = await window.html2pdf().set(opt).from(printRef.current).outputPdf('datauristring');
      printRef.current.style.display = 'none';
      return pdfDataUri.split(',')[1];
    } catch (e) {
      if (printRef.current) printRef.current.style.display = 'none';
      throw e;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if(isSubmitting) return;
    setIsSubmitting(true);

    try {
      const pdfBase64 = await generatePDF();
      const dateStr = new Date().toLocaleDateString('pt-BR').replace(/\//g, '-');
      const safeName = formData.observerName.replace(/[^a-zA-Z0-9]/g, '_');
      const pdfFileName = `OAC_${safeName}_${dateStr}.pdf`;

      // Process photo if present
      let base64PhotoOAC = null;
      if (formData.photoOAC && formData.photoOAC.type.startsWith('image/')) {
         base64PhotoOAC = await processMediaFile(formData.photoOAC);
      }
      
      const payload = {
        folderName: "inspeções Fagundes teste",
        data: {
          ...formData,
          type: 'OAC',
          dateTime: new Date(formData.dateTime).toLocaleString('pt-BR'),
          categories: JSON.stringify(formData.categories), // Flatten for sheets
          feedbackGiven: formData.feedbackGiven ? "SIM" : "NÃO",
          photoOAC: ""
        },
        files: [
           { fileName: pdfFileName, mimeType: 'application/pdf', base64: pdfBase64, fieldName: 'relatorio_completo' },
           ...(base64PhotoOAC ? [{
            fileName: `Registro_OAC_${safeName}_${dateStr}.jpg`,
            mimeType: 'image/jpeg',
            base64: base64PhotoOAC,
            fieldName: 'foto_oac'
           }] : [])
        ]
      };

      await fetch(`${GOOGLE_SCRIPT_URL}?t=${new Date().getTime()}`, {
        method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(payload)
      });
      
      onSubmitSuccess(`data:application/pdf;base64,${pdfBase64}`);
    } catch (err) {
      alert("Erro ao enviar OAC.");
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="animate-in slide-in-from-right duration-300 pb-12">
      <HelpGuide isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} type="oac" />
      <header className="bg-brand-green shadow-lg sticky top-0 z-50 pt-[env(safe-area-inset-top)]">
         <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onBack} className="p-2 -ml-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"><ArrowLeft className="w-6 h-6" /></button>
              <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm"><ShieldCheck className="text-white w-6 h-6" /></div>
              <div><h1 className="text-white text-lg font-bold tracking-wide uppercase leading-tight">OAC</h1><p className="text-green-100 text-[10px] font-medium tracking-wider">COMPORTAMENTO SEGURO</p></div>
            </div>
            <button onClick={() => setIsHelpOpen(true)} className="p-2 text-white hover:bg-white/10 rounded-full transition-colors">
              <HelpCircle className="w-6 h-6" />
            </button>
         </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100/50">
          <div className="p-6 space-y-5">
            <h2 className="text-lg font-bold text-gray-800 border-b pb-2">Dados da Observação</h2>
            <div className="space-y-4">
              <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Observador</label><input required type="text" value={formData.observerName} onChange={e => setFormData({...formData, observerName: e.target.value})} className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 focus:border-brand-green focus:ring-1 focus:ring-brand-green outline-none transition-all text-gray-900" placeholder="Seu nome" /></div>
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1">Área</label>
                <select required value={formData.area} onChange={e => setFormData({...formData, area: e.target.value})} className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-900">
                    <option value="">Selecione...</option>
                    <option value="Produção">Produção</option>
                    <option value="Infraestrutura">Infraestrutura</option>
                    <option value="Manutenção">Manutenção</option>
                    <option value="Administrativo">Administrativo</option>
                    <option value="SESMT">SESMT</option>
                </select>
              </div>
              <DateTimePicker label="Data" name="dateTime" value={formData.dateTime} onChange={(val) => setFormData({...formData, dateTime: val})} />
              <div><label className="block text-xs font-bold uppercase text-gray-500 mb-1">Tarefa Observada</label><textarea required rows={2} value={formData.taskDescription} onChange={e => setFormData({...formData, taskDescription: e.target.value})} className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-900" placeholder="O que estavam fazendo?" /><AudioRecorder onTranscriptionComplete={t => setFormData(p => ({...p, taskDescription: p.taskDescription ? `${p.taskDescription} ${t}` : t}))} /></div>
              <div className="flex items-center justify-between bg-blue-50 p-3 rounded-lg"><span className="font-bold text-brand-blue text-sm">Pessoas Observadas</span><div className="flex items-center gap-3"><button type="button" onClick={() => setFormData(p => ({...p, peopleObserved: Math.max(1, p.peopleObserved - 1)}))} className="w-8 h-8 bg-white rounded-full text-brand-blue font-bold shadow">-</button><span className="text-xl font-bold">{formData.peopleObserved}</span><button type="button" onClick={() => setFormData(p => ({...p, peopleObserved: p.peopleObserved + 1}))} className="w-8 h-8 bg-brand-blue text-white rounded-full font-bold shadow">+</button></div></div>
            </div>
          </div>

          <div className="h-2 bg-gray-50 border-y"></div>

          <div className="p-6 space-y-6">
            <h2 className="text-lg font-bold text-gray-800 border-b pb-2 flex justify-between items-center"><span>Checklist Comportamental</span><span className="text-xs font-normal text-gray-400">Toque para alterar</span></h2>
            <div className="grid gap-3">
              {categoriesList.map(cat => {
                 const status = formData.categories[cat.id as keyof typeof formData.categories];
                 return (
                  <button key={cat.id} type="button" onClick={() => handleCategoryChange(cat.id as any)} className={`relative overflow-hidden w-full flex items-center justify-between p-4 rounded-xl border-2 transition-all duration-200 ${status === 'safe' ? 'border-brand-green bg-green-50' : status === 'risk' ? 'border-red-500 bg-red-50' : 'border-gray-100 bg-gray-50'}`}>
                    <span className={`font-bold ${status === 'safe' ? 'text-brand-green' : status === 'risk' ? 'text-red-600' : 'text-gray-500'}`}>{cat.label}</span>
                    <div className="flex items-center gap-2">
                      {status === 'safe' && <div className="flex items-center gap-1 text-brand-green font-bold text-sm bg-white px-3 py-1 rounded-full shadow-sm"><ThumbsUp className="w-4 h-4" /> Seguro</div>}
                      {status === 'risk' && <div className="flex items-center gap-1 text-red-600 font-bold text-sm bg-white px-3 py-1 rounded-full shadow-sm"><ThumbsDown className="w-4 h-4" /> Risco</div>}
                      {status === 'na' && <span className="text-xs text-gray-400 font-medium">Não observado</span>}
                    </div>
                  </button>
                 );
              })}
            </div>

            {hasRisks && (
              <div className="animate-in slide-in-from-top-4">
                 <label className="block text-xs font-bold uppercase text-red-600 mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Detalhes dos Desvios</label>
                 <textarea required rows={3} value={formData.riskDescription} onChange={e => setFormData({...formData, riskDescription: e.target.value})} className="w-full p-3 bg-red-50 rounded-lg border border-red-200 focus:ring-red-500 text-gray-900" placeholder="Descreva os riscos identificados..." />
                 <AudioRecorder onTranscriptionComplete={t => setFormData(p => ({...p, riskDescription: p.riskDescription ? `${p.riskDescription} ${t}` : t}))} />
              </div>
            )}
          </div>

          <div className="h-2 bg-gray-50 border-y"></div>

          <div className="p-6 space-y-5">
            <h2 className="text-lg font-bold text-gray-800 border-b pb-2">Abordagem</h2>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-bold text-gray-700">Realizou Feedback?</span>
              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button type="button" onClick={() => setFormData({...formData, feedbackGiven: true})} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${formData.feedbackGiven ? 'bg-brand-blue text-white shadow' : 'text-gray-500'}`}>SIM</button>
                <button type="button" onClick={() => setFormData({...formData, feedbackGiven: false})} className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${!formData.feedbackGiven ? 'bg-gray-400 text-white shadow' : 'text-gray-500'}`}>NÃO</button>
              </div>
            </div>
            <textarea value={formData.feedbackDescription} onChange={e => setFormData({...formData, feedbackDescription: e.target.value})} className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 text-gray-900" placeholder="Resumo da conversa..." />
            <AudioRecorder onTranscriptionComplete={t => setFormData(p => ({...p, feedbackDescription: p.feedbackDescription ? `${p.feedbackDescription} ${t}` : t}))} />
          </div>

          <div className="h-2 bg-gray-50 border-y"></div>

          <div className="p-6 space-y-5">
            <h2 className="text-lg font-bold text-gray-800 border-b pb-2">Evidência (Opcional)</h2>
            <FileInput 
              id="photoOAC" 
              label="Foto da Observação" 
              onChange={(f) => setFormData(prev => ({...prev, photoOAC: f}))} 
              selectedFile={formData.photoOAC || null} 
            />
          </div>

          <div className="p-6 bg-gray-50 border-t flex">
            <button type="submit" disabled={isSubmitting} className="w-full bg-brand-green text-white font-bold py-4 rounded-xl shadow-lg hover:bg-lime-600 active:scale-95 transition-all flex items-center justify-center gap-2">
              {isSubmitting ? <Loader2 className="animate-spin" /> : <><Send className="w-5 h-5" /> Enviar OAC</>}
            </button>
          </div>
        </form>
      </main>

      {/* PDF OAC - MODERN DESIGN */}
      <div ref={printRef} style={{ display: 'none', width: '210mm', minHeight: '297mm', backgroundColor: 'white', padding: '0', color: '#333', fontFamily: 'Inter, sans-serif' }}>
         {/* HEADER */}
         <div className="bg-brand-green text-white p-8 flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <div className="bg-white/20 p-2 rounded-lg"><ShieldCheck className="w-8 h-8" /></div>
                <h1 className="text-4xl font-bold tracking-tight">RELATÓRIO OAC</h1>
              </div>
              <p className="text-green-100 text-sm font-medium tracking-wide uppercase opacity-90">Observação e Abordagem Comportamental</p>
            </div>
            <div className="text-right">
              <div className="bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20">
                <p className="text-xs font-bold uppercase opacity-70 mb-1">Data do Registro</p>
                <p className="text-xl font-bold">{formData.dateTime ? new Date(formData.dateTime).toLocaleDateString() : 'N/D'}</p>
              </div>
            </div>
         </div>

         {/* INFO BAR */}
         <div className="bg-gray-50 border-b border-gray-200 px-8 py-6 grid grid-cols-3 gap-6">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Observador</p>
              <p className="text-base font-bold text-gray-800">{formData.observerName || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Área</p>
              <p className="text-base font-bold text-gray-800">{formData.area || '-'}</p>
            </div>
            <div className="flex items-center gap-3 bg-white px-3 py-2 rounded-lg border border-gray-100 shadow-sm">
               <div className="bg-brand-blue/10 p-2 rounded-full text-brand-blue"><Users className="w-5 h-5" /></div>
               <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Pessoas</p>
                  <p className="text-lg font-bold text-black leading-none">{formData.peopleObserved}</p>
               </div>
            </div>
         </div>

         {/* CONTENT BODY */}
         <div className="p-8">
            {/* TAREFA */}
            <div className="mb-8">
               <h3 className="text-brand-green font-bold text-sm uppercase tracking-wider mb-3 flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Tarefa Observada</h3>
               <div className="bg-gray-50 border-l-4 border-brand-green p-4 rounded-r-lg text-gray-700 text-sm leading-relaxed">
                  {formData.taskDescription || "Nenhuma descrição fornecida."}
               </div>
            </div>

            {/* CHECKLIST SCORECARD */}
            <div className="mb-8">
               <h3 className="text-brand-green font-bold text-sm uppercase tracking-wider mb-4 flex items-center gap-2"><CheckSquare className="w-4 h-4" /> Checklist Comportamental</h3>
               <div className="grid grid-cols-2 gap-4">
                  {categoriesList.map(cat => {
                     const st = formData.categories[cat.id as keyof typeof formData.categories];
                     let bgClass = "bg-gray-50 border-gray-100";
                     let icon = <div className="w-3 h-3 rounded-full bg-gray-300" />;
                     let statusText = "NÃO OBSERVADO";
                     let textClass = "text-gray-400";

                     if (st === 'safe') {
                        bgClass = "bg-green-50 border-green-100";
                        icon = <ThumbsUp className="w-4 h-4 text-green-600" />;
                        statusText = "SEGURO";
                        textClass = "text-green-700";
                     } else if (st === 'risk') {
                        bgClass = "bg-red-50 border-red-100";
                        icon = <ThumbsDown className="w-4 h-4 text-red-600" />;
                        statusText = "RISCO";
                        textClass = "text-red-700";
                     }

                     return (
                        <div key={cat.id} className={`flex items-center justify-between p-3 rounded-lg border ${bgClass} break-inside-avoid`}>
                           <span className="font-bold text-gray-700 text-sm">{cat.label}</span>
                           <div className={`flex items-center gap-2 text-xs font-bold ${textClass} px-2 py-1 rounded-md bg-white/60`}>
                              {icon} {statusText}
                           </div>
                        </div>
                     );
                  })}
               </div>
            </div>

            {/* FOTO ANEXADA */}
            <PDFMediaAttachment file={formData.photoOAC || null} label="Registro Fotográfico" />

            {/* RISKS HIGHLIGHT */}
            {formData.riskDescription && (
               <div className="mt-8 break-inside-avoid">
                  <h3 className="text-red-600 font-bold text-sm uppercase tracking-wider mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Desvios Identificados</h3>
                  <div className="bg-red-50 border border-red-100 p-4 rounded-lg text-gray-800 text-sm">
                     {formData.riskDescription}
                  </div>
               </div>
            )}

            {/* FEEDBACK SECTION */}
            <div className="mt-8 break-inside-avoid">
               <h3 className="text-brand-green font-bold text-sm uppercase tracking-wider mb-3 flex items-center gap-2"><MessageCircle className="w-4 h-4" /> Abordagem e Feedback</h3>
               <div className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
                     <span className="text-xs font-bold text-gray-500 uppercase">Feedback Realizado?</span>
                     <span className={`px-3 py-1 rounded-full text-xs font-bold ${formData.feedbackGiven ? 'bg-brand-blue text-white' : 'bg-gray-200 text-gray-500'}`}>
                        {formData.feedbackGiven ? 'SIM, REALIZADO' : 'NÃO REALIZADO'}
                     </span>
                  </div>
                  <div className="p-4 bg-white text-sm text-gray-700 min-h-[60px]">
                     {formData.feedbackDescription || "Sem observações adicionais."}
                  </div>
               </div>
            </div>

         </div>
         
         {/* FOOTER */}
         <div className="fixed bottom-0 left-0 w-full bg-gray-100 border-t border-gray-200 p-4 text-center">
            <p className="text-[10px] text-gray-400 font-medium">Relatório gerado digitalmente pelo Sistema de Gestão de Segurança • Fagundes Construção e Mineração</p>
         </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. MAIN APP LOGIC
// ============================================================================

const initialFormState: InspectionFormState = {
  collaboratorName: '', dateTime: '', collaboratorArea: '', unit: '', location: '', description: '',
  photoInspection: null, immediateActionDescription: '', isResolvedImmediately: null, photoResolution: null,
  responsiblePerson: '', resolutionDeadline: '', suggestions: '', latitude: '', longitude: ''
};

const App: React.FC = () => {
  const [view, setView] = useState<AppView>('landing');
  const [formData, setFormData] = useState<InspectionFormState>(initialFormState);
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loadingStep, setLoadingStep] = useState<string>('');
  const [lastPdfUrl, setLastPdfUrl] = useState<string | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (view === 'inspection' && "geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => setFormData(prev => ({ ...prev, latitude: position.coords.latitude.toString(), longitude: position.coords.longitude.toString() })),
        (error) => console.warn("GPS error:", error.message),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }
  }, [view]);

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

    // Add small delay to ensure images are rendered before capture
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const opt = {
      margin: 0, filename: `inspecao.pdf`, image: { type: 'jpeg', quality: 0.95 },
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
      filesPayload.push({ fileName: pdfFileName, mimeType: 'application/pdf', base64: pdfBase64, fieldName: 'relatorio_completo' });

      if (finalFormData.photoInspection && finalFormData.photoInspection.type.startsWith('image/')) {
        const base64Media = await processMediaFile(finalFormData.photoInspection);
        filesPayload.push({ fileName: `Registro_Inspecao_${safeName}_${dateStr}.jpg`, mimeType: 'image/jpeg', base64: base64Media, fieldName: 'foto_inspecao' });
      }

      if (finalFormData.photoResolution && finalFormData.photoResolution.type.startsWith('image/')) {
        const base64Media = await processMediaFile(finalFormData.photoResolution);
        filesPayload.push({ fileName: `Registro_Resolucao_${safeName}_${dateStr}.jpg`, mimeType: 'image/jpeg', base64: base64Media, fieldName: 'foto_resolucao' });
      }

      setLoadingStep('Salvando dados no Drive...');
      const payload = {
          folderName: "inspeções Fagundes teste", 
          data: { 
            ...finalFormData, 
            type: 'INSPECTION',
            latitude: finalFormData.latitude || "ND", 
            longitude: finalFormData.longitude || "ND",
            photoInspection: "", 
            photoResolution: "",
            dateTime: new Date(finalFormData.dateTime).toLocaleString('pt-BR'),
            isResolvedImmediately: finalFormData.isResolvedImmediately === true ? "SIM" : (finalFormData.isResolvedImmediately === false ? "NÃO" : "ND")
          },
          files: filesPayload
      };

      const payloadSize = JSON.stringify(payload).length;
      if (payloadSize > 45 * 1024 * 1024) alert("Atenção: Arquivos muito grandes (>45MB). Salvo localmente, não enviado ao Drive.");

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

  const handleOACSuccess = (pdfUrl: string) => {
    setLastPdfUrl(pdfUrl);
    setSubmitted(true);
  };

  // ROUTING RENDER LOGIC
  if (view === 'landing') return <LandingPage onSelect={setView} />;
  if (view === 'oac') return <OACForm onBack={() => setView('landing')} onSubmitSuccess={handleOACSuccess} />;

  // SUCCESS STATE
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 animate-in fade-in zoom-in duration-300">
        <div className="text-center space-y-4 max-w-md w-full p-8 rounded-2xl shadow-xl border-t-4 border-brand-green bg-white">
          <div className="w-16 h-16 bg-brand-green/10 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle className="w-8 h-8 text-brand-green" /></div>
          <h2 className="text-2xl font-bold text-brand-blue">Registro Concluído!</h2>
          <div className="bg-green-50/50 border border-green-100 rounded-xl p-4 text-sm text-green-800 text-left">
             <p className="font-bold mb-2 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Sucesso:</p>
             <ul className="list-disc list-inside space-y-1 ml-1 text-green-700">
               <li>Relatório PDF baixado.</li>
               <li>Dados salvos na planilha.</li>
               <li>Arquivos salvos no Drive.</li>
             </ul>
          </div>
          {lastPdfUrl && <a href={lastPdfUrl} download={`Relatorio.pdf`} className="flex items-center justify-center gap-2 w-full py-3 border-2 border-brand-blue text-brand-blue rounded-xl font-bold hover:bg-blue-50 transition-colors mt-6"><FileDown className="w-5 h-5" /> Baixar PDF Novamente</a>}
          <div className="grid grid-cols-2 gap-3 mt-4">
             <button onClick={() => { setView('landing'); setSubmitted(false); }} className="w-full py-3 bg-gray-200 text-gray-700 rounded-xl font-bold hover:bg-gray-300 transition-colors">Menu Principal</button>
             <button onClick={() => { setSubmitted(false); setFormData(initialFormState); }} className="w-full py-3 bg-brand-blue text-white rounded-xl font-bold hover:bg-blue-900 transition-colors">Novo Registro</button>
          </div>
        </div>
      </div>
    );
  }

  // MAIN INSPECTION FORM
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 pb-12 animate-in slide-in-from-right duration-300">
      <HelpGuide isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} type="inspection" />
      <header className="bg-brand-blue shadow-lg sticky top-0 z-50 no-print pt-[env(safe-area-inset-top)]">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setView('landing')} className="p-2 -ml-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors mr-1">
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div className="bg-white/10 p-2 rounded-lg backdrop-blur-sm"><FileText className="text-white w-6 h-6" /></div>
            <div><h1 className="text-white text-lg font-bold tracking-wide uppercase leading-tight">Inspeção de Campo</h1><p className="text-blue-200 text-[10px] font-medium tracking-wider">SEGURANÇA DO TRABALHO</p></div>
          </div>
          <div className="flex items-center gap-1" ref={menuRef}>
            <button onClick={() => setIsHelpOpen(true)} className="text-white p-2 hover:bg-white/10 rounded-lg transition-colors mr-1">
              <HelpCircle className="w-6 h-6" />
            </button>
            <div className="relative">
              <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="text-white p-2 hover:bg-white/10 rounded-lg transition-colors"><Menu className="w-6 h-6" /></button>
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                  {!isLoggedIn ? (
                    <>
                      <button onClick={() => handleAuthAction('login')} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-3 transition-colors"><div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center text-brand-blue shrink-0"><LogIn className="w-4 h-4" /></div><div><span className="font-semibold block">Entrar</span><span className="text-xs text-gray-500">Acesse sua conta</span></div></button>
                    </>
                  ) : (
                    <>
                      <div className="px-4 py-3 border-b border-gray-100 mb-1 bg-gray-50"><p className="text-sm font-semibold text-gray-800">Usuário Logado</p></div>
                      <button onClick={() => handleAuthAction('logout')} className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3 transition-colors"><LogOut className="w-4 h-4" /><span className="font-medium">Sair</span></button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 mt-6">
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100/50">
          
          {/* SECTION 1: Colaborador */}
          <div className="p-6 md:p-8 space-y-6">
            <h2 className="text-lg font-bold text-brand-blue border-b border-gray-100 pb-3 flex items-center gap-2"><User className="w-5 h-5 text-brand-green" /> Dados do Colaborador</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-1.5"><label className="block text-xs font-bold uppercase text-brand-gray tracking-wider">Nome</label><input type="text" name="collaboratorName" required value={formData.collaboratorName} onChange={handleInputChange} className="w-full rounded-lg border-gray-200 shadow-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 p-3 border bg-white text-gray-800 transition-all" placeholder="Digite o nome completo" /></div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="block text-xs font-bold uppercase text-brand-gray tracking-wider">Área</label><select name="collaboratorArea" required value={formData.collaboratorArea} onChange={handleInputChange} className="w-full rounded-lg border-gray-200 shadow-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 p-3 border bg-white text-gray-800 transition-all"><option value="">Selecione...</option><option value="Produção">Produção</option><option value="Infraestrutura">Infraestrutura</option><option value="Manutenção">Manutenção</option><option value="Administrativo">Administrativo</option><option value="SESMT">SESMT</option></select></div>
                <div className="space-y-1.5"><label className="block text-xs font-bold uppercase text-brand-gray tracking-wider">Unidade</label><select name="unit" required value={formData.unit} onChange={handleInputChange} className="w-full rounded-lg border-gray-200 shadow-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 p-3 border bg-white text-gray-800 transition-all"><option value="">Selecione...</option><option value="VL">VL</option><option value="VLN">VLN</option></select></div>
              </div>
              <div className="space-y-1.5"><DateTimePicker label="Data e Hora" name="dateTime" value={formData.dateTime} onChange={(val) => setFormData(prev => ({...prev, dateTime: val}))} /></div>
            </div>
          </div>

          <div className="h-2 bg-gray-50/50 w-full border-y border-gray-100"></div>

          {/* SECTION 2: Detalhes */}
          <div className="p-6 md:p-8 space-y-6">
            <h2 className="text-lg font-bold text-brand-blue border-b border-gray-100 pb-3 flex items-center gap-2"><AlertTriangle className="w-5 h-5 text-brand-green" /> Detalhes da Inspeção</h2>
            <div className="space-y-6">
              <div className="space-y-1.5"><label className="block text-xs font-bold uppercase text-brand-gray tracking-wider flex items-center gap-1"><MapPin className="w-3 h-3" /> Local</label><input type="text" name="location" required value={formData.location} onChange={handleInputChange} className="w-full rounded-lg border-gray-200 shadow-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 p-3 border bg-white text-gray-800 transition-all" placeholder="Ex: Setor A, Máquina 3" /></div>
              <div>
                <label className="block text-xs font-bold uppercase text-brand-gray tracking-wider mb-2">Descrição</label>
                <div className="space-y-3">
                  <textarea name="description" required rows={4} value={formData.description} onChange={handleInputChange} className="w-full rounded-lg border-gray-200 shadow-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 p-3 border bg-white text-gray-800 transition-all" placeholder="Descreva o que foi observado..." />
                  <AudioRecorder onTranscriptionComplete={(text) => setFormData(prev => ({ ...prev, description: prev.description ? `${prev.description} ${text}` : text }))} />
                </div>
              </div>
              <FileInput id="photoInspection" label="Evidência (Foto/Vídeo)" onChange={(f) => setFormData(prev => ({...prev, photoInspection: f}))} selectedFile={formData.photoInspection} />
            </div>
          </div>

          <div className="h-2 bg-gray-50/50 w-full border-y border-gray-100"></div>

          {/* SECTION 3: Tratativa */}
          <div className="p-6 md:p-8 space-y-6">
            <h2 className="text-lg font-bold text-brand-blue border-b border-gray-100 pb-3 flex items-center gap-2"><CheckCircle className="w-5 h-5 text-brand-green" /> Ação e Tratativa</h2>
            <div>
              <label className="block text-xs font-bold uppercase text-brand-gray tracking-wider mb-2">Ação Imediata</label>
              <div className="space-y-3">
                <textarea name="immediateActionDescription" rows={3} value={formData.immediateActionDescription} onChange={handleInputChange} className="w-full rounded-lg border-gray-200 shadow-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 p-3 border bg-white text-gray-800 transition-all" placeholder="Descreva a ação tomada..." />
                <AudioRecorder onTranscriptionComplete={(text) => setFormData(prev => ({ ...prev, immediateActionDescription: prev.immediateActionDescription ? `${prev.immediateActionDescription} ${text}` : text }))} />
              </div>
            </div>

            <div className="bg-blue-50/50 p-5 rounded-xl border border-blue-100">
              <span className="block text-sm font-bold text-brand-blue mb-4">A irregularidade foi resolvida de imediato?</span>
              <div className="flex gap-8">
                <label className="flex items-center gap-3 cursor-pointer group"><div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.isResolvedImmediately === true ? 'border-brand-green bg-brand-green' : 'border-gray-300 bg-white'}`}><div className="w-2.5 h-2.5 bg-white rounded-full"></div></div><input type="radio" name="isResolvedImmediately" className="sr-only" checked={formData.isResolvedImmediately === true} onChange={() => setFormData(prev => ({ ...prev, isResolvedImmediately: true }))} /><span className="text-gray-700 font-medium group-hover:text-brand-green transition-colors">Sim</span></label>
                <label className="flex items-center gap-3 cursor-pointer group"><div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${formData.isResolvedImmediately === false ? 'border-red-500 bg-red-500' : 'border-gray-300 bg-white'}`}><div className="w-2.5 h-2.5 bg-white rounded-full"></div></div><input type="radio" name="isResolvedImmediately" className="sr-only" checked={formData.isResolvedImmediately === false} onChange={() => setFormData(prev => ({ ...prev, isResolvedImmediately: false }))} /><span className="text-gray-700 font-medium group-hover:text-red-500 transition-colors">Não</span></label>
              </div>
            </div>

            {formData.isResolvedImmediately === true && (
              <div className="animate-in fade-in slide-in-from-top-4 duration-300"><FileInput id="photoResolution" label="Evidência da Regularização" onChange={(f) => setFormData(prev => ({...prev, photoResolution: f}))} selectedFile={formData.photoResolution} /></div>
            )}

            {formData.isResolvedImmediately === false && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-top-4 duration-300 bg-red-50 p-5 rounded-xl border border-red-100">
                <div className="space-y-1.5"><label className="block text-xs font-bold uppercase text-red-800 tracking-wider">Responsável</label><input type="text" name="responsiblePerson" value={formData.responsiblePerson} onChange={handleInputChange} className="w-full rounded-lg border-red-200 shadow-sm focus:border-red-500 focus:ring-2 focus:ring-red-200 p-3 border bg-white" /></div>
                <div className="space-y-1.5"><label className="block text-xs font-bold uppercase text-red-800 tracking-wider">Prazo</label><input type="date" name="resolutionDeadline" value={formData.resolutionDeadline} onChange={handleInputChange} className="w-full rounded-lg border-red-200 shadow-sm focus:border-red-500 focus:ring-2 focus:ring-red-200 p-3 border bg-white" /></div>
              </div>
            )}
          </div>

          <div className="h-2 bg-gray-50/50 w-full border-y border-gray-100"></div>

          {/* SECTION 4: Sugestões */}
          <div className="p-6 md:p-8 space-y-6">
            <h2 className="text-lg font-bold text-brand-blue flex items-center gap-2"><Sparkles className="w-5 h-5 text-brand-green" /> Sugestões</h2>
            <textarea name="suggestions" rows={3} value={formData.suggestions} onChange={handleInputChange} className="w-full rounded-lg border-gray-200 shadow-sm focus:border-brand-blue focus:ring-2 focus:ring-brand-blue/20 p-3 border bg-white text-gray-800 transition-all" placeholder="Ideias ou observações..." />
          </div>

          <div className="p-6 md:p-8 bg-gray-50 border-t border-gray-200 flex justify-end no-print">
            <button type="submit" disabled={isSubmitting} className={`flex items-center gap-2 px-8 py-4 rounded-xl font-bold shadow-lg transition-all text-lg w-full md:w-auto justify-center ${isSubmitting ? 'bg-gray-400 text-gray-200 cursor-not-allowed' : 'bg-brand-green text-white hover:bg-lime-600 hover:shadow-xl hover:-translate-y-0.5 active:scale-95'}`}>
              {isSubmitting ? <><Loader2 className="w-6 h-6 animate-spin" /> {loadingStep}</> : <><Send className="w-6 h-6" /> Salvar Relatório</>}
            </button>
          </div>
        </form>
        <footer className="text-center mt-8 mb-4 text-brand-gray text-xs no-print">
          <p>© {new Date().getFullYear()} Sistema de Inspeção. Todos os direitos reservados.</p>
          <p className="mt-1 font-medium">Desenvolvido por Welson</p>
        </footer>
      </main>

      {/* PDF INSPECTION - MODERN DESIGN */}
      <div ref={printRef} style={{ display: 'none', width: '210mm', minHeight: '297mm', backgroundColor: 'white', padding: '0', color: '#333', fontFamily: 'Inter, sans-serif' }}>
        {/* HEADER */}
        <div className="bg-brand-blue text-white p-8 flex justify-between items-start">
           <div>
             <div className="flex items-center gap-3 mb-2">
               <div className="bg-white/20 p-2 rounded-lg"><FileText className="w-8 h-8" /></div>
               <h1 className="text-4xl font-bold tracking-tight">RELATÓRIO DE INSPEÇÃO</h1>
             </div>
             <p className="text-blue-200 text-sm font-medium tracking-wide uppercase opacity-90">Segurança do Trabalho e Meio Ambiente</p>
           </div>
           <div className="text-right">
             <div className="bg-white/10 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/20">
               <p className="text-xs font-bold uppercase opacity-70 mb-1">Data da Emissão</p>
               <p className="text-xl font-bold">{new Date().toLocaleDateString()}</p>
             </div>
           </div>
        </div>

        {/* METADATA GRID */}
        <div className="bg-gray-50 border-b border-gray-200 px-8 py-6 grid grid-cols-2 gap-y-4 gap-x-8">
           <div className="border-b border-gray-200 pb-2">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Colaborador</p>
             <p className="text-base font-bold text-gray-800">{formData.collaboratorName || '-'}</p>
           </div>
           <div className="border-b border-gray-200 pb-2">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Data da Ocorrência</p>
             <p className="text-base font-bold text-gray-800">{formData.dateTime ? new Date(formData.dateTime).toLocaleString() : '-'}</p>
           </div>
           <div className="border-b border-gray-200 pb-2">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Área / Unidade</p>
             <p className="text-base font-bold text-gray-800">{formData.collaboratorArea || '-'} / {formData.unit || '-'}</p>
           </div>
           <div className="border-b border-gray-200 pb-2">
             <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Local Específico</p>
             <p className="text-base font-bold text-gray-800">{formData.location || '-'}</p>
           </div>
        </div>

        {/* MAIN BODY */}
        <div className="p-8">
           {/* DESCRIÇÃO */}
           <div className="mb-8">
             <h3 className="text-brand-blue font-bold text-sm uppercase tracking-wider mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Descrição da Ocorrência</h3>
             <div className="text-gray-700 text-sm leading-relaxed text-justify bg-gray-50 p-4 rounded-lg border border-gray-100">
               {formData.description || 'Nenhuma descrição fornecida.'}
             </div>
             <PDFMediaAttachment file={formData.photoInspection} label="Registro Fotográfico" />
           </div>

           {/* TRATATIVA */}
           <div className="mb-8 break-inside-avoid">
             <h3 className="text-brand-blue font-bold text-sm uppercase tracking-wider mb-3 flex items-center gap-2"><Construction className="w-4 h-4" /> Ação e Tratativa</h3>
             
             <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Ação Imediata */}
                <div className="p-5 border-b border-gray-100">
                   <p className="text-xs font-bold text-gray-400 uppercase mb-2">Ação Imediata Realizada</p>
                   <p className="text-sm text-gray-800">{formData.immediateActionDescription || '-'}</p>
                </div>

                {/* Status Resolution */}
                <div className="grid grid-cols-2">
                   <div className={`p-5 flex flex-col justify-center ${formData.isResolvedImmediately ? 'bg-green-50' : 'bg-red-50'}`}>
                      <p className="text-xs font-bold uppercase opacity-70 mb-1">Status da Resolução</p>
                      <div className="flex items-center gap-2">
                        {formData.isResolvedImmediately 
                          ? <><CheckCircle className="w-5 h-5 text-green-600" /><span className="text-green-800 font-bold">RESOLVIDO</span></>
                          : <><Clock className="w-5 h-5 text-red-600" /><span className="text-red-800 font-bold">PENDENTE</span></>
                        }
                      </div>
                   </div>
                   
                   {!formData.isResolvedImmediately && (
                     <div className="p-5 bg-gray-50 border-l border-gray-200">
                        <div className="mb-3">
                           <p className="text-[10px] font-bold uppercase text-gray-400">Responsável</p>
                           <p className="font-bold text-gray-800 text-sm">{formData.responsiblePerson || '-'}</p>
                        </div>
                        <div>
                           <p className="text-[10px] font-bold uppercase text-gray-400">Prazo Limite</p>
                           <p className="font-bold text-gray-800 text-sm">{formData.resolutionDeadline ? new Date(formData.resolutionDeadline).toLocaleDateString() : '-'}</p>
                        </div>
                     </div>
                   )}
                </div>
             </div>
             
             {formData.isResolvedImmediately && <PDFMediaAttachment file={formData.photoResolution} label="Evidência da Regularização" />}
           </div>

           {/* SUGESTÕES */}
           {formData.suggestions && (
             <div className="mb-8 break-inside-avoid">
               <h3 className="text-brand-blue font-bold text-sm uppercase tracking-wider mb-3 flex items-center gap-2"><Lightbulb className="w-4 h-4" /> Sugestões de Melhoria</h3>
               <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100 text-gray-700 text-sm italic">
                 "{formData.suggestions}"
               </div>
             </div>
           )}
        </div>

        {/* FOOTER */}
        <div className="fixed bottom-0 left-0 w-full bg-gray-100 border-t border-gray-200 p-4 text-center">
            <p className="text-[10px] text-gray-400 font-medium">Relatório gerado digitalmente pelo Sistema de Gestão de Segurança • Fagundes Construção e Mineração</p>
         </div>
      </div>
    </div>
  );
};

// ============================================================================
// 6. MOUNT
// ============================================================================
const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

window.addEventListener('error', (e) => {
  if (e.message.includes('ResizeObserver')) e.stopImmediatePropagation();
});

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);