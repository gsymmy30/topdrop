'use client';

import { useState, useRef, useEffect } from 'react';
import { ListItem, Snapshot, GuessResult } from '@/types';

interface GuessLog {
  guess: string;
  result: GuessResult;
  timestamp: Date;
}

export default function Home() {
  const [category, setCategory] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [streamingItems, setStreamingItems] = useState<ListItem[]>([]);
  const [streamProgress, setStreamProgress] = useState(0);
  const [streamMessage, setStreamMessage] = useState('');
  const [guess, setGuess] = useState('');
  const [guessLog, setGuessLog] = useState<GuessLog[]>([]);
  const [checking, setChecking] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [useStreaming, setUseStreaming] = useState(true);
  const [error, setError] = useState<string>('');
  const [lastResult, setLastResult] = useState<{ found: boolean; points: number } | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (lastResult) {
      const timer = setTimeout(() => setLastResult(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastResult]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(''), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const generateListWithStreaming = async () => {
    if (!category.trim()) return;

    setLoading(true);
    setError('');
    setStreamingItems([]);
    setStreamProgress(0);
    setStreamMessage('Connecting to AI...');
    
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          category,
          itemCount: 50 
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error('Failed to start streaming');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let items: ListItem[] = [];

      if (!reader) throw new Error('No response body');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              
              if (parsed.type === 'start') {
                setStreamMessage(parsed.message);
              } else if (parsed.type === 'item') {
                items = [...items, parsed.item];
                setStreamingItems(items);
                setStreamProgress(parsed.progress || 0);
                setStreamMessage(`Loading item #${items.length}...`);
              } else if (parsed.type === 'complete') {
                setStreamMessage(parsed.message);
                
                const finalSnapshot: Snapshot = {
                  id: Math.random().toString(36).substring(7),
                  category,
                  items: items,
                  createdAt: new Date(),
                };
                
                await fetch('/api/snapshots', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ 
                    category,
                    items,
                    saveOnly: true 
                  }),
                });
                
                setSnapshot(finalSnapshot);
                setStreamingItems([]);
                setGuessLog([]);
                setShowAll(false);
              } else if (parsed.type === 'error') {
                throw new Error(parsed.message);
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        setError('Generation cancelled');
      } else {
        console.error('Streaming error:', error);
        setError(error.message || 'Failed to generate list');
      }
      setStreamingItems([]);
    } finally {
      setLoading(false);
      setStreamProgress(0);
      setStreamMessage('');
      abortControllerRef.current = null;
    }
  };

  const generateListClassic = async () => {
    if (!category.trim()) return;

    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/snapshots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          category,
          quickMode: true 
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate list');
      }
      
      console.log('Classic mode - Snapshot received:', data);
      console.log('Classic mode - Snapshot ID:', data.id);
      console.log('Classic mode - Items count:', data.items?.length);
      
      setSnapshot(data);
      setGuessLog([]);
      setShowAll(false);
      
      // Verify snapshot is stored
      fetch('/api/debug')
        .then(r => r.json())
        .then(debug => console.log('Snapshots in store:', debug));
        
    } catch (error: any) {
      console.error('Error:', error);
      setError(error.message || 'Failed to generate list');
    } finally {
      setLoading(false);
    }
  };

  const generateList = async () => {
    if (useStreaming) {
      await generateListWithStreaming();
    } else {
      await generateListClassic();
    }
  };

  const cancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  };

  const checkGuess = async () => {
    if (!guess.trim() || !snapshot) return;

    console.log('Checking guess with snapshot ID:', snapshot.id);
    setChecking(true);
    setError(''); // Clear any previous errors
    
    try {
      const response = await fetch('/api/check-guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          guess: guess.trim(), 
          snapshotId: snapshot.id 
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Ensure result has the expected structure
      if (typeof result.found === 'undefined') {
        throw new Error('Invalid response from server');
      }
      
      setGuessLog(prev => [{
        guess: guess.trim(),
        result,
        timestamp: new Date(),
      }, ...prev]);
      
      setLastResult({ found: result.found, points: result.points || 0 });
      setGuess('');
    } catch (error: any) {
      console.error('Error checking guess:', error);
      setError(`Failed to check guess: ${error.message}`);
    } finally {
      setChecking(false);
    }
  };

  const totalPoints = guessLog.reduce((sum, log) => sum + log.result.points, 0);
  const correctGuesses = guessLog.filter(log => log.result.found).length;
  const displayItems = streamingItems.length > 0 ? streamingItems : (snapshot?.items || []);

  const categoryExamples = [
    { emoji: '🎬', text: 'highest grossing movies' },
    { emoji: '🎮', text: 'best selling video games' },
    { emoji: '🏢', text: 'billionaire companies' },
    { emoji: '🎵', text: 'most streamed songs' },
    { emoji: '🌍', text: 'most visited countries' },
    { emoji: '📱', text: 'popular mobile apps' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Animated background pattern */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-purple-500/20 rounded-full blur-3xl animate-blob"></div>
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-pink-500/20 rounded-full blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-blue-500/20 rounded-full blur-3xl animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto p-6">
        {/* Header */}
        <header className="text-center mb-8 pt-4">
          <div className="inline-block">
            <h1 className="text-6xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-purple-400 to-indigo-400 animate-gradient">
              TOP DROP
            </h1>
            <div className="flex items-center justify-center gap-2 text-purple-300">
              <span className="text-sm font-medium tracking-wider uppercase">AI Trivia Party Game</span>
              <span className="animate-pulse">⚡</span>
            </div>
          </div>
        </header>

        {!snapshot && streamingItems.length === 0 ? (
          // Home Screen - Category Selection
          <div className="max-w-2xl mx-auto">
            <div className="bg-slate-800/50 backdrop-blur-xl rounded-3xl p-8 shadow-2xl border border-purple-500/20">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Create Your List</h2>
                <p className="text-purple-300">Choose a category for your Top 50 challenge</p>
              </div>

              <div className="space-y-6">
                <div className="relative">
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !loading && generateList()}
                    placeholder="Type any category..."
                    className="w-full px-6 py-4 text-lg bg-slate-900/50 rounded-2xl border-2 border-purple-500/30 text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-400 focus:shadow-lg focus:shadow-purple-500/25 transition-all"
                    disabled={loading}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-2xl">
                    🎯
                  </div>
                </div>

                {/* Category Suggestions */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {categoryExamples.map((example, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCategory(example.text)}
                      disabled={loading}
                      className="group relative overflow-hidden bg-gradient-to-br from-purple-600/20 to-pink-600/20 p-3 rounded-xl border border-purple-500/30 hover:border-purple-400/50 transition-all hover:scale-105 hover:shadow-lg hover:shadow-purple-500/25"
                    >
                      <div className="relative z-10 flex items-center gap-2">
                        <span className="text-2xl">{example.emoji}</span>
                        <span className="text-sm text-purple-200 group-hover:text-white transition-colors">
                          {example.text}
                        </span>
                      </div>
                      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/0 to-pink-500/0 group-hover:from-purple-500/20 group-hover:to-pink-500/20 transition-all"></div>
                    </button>
                  ))}
                </div>

                {/* Settings */}
                <div className="flex items-center justify-center gap-4 py-4">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={useStreaming}
                        onChange={(e) => setUseStreaming(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`w-12 h-6 rounded-full transition-colors ${
                        useStreaming ? 'bg-purple-500' : 'bg-slate-600'
                      }`}>
                        <div className={`w-5 h-5 bg-white rounded-full transition-transform ${
                          useStreaming ? 'translate-x-6' : 'translate-x-0.5'
                        } transform mt-0.5`}></div>
                      </div>
                    </div>
                    <span className="text-sm text-purple-300 group-hover:text-purple-200">
                      Live streaming mode
                    </span>
                  </label>
                </div>

                {error && (
                  <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
                    <p className="text-red-300 text-sm">{error}</p>
                  </div>
                )}

                {/* Generate Button */}
                <button
                  onClick={generateList}
                  disabled={loading || !category.trim()}
                  className="relative w-full group"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-pink-500 to-purple-500 rounded-2xl blur-lg group-hover:blur-xl transition-all opacity-70 group-hover:opacity-100"></div>
                  <div className="relative bg-gradient-to-r from-pink-500 to-purple-500 text-white font-bold py-4 px-8 rounded-2xl hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                    {loading ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>{useStreaming ? streamMessage : 'Generating list...'}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-lg">START GAME</span>
                        <span className="text-xl">🚀</span>
                      </div>
                    )}
                  </div>
                </button>

                {loading && useStreaming && (
                  <button
                    onClick={cancelGeneration}
                    className="w-full py-3 bg-slate-700/50 hover:bg-slate-700/70 text-slate-300 rounded-xl transition-all"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Game Screen
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Left Panel - Game Status */}
            <div className="lg:col-span-1 space-y-4">
              {/* Category & Score Card */}
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-purple-400 text-sm uppercase tracking-wider mb-1">Category</p>
                    <p className="text-white font-bold text-lg">{snapshot?.category || category}</p>
                  </div>
                  {!loading && (
                    <button
                      onClick={() => {
                        setSnapshot(null);
                        setCategory('');
                        setGuessLog([]);
                        setStreamingItems([]);
                        setLastResult(null);
                        setError('');
                      }}
                      className="px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-sm transition-all"
                    >
                      New Game
                    </button>
                  )}
                </div>

                {/* Score Display */}
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 rounded-xl p-4">
                    <p className="text-purple-300 text-xs uppercase tracking-wider mb-1">Points</p>
                    <p className="text-3xl font-black text-white">{totalPoints}</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 rounded-xl p-4">
                    <p className="text-blue-300 text-xs uppercase tracking-wider mb-1">Found</p>
                    <p className="text-3xl font-black text-white">{correctGuesses}/{displayItems.length}</p>
                  </div>
                </div>

                {/* Progress Bar */}
                {loading && useStreaming && (
                  <div className="mt-4">
                    <div className="flex justify-between text-xs text-purple-400 mb-1">
                      <span>Generating...</span>
                      <span>{streamProgress}%</span>
                    </div>
                    <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-300"
                        style={{ width: `${streamProgress}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Guess Input */}
              {snapshot && !loading && (
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
                  <p className="text-purple-400 text-sm uppercase tracking-wider mb-3">Your Guess</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={guess}
                      onChange={(e) => setGuess(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && checkGuess()}
                      placeholder="Enter your answer..."
                      className="flex-1 px-4 py-3 bg-slate-900/50 rounded-xl border border-purple-500/30 text-white placeholder-purple-400/50 focus:outline-none focus:border-purple-400 transition-all"
                      disabled={checking}
                    />
                    <button
                      onClick={checkGuess}
                      disabled={checking || !guess.trim()}
                      className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold rounded-xl hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50 transition-all"
                    >
                      GO
                    </button>
                  </div>

                  {/* Error Display */}
                  {error && (
                    <div className="mt-3 p-3 bg-red-500/20 border border-red-500/30 rounded-xl">
                      <p className="text-red-300 text-sm">{error}</p>
                    </div>
                  )}

                  {/* Result Feedback */}
                  {lastResult && !error && (
                    <div className={`mt-3 p-3 rounded-xl animate-slideIn ${
                      lastResult.found 
                        ? 'bg-green-500/20 border border-green-500/30' 
                        : 'bg-red-500/20 border border-red-500/30'
                    }`}>
                      <p className={`font-bold ${lastResult.found ? 'text-green-400' : 'text-red-400'}`}>
                        {lastResult.found ? `✅ Correct! +${lastResult.points} points` : '❌ Not on the list'}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Recent Guesses */}
              {snapshot && guessLog.length > 0 && (
                <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
                  <p className="text-purple-400 text-sm uppercase tracking-wider mb-3">Recent Guesses</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {guessLog.slice(0, 5).map((log, idx) => (
                      <div
                        key={idx}
                        className={`flex justify-between items-center p-2 rounded-lg ${
                          log.result.found 
                            ? 'bg-green-500/10' 
                            : 'bg-red-500/10'
                        }`}
                      >
                        <span className="text-white text-sm">{log.guess}</span>
                        <span className={`text-xs font-bold ${
                          log.result.found ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {log.result.found ? `#${log.result.item?.rank}` : 'MISS'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Main Panel - List Display */}
            <div className="lg:col-span-2">
              <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/20">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-2xl font-bold text-white">
                    {loading && useStreaming ? 'Loading Items...' : 'The List'}
                  </h3>
                  {!loading && snapshot && (
                    <button
                      onClick={() => setShowAll(!showAll)}
                      className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 rounded-lg text-sm transition-all"
                    >
                      {showAll ? 'Show Less' : `Show All (${displayItems.length})`}
                    </button>
                  )}
                </div>

                <div className="grid gap-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {(showAll ? displayItems : displayItems.slice(0, 15)).map((item, index) => {
                    const isGuessed = snapshot && guessLog.some(
                      log => log.result.found && log.result.item?.rank === item.rank
                    );
                    const isNew = loading && index === displayItems.length - 1;
                    
                    return (
                      <div
                        key={item.rank}
                        className={`relative group rounded-xl p-4 transition-all ${
                          isNew 
                            ? 'bg-gradient-to-r from-purple-500/30 to-pink-500/30 animate-slideIn'
                            : isGuessed
                            ? 'bg-green-500/20 border border-green-500/30'
                            : 'bg-slate-900/30 hover:bg-slate-900/50 border border-transparent hover:border-purple-500/30'
                        }`}
                      >
                        <div className="flex items-center gap-4">
                          <div className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center font-bold ${
                            isGuessed 
                              ? 'bg-green-500/30 text-green-400'
                              : 'bg-purple-500/20 text-purple-400'
                          }`}>
                            {item.rank}
                          </div>
                          <div className="flex-1">
                            <p className={`text-white font-medium ${isGuessed ? 'line-through opacity-60' : ''}`}>
                              {item.name}
                            </p>
                            {item.aliases && item.aliases.length > 0 && (
                              <p className="text-xs text-purple-400/60 mt-0.5">
                                aka: {item.aliases.join(', ')}
                              </p>
                            )}
                          </div>
                          {isGuessed && (
                            <div className="text-green-400">
                              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                          {isNew && (
                            <span className="text-xs text-yellow-400 font-bold animate-pulse">NEW!</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        @keyframes gradient {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradient 3s ease infinite;
        }
        .animate-slideIn {
          animation: slideIn 0.5s ease-out;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(147, 51, 234, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(147, 51, 234, 0.5);
        }
      `}</style>
    </div>
  );
}