import { motion } from 'motion/react';
import { X, Settings as SettingsIcon, Globe, Trash2, Palette, Sparkles } from 'lucide-react';
import { Language, translations } from '../i18n';

interface SettingsModalProps {
  onClose: () => void;
  lang: Language;
  setLang: (l: Language) => void;
  gameSettings: { confetti: boolean; mapStyle: 'light' | 'dark' };
  updateGameSettings: (settings: Partial<{ confetti: boolean; mapStyle: 'light' | 'dark' }>) => void;
}

export function SettingsModal({ onClose, lang, setLang, gameSettings, updateGameSettings }: SettingsModalProps) {
  const t = translations[lang];

  const clearLocalData = () => {
    if (confirm(lang === 'es' ? '¿Estás seguro de borrar todas las puntuaciones locales?' : 'Are you sure you want to clear all local scores?')) {
      localStorage.removeItem('countryGameHighScores');
      alert(lang === 'es' ? 'Datos locales borrados.' : 'Local data cleared.');
      window.location.reload();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden relative"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <SettingsIcon className="w-5 h-5" />
              {lang === 'es' ? 'Ajustes' : 'Settings'}
            </h2>
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Globe className="w-4 h-4" />
                {lang === 'es' ? 'Idioma' : 'Language'}
              </label>
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => setLang('es')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                    lang === 'es' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  Español
                </button>
                <button
                  onClick={() => setLang('en')}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                    lang === 'en' 
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  English
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-4 h-4" />
                {lang === 'es' ? 'Estilo del Mapa' : 'Map Style'}
              </label>
              <div className="flex bg-slate-100 rounded-lg p-1">
                <button
                  onClick={() => updateGameSettings({ mapStyle: 'light' })}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                    gameSettings.mapStyle === 'light'
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {lang === 'es' ? 'Claro' : 'Light'}
                </button>
                <button
                  onClick={() => updateGameSettings({ mapStyle: 'dark' })}
                  className={`flex-1 py-2 text-sm font-bold rounded-md transition-all ${
                    gameSettings.mapStyle === 'dark'
                      ? 'bg-white text-blue-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {lang === 'es' ? 'Oscuro' : 'Dark'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                {lang === 'es' ? 'Animaciones' : 'Animations'}
              </label>
              <button
                onClick={() => updateGameSettings({ confetti: !gameSettings.confetti })}
                className={`flex items-center justify-between w-full py-3 px-4 rounded-lg font-semibold transition-colors text-sm ${
                  gameSettings.confetti ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                }`}
              >
                <span>{lang === 'es' ? 'Confeti al ganar' : 'Confetti on win'}</span>
                <div className={`w-10 h-5 rounded-full p-0.5 transition-colors ${gameSettings.confetti ? 'bg-blue-500' : 'bg-slate-300'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${gameSettings.confetti ? 'translate-x-5' : 'translate-x-0'}`} />
                </div>
              </button>
            </div>

            <div className="flex flex-col gap-2 pt-4 border-t border-slate-100">
              <label className="text-sm font-semibold text-slate-600 uppercase tracking-wider">
                {lang === 'es' ? 'Datos' : 'Data'}
              </label>
              <button
                onClick={clearLocalData}
                className="flex items-center justify-between w-full py-3 px-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-lg font-semibold transition-colors text-sm"
              >
                <span className="flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  {lang === 'es' ? 'Borrar datos locales' : 'Clear local data'}
                </span>
              </button>
              <p className="text-xs text-slate-400 px-1">
                {lang === 'es' 
                  ? 'Borrará las puntuaciones almacenadas en este dispositivo (no afecta al ranking global).' 
                  : 'This will clear scores saved on this device (does not affect global ranking).'
                }
              </p>
            </div>
          </div>
          
          <div className="mt-8">
            <button
              onClick={onClose}
              className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-colors"
            >
              {t.close}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
