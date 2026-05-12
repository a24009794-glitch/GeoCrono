import { motion } from 'motion/react';
import { X, Globe, Keyboard, Mic, Trophy } from 'lucide-react';
import { useState, useEffect } from 'react';

interface TutorialModalProps {
  onClose: () => void;
}

export function TutorialModal({ onClose }: TutorialModalProps) {
  const [step, setStep] = useState(0);

  // Focus lock or prevent bg scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = 'auto'; };
  }, []);

  const steps = [
    {
      icon: <Globe className="w-12 h-12 text-blue-500" />,
      title: "Bienvenido a GeoCrono",
      desc: "El juego de geografía donde pones a prueba tus conocimientos sobre los países del mundo. ¡Adivina todos los que puedas antes de que se acabe el tiempo!",
    },
    {
      icon: <Keyboard className="w-12 h-12 text-slate-700" />,
      title: "Cómo jugar",
      desc: "Escribe el nombre del país en la barra de texto. Puedes seleccionar una región específica y un límite de tiempo. ¡El mapa se iluminará cuando aciertes!",
    },
    {
      icon: <Mic className="w-12 h-12 text-blue-500" />,
      title: "Usa tu voz (Opcional)",
      desc: "Si prefieres, activa el micrófono y simplemente di el nombre de los países en voz alta. También cuenta con inteligencia artificial para tolerar variaciones y errores de pronunciación.",
    },
    {
      icon: <Trophy className="w-12 h-12 text-amber-500" />,
      title: "Ránkings y Puntuaciones",
      desc: "Inicia sesión para registrar tus puntajes. Compite contra otros jugadores de tu país y ayuda a tu nación a subir en el ranking mundial.",
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden relative"
      >
        <div className="p-6 pt-10 flex flex-col items-center text-center relative z-10">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="mb-6 p-5 bg-slate-50 border border-slate-100 rounded-full shadow-sm">
            {steps[step].icon}
          </div>
          
          <h2 className="text-2xl font-bold text-slate-800 mb-3 tracking-tight">{steps[step].title}</h2>
          <p className="text-slate-600 mb-8 min-h-[96px] leading-relaxed text-[15px]">
            {steps[step].desc}
          </p>
          
          <div className="flex w-full gap-3">
            {step > 0 && (
              <button 
                onClick={() => setStep(step - 1)}
                className="flex-1 py-3 px-4 rounded-xl font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
              >
                Anterior
              </button>
            )}
            <button 
              onClick={() => {
                if (step < steps.length - 1) setStep(step + 1);
                else {
                  localStorage.setItem('geocrono_tutorial_seen', 'true');
                  onClose();
                }
              }}
              className="flex-[2] py-3 px-4 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-md shadow-blue-500/20"
            >
              {step < steps.length - 1 ? 'Siguiente' : '¡A Jugar!'}
            </button>
          </div>
          
          <div className="flex gap-2 mt-6">
            {steps.map((_, i) => (
              <div 
                key={i} 
                className={`w-2 h-2 rounded-full transition-all duration-300 ${i === step ? 'bg-blue-600 w-6' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
