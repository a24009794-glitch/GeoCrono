import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Play, RotateCcw, LogIn, LogOut, Trophy, Mic, MicOff, Lightbulb, Flag, X, HelpCircle, Settings } from 'lucide-react';
import confetti from 'canvas-confetti';
import { countries } from './data/countries';
import { validateCountry } from './utils/validation';
import { validateWithAI } from './services/gemini';
import { WorldMap } from './components/WorldMap';
import { TutorialModal } from './components/TutorialModal';
import { SettingsModal } from './components/SettingsModal';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { db } from './firebase';
import { handleFirestoreError, OperationType } from './utils/firebaseError';
import { doc, setDoc, getDoc, serverTimestamp, collection, query, where, getDocs, increment, updateDoc } from 'firebase/firestore';
import { Language, translations } from './i18n';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const REGIONS: Array<keyof typeof translations.es.regions> = ['Mundo', 'América', 'Europa', 'África', 'Asia', 'Oceanía'];
const TIME_OPTIONS = [
  { id: 'fast', value: 180, desc: '3 min' },
  { id: 'normal', value: 300, desc: '5 min' },
  { id: 'slow', value: 600, desc: '10 min' },
] as const;

export default function App() {
  const [lang, setLang] = useState<Language>('es');
  
  const [user, setUser] = useState<{ uid: string; displayName: string; photoURL: string; country?: string } | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginNickname, setLoginNickname] = useState('');
  const [loginCountry, setLoginCountry] = useState('México');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardMode, setLeaderboardMode] = useState<'individual' | 'countries'>('individual');
  const [leaderboardData, setLeaderboardData] = useState<any[]>([]);
  const [countryLeaderboardData, setCountryLeaderboardData] = useState<any[]>([]);
  const [isLoadingLeaderboard, setIsLoadingLeaderboard] = useState(false);
  const [showTutorial, setShowTutorial] = useState(() => localStorage.getItem('geocrono_tutorial_seen') !== 'true');
  const [showSettings, setShowSettings] = useState(false);
  const [gameSettings, setGameSettings] = useState<{ confetti: boolean; mapStyle: 'light' | 'dark' }>(() => {
    const saved = localStorage.getItem('geocrono_settings');
    return saved ? JSON.parse(saved) : { confetti: true, mapStyle: 'light' };
  });

  const updateGameSettings = (newSettings: Partial<typeof gameSettings>) => {
    const updated = { ...gameSettings, ...newSettings };
    setGameSettings(updated);
    localStorage.setItem('geocrono_settings', JSON.stringify(updated));
  };

  const [region, setRegion] = useState<keyof typeof translations.es.regions>('Mundo');
  const [selectedTime, setSelectedTime] = useState(180);

  const t = translations[lang];
  const [isPlaying, setIsPlaying] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(180);
  const [input, setInput] = useState('');
  const [foundCountries, setFoundCountries] = useState<string[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [feedbackType, setFeedbackType] = useState<'success' | 'error' | 'info'>('success');
  const [highScores, setHighScores] = useState<Record<string, { score: number, percentage: number }>>({});
  
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<any>(null);
  const intentionalStopRef = useRef(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const totalCountries = countries.filter(c => region === 'Mundo' || c.regions.includes(region)).length;

  useEffect(() => {
    const savedUser = localStorage.getItem('geochrono_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('countryGameHighScores');
    if (saved) {
      try {
        setHighScores(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse high scores', e);
      }
    }
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    } else if (isPlaying && timeLeft === 0) {
      endGame();
    }
    return () => clearInterval(timer);
  }, [isPlaying, timeLeft]);

  useEffect(() => {
    if (showLeaderboard) {
      loadLeaderboard();
    }
  }, [region, selectedTime]);

  // Heal user max score and country score
  useEffect(() => {
    if (user && user.country) {
      try {
        const localScores = JSON.parse(localStorage.getItem('countryGameHighScores') || '{}');
        const maxPerRegion: Record<string, number> = {};
        Object.keys(localScores).forEach(key => {
          const [reg] = key.split('-');
          const score = localScores[key]?.score || 0;
          if (score > (maxPerRegion[reg] || 0)) {
            maxPerRegion[reg] = score;
          }
        });
        Object.entries(maxPerRegion).forEach(([reg, maxScore]) => {
          updateUserRegionMaxScore(user, maxScore, reg);
        });
      } catch (e) {
        // ignore
      }
    }
  }, [user]);

  const startGame = () => {
    setIsPlaying(true);
    setIsFinished(false);
    setTimeLeft(selectedTime);
    setFoundCountries([]);
    setInput('');
    setFeedbackMsg('');
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      intentionalStopRef.current = true;
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // block catch
      }
      setIsListening(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert(lang === 'es' ? "Tu navegador no soporta reconocimiento de voz." : "Your browser does not support speech recognition.");
      return;
    }

    intentionalStopRef.current = false;

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = lang === 'es' ? 'es-ES' : 'en-US';

      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        const cleanText = transcript.replace(/[.,;?¿!¡]/g, '').trim();
        
        // Update input field momentarily to give feedback
        setInput(cleanText || transcript);
        
        // Try validating immediately inside a timeout to allow state to settle or process directly 
        processVoiceInput(cleanText || transcript);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'no-speech') {
          // just ignore, let onend restart it
          return;
        }
        if (event.error === 'not-allowed' || event.error === 'aborted') {
          intentionalStopRef.current = true;
        }
        console.error("Speech recognition error", event.error);
        if (intentionalStopRef.current) {
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        if (!intentionalStopRef.current && isListening) {
          // Auto restart to keep listening continuously 
          setTimeout(() => {
            if (!intentionalStopRef.current) {
              try {
                recognitionRef.current.start();
              } catch (e) {
                console.error("Auto restart failed", e);
                setIsListening(false);
              }
            }
          }, 200);
        } else {
          setIsListening(false);
        }
      };
      
      recognitionRef.current = recognition;
    }

    try {
      recognitionRef.current.start();
      setIsListening(true);
    } catch (e) {
      console.error(e);
      // Already started, make sure state matches
      setIsListening(true);
    }
  };

  const processVoiceInput = (spokenText: string) => {
    if (isValidating) return;
    
    // Clean up punctuation that speech recognition might append
    const cleanText = spokenText.replace(/[.,;?¿!¡]/g, '').trim();
    if (!cleanText) return;
    
    // Split spoken text into possible segments (helps if the user says multiple countries really fast like "Brasil Argentina Colombia")
    // Note: Speech recognition usually chunks this nicely anyways, but just in case we can try to evaluate the whole chunk first.
    const chunks = cleanText.split(/\s+y\s+|\s+and\s+|,\s*/i);

    let anyMatched = false;

    chunks.forEach(val => {
      if (!val.trim()) return;
      
      // 1. Local validation ONLY for voice. 
      // We do NOT use AI here because background noise or chatting could trigger expensive AI calls.
      let matchedCountry = validateCountry(val.trim(), region);
      
      if (matchedCountry) {
        anyMatched = true;
        if (foundCountries.includes(matchedCountry)) {
          setFeedbackMsg(`${t.alreadyFound} ${lang === 'en' ? (countries.find(c => c.name === matchedCountry)?.nameEn || matchedCountry) : matchedCountry}!`);
          setFeedbackType('error');
        } else {
          const countryData = countries.find(c => c.name === matchedCountry);
          const cName = lang === 'en' ? (countryData?.nameEn || matchedCountry) : matchedCountry;
          
          if (countryData && (region === 'Mundo' || countryData.regions.includes(region))) {
            setFoundCountries(prev => {
              // Safety check again inside the setter to avoid race condition of rapid speech
              if (prev.includes(matchedCountry!)) return prev;
              const newFound = [matchedCountry!, ...prev];
              if (newFound.length === totalCountries) {
                 endGame();
              }
              return newFound;
            });
            setFeedbackMsg(`${t.correct} ${cName} ${t.addedToList}`);
            setFeedbackType('success');
          } else {
            setFeedbackMsg(`${cName} ${t.notInRegion} ${t.regions[region]}.`);
            setFeedbackType('error');
          }
        }
      }
    });

    // Only clear input if we extracted *something* successfully or it was just noise we ignored
    setInput('');
  };

  const giveHint = () => {
    const missing = countries.filter(c => 
      (region === 'Mundo' || c.regions.includes(region)) && 
      !foundCountries.includes(c.name)
    );
    
    if (missing.length === 0) return;
    
    const randomCountry = missing[Math.floor(Math.random() * missing.length)];
    const countryName = lang === 'es' ? randomCountry.name : (randomCountry.nameEn || randomCountry.name);
    
    const firstLetter = countryName.charAt(0).toUpperCase();
    const letterCount = countryName.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ]/g, '').length;
    
    const words = countryName.split(' ').length;
    let descLengths = `${letterCount} letras`;
    if (words > 1) {
      descLengths = `${words} palabras, ${letterCount} letras`;
    }
    
    let descLengthsEn = `${letterCount} letters`;
    if (words > 1) {
      descLengthsEn = `${words} words, ${letterCount} letters`;
    }
    
    const hintMsg = lang === 'es' 
      ? `💡 Pista: Empieza por '${firstLetter}', tiene ${descLengths}.` 
      : `💡 Hint: Starts with '${firstLetter}', has ${descLengthsEn}.`;
      
    setFeedbackMsg(hintMsg);
    setFeedbackType('info'); 
    if (!isListening) {
      inputRef.current?.focus();
    }
  };

  const updateUserRegionMaxScore = (u: NonNullable<typeof user>, currentScore: number, gameRegion: string) => {
    if (!u.country || currentScore <= 0) return;
    
    const userMaxRef = doc(db, "userRegionScores", `${u.uid}_${gameRegion}`);
    getDoc(userMaxRef).then(docSnap => {
      const data = docSnap.data();
      const previousMaxScore = data?.maxScore || 0;
      
      if (currentScore > previousMaxScore) {
        const increase = currentScore - previousMaxScore;
        const isNewPlayer = !docSnap.exists();
        
        // Update user max
        setDoc(userMaxRef, {
          userId: u.uid,
          displayName: u.displayName,
          photoURL: u.photoURL,
          country: u.country,
          region: gameRegion,
          maxScore: currentScore,
          updatedAt: serverTimestamp()
        }).catch((err) => { handleFirestoreError(err, OperationType.WRITE, 'userRegionScores') });
        
        // Update country total
        const countryRef = doc(db, "countryRegionScores", `${u.country}_${gameRegion}`);
        setDoc(countryRef, {
          country: u.country,
          region: gameRegion,
          totalScore: increment(increase),
          playersCount: increment(isNewPlayer ? 1 : 0),
          updatedAt: serverTimestamp()
        }, { merge: true }).catch((err) => { handleFirestoreError(err, OperationType.WRITE, 'countryRegionScores') });
      }
    }).catch((err) => { handleFirestoreError(err, OperationType.GET, 'userRegionScores') });
  };

  const endGame = () => {
    setIsPlaying(false);
    setIsFinished(true);
    
    const currentScore = foundCountries.length;
    const percentage = Math.round((currentScore / totalCountries) * 100);
    
    if (percentage > 80 && gameSettings.confetti) {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
    }

    const hsKey = `${region}-${selectedTime}`;

    setHighScores(prev => {
      const currentHigh = prev[hsKey];
      if (!currentHigh || currentScore > currentHigh.score) {
        const newScores = {
          ...prev,
          [hsKey]: { score: currentScore, percentage }
        };
        localStorage.setItem('countryGameHighScores', JSON.stringify(newScores));
        return newScores;
      }
      return prev;
    });

    // Save to Firebase (independent of localStorage best)
    if (user && currentScore > 0) {
      updateUserRegionMaxScore(user, currentScore, region);

      const docId = `${user.uid}_${region}_${selectedTime}`;
      
      // Get current Firebase score first to see if we should update
      const docRef = doc(db, "highScores", docId);
      getDoc(docRef).then(docSnap => {
        const data = docSnap.data();
        if (!docSnap.exists() || currentScore > (data?.score || 0)) {
          setDoc(docRef, {
            userId: user.uid,
            displayName: user?.displayName || 'Anónimo',
            photoURL: user?.photoURL || '',
            country: user?.country || '',
            region,
            difficulty: selectedTime,
            score: currentScore,
            totalCount: totalCountries,
            percentage,
            updatedAt: serverTimestamp()
          }).catch(err => {
            handleFirestoreError(err, OperationType.WRITE, 'highScores');
          });
        }
      }).catch(() => {
        // Ignore read error
      });
    }
  };

  const loadLeaderboard = async () => {
    setShowLeaderboard(true);
    setIsLoadingLeaderboard(true);
    try {
      const q = query(
        collection(db, "highScores"),
        where("region", "==", region),
        where("difficulty", "==", selectedTime)
      );
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(doc => doc.data());
      
      // Sort client-side to avoid needing a Firestore composite index
      data.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return (a.updatedAt?.toMillis?.() || 0) - (b.updatedAt?.toMillis?.() || 0);
      });
      setLeaderboardData(data.slice(0, 50));
      
      // Hard recalculation of playersCount and score to ensure data consistency
      const userMaxQ = query(collection(db, "userRegionScores"), where("region", "==", region));
      const userMaxSnap = await getDocs(userMaxQ);
      
      const countryStats: Record<string, { totalScore: number, playersCount: number }> = {};
      
      userMaxSnap.docs.forEach(d => {
        const data = d.data();
        if (data.country && data.maxScore) {
          if (!countryStats[data.country]) {
            countryStats[data.country] = { totalScore: 0, playersCount: 0 };
          }
          countryStats[data.country].totalScore += data.maxScore;
          countryStats[data.country].playersCount += 1;
        }
      });
      
      const syncedData = Object.entries(countryStats).map(([country, stats]) => ({
        country,
        region,
        totalScore: stats.totalScore,
        playersCount: stats.playersCount
      })).sort((a,b) => b.totalScore - a.totalScore);
      
      setCountryLeaderboardData(syncedData.slice(0, 50));
      
      // Async update aggregated document in background
      syncedData.forEach(cd => {
        setDoc(doc(db, "countryRegionScores", `${cd.country}_${region}`), {
          country: cd.country,
          region,
          totalScore: cd.totalScore,
          playersCount: cd.playersCount,
          updatedAt: serverTimestamp()
        }, { merge: true }).catch(() => {});
      });

    } catch (error) {
      handleFirestoreError(error, OperationType.GET, 'highScores');
    } finally {
      setIsLoadingLeaderboard(false);
    }
  };

  const resetToConfig = () => {
    setIsPlaying(false);
    setIsFinished(false);
    setFoundCountries([]);
    setInput('');
    setFeedbackMsg('');
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim() && !isValidating) {
      const val = input.trim();
      setInput('');
      setFeedbackMsg('');
      
      // 1. Local validation
      let matchedCountry = validateCountry(val, region);
      
      // 2. AI validation fallback (ONLY FOR MANUAL TYPING)
      if (!matchedCountry) {
        setIsValidating(true);
        matchedCountry = await validateWithAI(val, region);
        setIsValidating(false);
        
        // Refocus input after async validation safely
        setTimeout(() => { if (!isListening) inputRef.current?.focus(); }, 10);
      }

      if (matchedCountry) {
        // Check if already found
        if (foundCountries.includes(matchedCountry)) {
          setFeedbackMsg(`${t.alreadyFound} ${lang === 'en' ? (countries.find(c => c.name === matchedCountry)?.nameEn || matchedCountry) : matchedCountry}!`);
          setFeedbackType('error');
        } else {
          // Check if it belongs to the selected region
          const countryData = countries.find(c => c.name === matchedCountry);
          const cName = lang === 'en' ? (countryData?.nameEn || matchedCountry) : matchedCountry;
          
          if (countryData && (region === 'Mundo' || countryData.regions.includes(region))) {
            setFoundCountries(prev => [matchedCountry!, ...prev]);
            setFeedbackMsg(`${t.correct} ${cName} ${t.addedToList}`);
            setFeedbackType('success');
            
            // Check if won
            if (foundCountries.length + 1 === totalCountries) {
              endGame();
            }
          } else {
            setFeedbackMsg(`${cName} ${t.notInRegion} ${t.regions[region]}.`);
            setFeedbackType('error');
          }
        }
      } else {
        setFeedbackMsg(`"${val}" ${t.notRecognized}`);
        setFeedbackType('error');
      }
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800 font-sans overflow-hidden">
      <header className="h-auto md:h-[70px] bg-white border-b-2 border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-10 p-4 md:px-10 shrink-0">
        <div className="flex w-full md:w-auto justify-between items-center shrink-0 gap-4">
          <button 
            onClick={resetToConfig}
            className="text-[20px] font-extrabold tracking-tight uppercase text-blue-600 hover:opacity-80 transition-opacity cursor-pointer focus:outline-none"
          >
            {t.title}
          </button>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowTutorial(true)}
              className="flex items-center justify-center p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors md:hidden"
              title="Ver Tutorial"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="flex items-center justify-center p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors md:hidden"
              title={lang === 'es' ? 'Ajustes' : 'Settings'}
            >
              <Settings className="w-5 h-5" />
            </button>
            
            <div className="md:hidden ml-2 border-l border-slate-200 pl-4">
              {isAuthReady && user ? (
                <div className="flex items-center gap-3">
                <div className="flex items-center justify-center bg-slate-100 rounded-full p-1">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold">
                      {user.displayName?.charAt(0) || '?'}
                    </div>
                  )}
                </div>
                <button onClick={() => {
                  setUser(null);
                  localStorage.removeItem('geochrono_user');
                }} className="text-slate-400 hover:text-red-500 transition-colors" title="Cerrar sesión">
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button onClick={() => setShowLoginModal(true)} className="flex items-center justify-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 px-3 py-2 rounded-md hover:bg-blue-100 transition-colors">
                <LogIn className="w-4 h-4" />
                {t.login}
              </button>
            )}
            </div>
          </div>
        </div>

        <div className="flex gap-2.5 overflow-x-auto hide-scrollbar flex-1 w-full md:w-auto md:mr-4 pb-2 md:pb-0">
          {REGIONS.map(r => (
            <button
              key={r}
              onClick={() => {
                if (!isPlaying) {
                  setRegion(r);
                  setLeaderboardData([]);
                }
              }}
              disabled={isPlaying}
              className={cn(
                "px-4 py-2 border border-slate-200 bg-transparent rounded text-[13px] font-semibold cursor-pointer uppercase transition-colors whitespace-nowrap",
                region === r ? "bg-slate-800 text-white border-slate-800" : "hover:bg-slate-100",
                isPlaying && "opacity-50 cursor-not-allowed"
              )}
            >
              {t.regions[r]}
            </button>
          ))}
        </div>
        
        <div className="hidden md:flex items-center gap-4 shrink-0 border-l-2 border-slate-200 pl-6 py-2">
          {isAuthReady && user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-slate-100 rounded-full pr-4 p-1">
                {user.photoURL && (
                  <img src={user.photoURL} alt="Profile" className="w-8 h-8 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                )}
                <span className="text-xs font-bold text-slate-700 max-w-[100px] truncate">{user.displayName}</span>
              </div>
              <button onClick={() => {
                setUser(null);
                localStorage.removeItem('geochrono_user');
              }} className="text-slate-400 hover:text-red-500 transition-colors" title="Cerrar sesión">
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button onClick={() => setShowLoginModal(true)} className="flex items-center gap-2 text-sm font-bold text-blue-600 bg-blue-50 px-4 py-2 rounded-md hover:bg-blue-100 transition-colors">
              <LogIn className="w-4 h-4" />
              {t.loginRanking}
            </button>
          )}
          <div className="flex items-center gap-2 ml-2 border-l border-slate-200 pl-4">
            <button 
              onClick={() => setShowTutorial(true)}
              className="flex items-center justify-center p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              title="Ver Tutorial"
            >
              <HelpCircle className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowSettings(true)}
              className="flex items-center justify-center p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
              title={lang === 'es' ? 'Ajustes' : 'Settings'}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col md:flex-row overflow-y-auto md:overflow-hidden relative">
        <aside className={cn(
          "bg-white border-slate-200 shrink-0",
          "w-full md:w-[280px] p-4 md:p-[30px] flex-col overflow-visible md:overflow-y-auto",
          isPlaying || isFinished ? "border-b-2 md:border-b-0 md:border-r-2" : "border-r-0 md:border-r-2" // Adjust borders
        )}>
          {isPlaying || isFinished ? (
            <div className="flex flex-col md:gap-[30px]">
              <div className="flex flex-row md:flex-col justify-between md:justify-start items-center md:items-start gap-4 md:gap-0">
                <div className="flex flex-col gap-1 md:gap-1.5 md:mb-[30px]">
                  <span className="text-[10px] md:text-[12px] uppercase tracking-[1px] text-slate-500 font-bold">{t.time}</span>
                  <span className="text-2xl md:text-[42px] font-extrabold leading-none text-red-500 tabular-nums">
                    {formatTime(timeLeft)}
                  </span>
                </div>
                <div className="flex flex-col gap-1 md:gap-1.5 md:mb-[30px]">
                  <span className="text-[10px] md:text-[12px] uppercase tracking-[1px] text-slate-500 font-bold">{t.hits}</span>
                  <span className="text-2xl md:text-[42px] font-extrabold leading-none">
                    {foundCountries.length} / {totalCountries}
                  </span>
                </div>
                <div className="flex flex-col gap-1 md:gap-1.5">
                  <span className="text-[10px] md:text-[12px] uppercase tracking-[1px] text-slate-500 font-bold">{t.accuracy}</span>
                  <span className="text-2xl md:text-[42px] font-extrabold leading-none text-blue-600">
                    {Math.round((foundCountries.length / totalCountries) * 100) || 0}%
                  </span>
                </div>
              </div>
              <div className="hidden md:flex mt-auto flex-col gap-4">
                {isPlaying && (
                  <button
                    onClick={endGame}
                    className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors text-center md:text-left uppercase tracking-wider mt-4 md:mt-0"
                  >
                    {t.giveUp}
                  </button>
                )}
                <p className="hidden md:block text-[11px] text-slate-500 leading-relaxed">
                  {t.hint}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 md:min-h-full py-4 md:py-0 md:justify-center">
              <div className="text-center hidden md:block shrink-0">
                <Globe className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-slate-800 mb-2">{t.config}</h2>
                <p className="text-sm text-slate-500">{t.configDesc}</p>
              </div>

              {highScores[`${region}-${selectedTime}`] && (
                <div className="relative p-4 md:p-5 bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200/60 shadow-sm overflow-hidden group hover:shadow-md transition-shadow shrink-0 w-full">
                  <div className="absolute -right-4 -top-4 w-20 h-20 bg-emerald-100 rounded-full blur-2xl opacity-60 group-hover:opacity-80 transition-opacity"></div>
                  <div className="relative z-10 flex flex-col items-center w-full">
                    <div className="flex justify-center items-center gap-1.5 mb-2 w-full">
                      <span className="text-xl shrink-0">🏆</span>
                      <p className="text-[10px] md:text-[11px] uppercase tracking-wide text-emerald-800/80 font-bold text-center leading-tight">
                        {t.bestScore}
                      </p>
                      <span className="text-xl shrink-0">🏆</span>
                    </div>
                    
                    <p className="text-3xl md:text-4xl font-black text-emerald-900 tracking-tight flex items-baseline gap-1 mt-1">
                      {highScores[`${region}-${selectedTime}`].score}
                      <span className="text-xs md:text-sm font-bold text-emerald-700 uppercase tracking-widest translate-y-[-1px] md:translate-y-[-2px] ml-1">
                        / {totalCountries}
                      </span>
                    </p>
                    
                    <div className="mt-3 flex items-center justify-center w-full">
                      <div className="h-1.5 w-full bg-emerald-200/50 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-emerald-500 rounded-full" 
                          style={{ width: `${highScores[`${region}-${selectedTime}`].percentage}%` }}
                        ></div>
                      </div>
                      <span className="text-[10px] md:text-[11px] font-bold text-emerald-700 ml-2 min-w-[36px] text-right">
                        {highScores[`${region}-${selectedTime}`].percentage}%
                      </span>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 my-2 md:my-2 shrink-0">
                <span className="text-[12px] uppercase tracking-[1px] text-slate-500 font-bold text-center">{t.timeLimit}</span>
                <div className="grid grid-cols-3 gap-2">
                  {TIME_OPTIONS.map(timeOpt => (
                    <button
                      key={timeOpt.value}
                      onClick={() => setSelectedTime(timeOpt.value)}
                      className={cn(
                        "flex flex-col items-center justify-center p-2 border border-slate-200 bg-transparent rounded-lg cursor-pointer transition-all",
                        selectedTime === timeOpt.value 
                          ? "bg-slate-800 text-white border-slate-800 shadow-md transform scale-[1.02]" 
                          : "hover:bg-slate-100 text-slate-600 hover:text-slate-900 hover:border-slate-300"
                      )}
                    >
                      <span className="text-[13px] font-bold leading-tight">{t.times[timeOpt.id]}</span>
                      <span className={cn(
                        "text-[10px] font-medium opacity-80 mt-0.5",
                        selectedTime === timeOpt.value ? "text-slate-300" : "text-slate-500"
                      )}>{timeOpt.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2 mt-2 shrink-0">
                <button
                  onClick={startGame}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 text-white px-6 py-4 rounded font-bold hover:bg-slate-700 transition-colors uppercase tracking-wider text-sm"
                >
                  <Play className="w-4 h-4" />
                  {t.startGame}
                </button>
                <button
                  onClick={loadLeaderboard}
                  className="w-full flex items-center justify-center gap-2 bg-amber-50 text-amber-700 border border-amber-200 px-6 py-3 rounded font-bold hover:bg-amber-100 transition-colors uppercase tracking-wider text-xs"
                >
                  <Trophy className="w-4 h-4" />
                  {t.globalRanking}
                </button>
              </div>
            </div>
          )}
        </aside>

        <section className="flex-1 p-4 md:p-[40px] flex flex-col gap-6 md:gap-[30px] overflow-y-visible md:overflow-y-auto">
          {isPlaying && (
            <>
              <div className="relative w-full shrink-0 mt-2 md:mt-0 flex gap-2">
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isValidating}
                    placeholder={t.countryPlc}
                    className="w-full p-4 pr-14 text-xl md:p-[20px_24px] md:pr-[60px] md:text-[24px] border-2 border-slate-800 rounded-[8px] outline-none shadow-[4px_4px_0px_rgba(0,0,0,0.05)] md:shadow-[6px_6px_0px_rgba(0,0,0,0.05)] focus:shadow-[6px_6px_0px_rgba(0,0,0,0.1)] md:focus:shadow-[8px_8px_0px_rgba(0,0,0,0.1)] transition-shadow disabled:opacity-50 disabled:bg-slate-50"
                    autoComplete="off"
                    autoFocus
                  />
                  <button
                    onClick={toggleListening}
                    disabled={isValidating}
                    className={cn(
                      "absolute right-2 md:right-4 top-1/2 -translate-y-[15px] md:-translate-y-1/2 p-2 rounded-full transition-colors",
                      isListening ? "bg-red-100 text-red-500 animate-pulse" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                    )}
                  >
                    {isListening ? <Mic className="w-5 h-5 md:w-6 md:h-6" /> : <MicOff className="w-5 h-5 md:w-6 md:h-6" />}
                  </button>
                  {isValidating && (
                    <div className="absolute right-12 md:right-16 top-[28px] md:top-[34px] -translate-y-1/2 flex items-center gap-2 text-xs md:text-sm text-blue-600 font-bold">
                      <div className="w-3 h-3 md:w-4 md:h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="hidden md:inline">{t.validating}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="h-[20px] mb-2 text-center md:text-left shrink-0">
                  <AnimatePresence mode="wait">
                    {feedbackMsg && (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className={cn(
                          "text-[14px] font-semibold",
                          feedbackType === 'error' ? "text-red-500" : feedbackType === 'info' ? "text-amber-500" : "text-emerald-500"
                        )}
                      >
                        {feedbackMsg}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

              <div className="w-full h-[200px] md:h-[300px] shrink-0 border border-slate-100 rounded-lg overflow-hidden bg-white">
                <WorldMap foundCountries={foundCountries} region={region} mapStyle={gameSettings.mapStyle} />
              </div>
              
              <div className="flex justify-between items-center w-full mb-2 px-2">
                 <button
                    onClick={giveHint}
                    className="text-sm font-bold text-amber-500 hover:text-amber-600 flex items-center gap-1 transition-colors tracking-wider"
                  >
                    <Lightbulb size={16} />
                    {lang === 'es' ? 'Pedir Pista' : 'Get Hint'}
                  </button>

                 <button
                    onClick={endGame}
                    className="text-sm font-bold text-slate-400 hover:text-slate-800 flex items-center gap-1 transition-colors uppercase tracking-wider"
                  >
                    <Flag size={16} />
                    {t.giveUp}
                  </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[8px] md:gap-[10px] content-start flex-1 pb-10">
                {countries
                  .filter(c => region === 'Mundo' || c.regions.includes(region))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((country, index) => {
                    const isFound = foundCountries.includes(country.name);
                    return (
                      <div 
                        key={country.name}
                        className={cn(
                          "rounded-[4px] p-[10px_12px] text-[13px] font-medium flex items-center justify-between border",
                          isFound 
                            ? "bg-emerald-500 text-white border-emerald-500" 
                            : "bg-white border-dashed border-slate-200 text-slate-300"
                        )}
                      >
                        {isFound ? (lang === 'en' ? country.nameEn : country.name) : `${t.country} ${index + 1}`}
                        {isFound && (
                          <span className="w-[14px] h-[14px] bg-white rounded-full flex items-center justify-center text-emerald-500 text-[10px]">
                            ✓
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </>
          )}

          {isFinished && (
            <div className="flex flex-col h-full gap-[30px]">
              <div className="shrink-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="text-center md:text-left">
                  <h2 className="text-2xl md:text-3xl font-extrabold mb-1 md:mb-2 text-slate-800">{t.gameOver}</h2>
                  <p className="text-sm md:text-base text-slate-500 font-medium">{t.resultsFor} {t.regions[region]}</p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4 w-full md:w-auto">
                  {highScores[`${region}-${selectedTime}`] && highScores[`${region}-${selectedTime}`].score === foundCountries.length && foundCountries.length > 0 && (
                    <div className="px-4 py-2 bg-yellow-100 text-yellow-700 rounded-full font-bold text-xs md:text-sm border border-yellow-200">
                      {t.newHighScore}
                    </div>
                  )}
                  <div className="flex w-full sm:w-auto gap-2">
                    <button
                      onClick={loadLeaderboard}
                      className="flex items-center w-full sm:w-auto justify-center gap-2 bg-amber-100 text-amber-700 px-4 py-3 rounded font-bold hover:bg-amber-200 transition-colors tracking-wider text-sm"
                    >
                      <Trophy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={resetToConfig}
                      className="flex items-center w-full sm:w-auto justify-center gap-2 bg-slate-800 text-white px-6 py-3 rounded font-bold hover:bg-slate-700 transition-colors uppercase tracking-wider text-sm whitespace-nowrap"
                    >
                      <RotateCcw className="w-4 h-4" />
                      {t.retry}
                    </button>
                  </div>
                </div>
              </div>
              
              <div className="w-full h-[200px] md:h-[300px] shrink-0 border border-slate-100 rounded-lg overflow-hidden bg-white">
                <WorldMap foundCountries={foundCountries} region={region} mapStyle={gameSettings.mapStyle} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-[8px] md:gap-[10px] content-start flex-1 pb-10">
                {countries
                  .filter(c => region === 'Mundo' || c.regions.includes(region))
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((country) => {
                    const isFound = foundCountries.includes(country.name);
                    return (
                      <div 
                        key={country.name}
                        className={cn(
                          "rounded-[4px] p-[10px_12px] text-[13px] font-medium flex items-center justify-between border",
                          isFound 
                            ? "bg-emerald-500 text-white border-emerald-500" 
                            : "bg-red-50 text-red-500 border-red-200"
                        )}
                      >
                        {lang === 'en' ? country.nameEn : country.name}
                        {isFound ? (
                          <span className="w-[14px] h-[14px] bg-white rounded-full flex items-center justify-center text-emerald-500 text-[10px]">
                            ✓
                          </span>
                        ) : (
                          <span className="w-[14px] h-[14px] bg-red-100 rounded-full flex items-center justify-center text-red-500 text-[10px]">
                            ✕
                          </span>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {!isPlaying && !isFinished && (
            <div className="flex-1 flex flex-col justify-center items-center py-6 md:py-0">
              <div className="max-w-lg text-center mb-auto mt-12 md:mt-24">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-50 text-blue-600 rounded-full mb-6">
                  <Globe className="w-10 h-10" />
                </div>
                <h1 className="text-4xl font-extrabold tracking-tight text-slate-800 mb-4">
                  {t.heroTitle}
                </h1>
                <p className="text-lg text-slate-500 mb-8">
                  {t.heroDesc}
                </p>
              </div>
            </div>
          )}
        </section>
      </main>

      <AnimatePresence>
        {showLeaderboard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6 bg-slate-900/60 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 10 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 10 }}
              className="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="bg-slate-800 p-6 flex flex-col sm:flex-row sm:items-center justify-between shrink-0 gap-4">
                <div>
                  <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
                    <Trophy className="text-amber-400" />
                    {t.globalRanking}
                  </h2>
                  <p className="text-slate-300 text-sm mt-1">{t.regions[region]} • {t.times[TIME_OPTIONS.find(timeOpt => timeOpt.value === selectedTime)?.id || 'fast']}</p>
                </div>
                <div className="flex gap-2">
                  <div className="bg-slate-900 rounded-lg p-1 flex">
                    <button 
                      onClick={() => setLeaderboardMode('individual')}
                      className={cn("px-3 py-1.5 rounded-md text-sm font-semibold transition-colors", leaderboardMode === 'individual' ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white")}
                    >
                      Jugadores
                    </button>
                    <button 
                      onClick={() => setLeaderboardMode('countries')}
                      className={cn("px-3 py-1.5 rounded-md text-sm font-semibold transition-colors", leaderboardMode === 'countries' ? "bg-slate-700 text-white" : "text-slate-400 hover:text-white")}
                    >
                      Países
                    </button>
                  </div>
                  <button onClick={() => setShowLeaderboard(false)} className="text-slate-300 hover:text-white px-3 py-1.5 ml-2 rounded bg-white/10 hover:bg-white/20 transition-colors text-sm font-bold">
                    {t.close}
                  </button>
                </div>
              </div>
              
              <div className="flex-1 overflow-y-auto p-0 bg-white">
                {isLoadingLeaderboard ? (
                  <div className="flex items-center justify-center h-64">
                    <div className="w-8 h-8 rounded-full border-4 border-slate-200 border-t-blue-500 animate-spin"></div>
                  </div>
                ) : leaderboardMode === 'individual' ? (
                  leaderboardData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 p-8 text-center">
                      <Globe className="w-16 h-16 mb-4 opacity-50" />
                      <p className="text-lg font-medium">{t.noScores}</p>
                      <p className="text-sm">{t.loginFirst}</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 sticky top-0 z-10 outline outline-1 outline-slate-200">
                        <tr>
                          <th className="p-4 font-semibold text-slate-500 text-sm w-16 text-center">#</th>
                          <th className="p-4 font-semibold text-slate-500 text-sm">{t.player}</th>
                          <th className="p-4 font-semibold text-slate-500 text-sm text-right">{t.countries}</th>
                          <th className="p-4 font-semibold text-slate-500 text-sm text-right">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {leaderboardData.map((lb, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 text-center font-bold text-slate-400 text-sm">
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                {lb.photoURL ? (
                                  <img src={lb.photoURL} alt="avatar" className="w-8 h-8 rounded-full border border-slate-200" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold">
                                    {lb.displayName?.charAt(0) || '?'}
                                  </div>
                                )}
                                <span className="font-semibold text-slate-700">{lb.displayName || 'Anónimo'}</span>
                                {user && user.uid === lb.userId && (
                                  <span className="text-[10px] uppercase font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded ml-2">{t.you}</span>
                                )}
                                {lb.country && (
                                  <span className="text-[10px] uppercase font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">{lb.country}</span>
                                )}
                              </div>
                            </td>
                            <td className="p-4 text-right">
                              <span className="font-bold text-slate-800 text-lg">{lb.score}</span>
                              <span className="text-xs text-slate-400 ml-1">/ {lb.totalCount}</span>
                            </td>
                            <td className="p-4 text-right">
                              <span className="font-semibold text-emerald-600">{lb.percentage}%</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                ) : (
                  countryLeaderboardData.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-slate-400 p-8 text-center">
                      <Globe className="w-16 h-16 mb-4 opacity-50" />
                      <p className="text-lg font-medium">No hay puntajes de países aún</p>
                    </div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-slate-50 sticky top-0 z-10 outline outline-1 outline-slate-200">
                        <tr>
                          <th className="p-4 font-semibold text-slate-500 text-sm w-16 text-center">#</th>
                          <th className="p-4 font-semibold text-slate-500 text-sm">País</th>
                          <th className="p-4 font-semibold text-slate-500 text-sm text-right">Jugadores</th>
                          <th className="p-4 font-semibold text-slate-500 text-sm text-right">Puntaje Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {countryLeaderboardData.map((c, i) => (
                          <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 text-center font-bold text-slate-400 text-sm">
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                            </td>
                            <td className="p-4 font-semibold text-slate-700">{c.country}</td>
                            <td className="p-4 text-right font-medium text-slate-600">{c.playersCount || 0}</td>
                            <td className="p-4 text-right font-bold text-slate-800 text-lg">{c.totalScore}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden"
            >
              <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                  <LogIn className="w-5 h-5 text-blue-500" />
                  Iniciar Sesión
                </h3>
                <button
                  onClick={() => setShowLoginModal(false)}
                  className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6">
                <p className="text-sm text-slate-600 mb-4">
                  Ingresa un apodo para guardar tu puntaje en la tabla de posiciones.
                </p>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!loginNickname.trim()) return;
                    
                    const newUser = {
                      uid: crypto.randomUUID(),
                      displayName: loginNickname.trim(),
                      photoURL: '',
                      country: loginCountry
                    };
                    setUser(newUser);
                    localStorage.setItem('geochrono_user', JSON.stringify(newUser));
                    
                    // Sync any existing local high scores to Firebase
                    try {
                      const localScores = JSON.parse(localStorage.getItem('countryGameHighScores') || '{}');
                      const maxPerRegion: Record<string, number> = {};
                      Object.keys(localScores).forEach(key => {
                        const [reg, diffStr] = key.split('-');
                        const diff = parseInt(diffStr, 10);
                        const { score, percentage } = localScores[key];
                        
                        if (score > (maxPerRegion[reg] || 0)) {
                          maxPerRegion[reg] = score;
                        }

                        if (score > 0) {
                          const docId = `${newUser.uid}_${reg}_${diff}`;
                          setDoc(doc(db, "highScores", docId), {
                            userId: newUser.uid,
                            displayName: newUser.displayName,
                            photoURL: newUser.photoURL,
                            country: newUser.country || '',
                            region: reg,
                            difficulty: diff,
                            score,
                            totalCount: countries.filter(c => reg === 'Mundo' || c.regions.includes(reg as any)).length,
                            percentage,
                            updatedAt: serverTimestamp()
                          }).catch(() => {});
                        }
                      });
                      
                      Object.entries(maxPerRegion).forEach(([reg, maxScore]) => {
                        updateUserRegionMaxScore(newUser, maxScore, reg);
                      });
                    } catch (err) {
                      // ignore parse errors
                    }
                    
                    setShowLoginModal(false);
                    if (showLeaderboard) {
                      loadLeaderboard(); // refresh leaderboard if it's open
                    }
                  }}
                  className="flex flex-col gap-3"
                >
                  <input
                    type="text"
                    placeholder="Tu apodo"
                    value={loginNickname}
                    onChange={(e) => setLoginNickname(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                    maxLength={15}
                    required
                  />
                  <select
                    value={loginCountry}
                    onChange={(e) => setLoginCountry(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    {countries.slice().sort((a,b) => a.name.localeCompare(b.name)).map(c => (
                      <option key={c.name} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    disabled={!loginNickname.trim()}
                    className="w-full py-2.5 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Iniciar Sesión
                  </button>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showTutorial && (
          <TutorialModal onClose={() => setShowTutorial(false)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettings && (
          <SettingsModal 
            onClose={() => setShowSettings(false)} 
            lang={lang}
            setLang={setLang}
            gameSettings={gameSettings}
            updateGameSettings={updateGameSettings}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
