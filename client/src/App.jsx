// (entire file — only small changes around the leaderboard rendering and the <style> block)
import React, { useState, useEffect, useRef, useMemo, useLayoutEffect } from "react";
import questions from "./questions.json";
import hcCards from "./hc_cards.json";
import discordIntegration from "./discord-integration.js";
import multiplayerService from "./multiplayer-service.js";

import marbleBg from "./assets/marblebg2.png";
import woodPanelBg from "./assets/sendresource_bg.png";
import btnNormal from "./assets/combobox_button_normal.png";
import btnHover from "./assets/combobox_button_hover.png";
import btnDisabled from "./assets/combobox_button_disabled.png";
import btnMainMenuDisabled from "./assets/button_mainmenu_disabled.png";

import nicknameBg from "./assets/uiskirmishnickname_textentry.png";
import nicknameBgOver from "./assets/uiskirmishnickname_textentry_over.png";
import dividingLine from "./assets/dividingline.png";

// NEW — medal assets (top 3)
import medalFirst from "./assets/award_03.png"; // first place (gold)
import medalSecond from "./assets/award_02.png"; // second place (silver)
import medalThird from "./assets/award_01.png"; // third place (bronve)

// NEW — Import sounds
import clickSoundFile from "./assets/bigbutton.wav";
import hoverSoundFile from "./assets/hoverobject_short.wav";

// Background music tracks (playlist)
import someOfAKindFile from "./assets/SomeOfAKind.mp3";
import revolootinFile from "./assets/Revolootin.mp3";
import kothFile from "./assets/KOTH.mp3";

// Music toggle icons
import soundOnIcon from "./assets/notification_sound_on.png";
import soundOffIcon from "./assets/notification_sound_off.png";

// REVEAL SOUND (we'll decode and play via WebAudio)
import revealSoundFile from "./assets/chatreceived.wav";

const MAX_TIME = 15;

// Expanded to 5 placeholder players for visual testing
const playersList = [
  { id: "player1", name: "You" },
  { id: "player2", name: "Mate" },
  { id: "player3", name: "Ally" },
  { id: "player4", name: "Alex" },
  { id: "player5", name: "Casey" },
];

// Volume/fade settings
const NORMAL_VOLUME = 0.6; // volume when question is active
const FADED_VOLUME = 0.08; // volume when question ended (faded down)
const FADE_DURATION = 800; // milliseconds

// Scoring config
const MAX_POINTS = 150; // points for an instant (maximum)
// Scoring shape: use a power curve f(x) = x^k where x = timeLeft / MAX_TIME in [0..1].
// When k > 1 the curve drops steeply when timeLeft falls a little from the maximum,
// then flattens out as time approaches 0 — this matches "steep at first, then less steep".
// Increase SCORING_EXPONENT to make the initial falloff steeper (e.g. 3). 
const SCORING_EXPONENT = 2;

// Helper: format numbers with commas (e.g. 1000 -> "1,000")
// Uses the user's locale; falls back to a safe numeric conversion.
const formatNumber = (n) => {
  if (n === null || n === undefined) return "0";
  const num = Number(n);
  if (Number.isNaN(num)) return String(n);
  return num.toLocaleString();
};

export default function App() {
  // Multiplayer state
  const [isMultiplayerMode, setIsMultiplayerMode] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [players, setPlayers] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isHost, setIsHost] = useState(false);

  // Game state
  const [availableQuestions, setAvailableQuestions] = useState([...questions]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selections, setSelections] = useState({});
  const [timeLeft, setTimeLeft] = useState(MAX_TIME);
  const [showResult, setShowResult] = useState(false);
  const [scores, setScores] = useState({});

  // For card-mode: input state and last attempt feedback
  const [cardInput, setCardInput] = useState("");
  const [cardLastWrong, setCardLastWrong] = useState(false);

  // Animated display scores (counts up when underlying `scores` changes)
  const [displayScores, setDisplayScores] = useState({});
  const displayScoresRef = useRef(displayScores);
  useEffect(() => {
    displayScoresRef.current = displayScores;
  }, [displayScores]);

  // whether music is toggled on (user-visible setting)
  const [musicEnabled, setMusicEnabled] = useState(true);

  const timerRef = useRef(null);

  // Track whether awarding has been performed for the current question
  const awardedDoneRef = useRef(false);

  // Record per-player answer-time (timeLeft at moment of click)
  // shape: { playerId: number (timeLeftAtClick), ... }
  const answerTimesRef = useRef({});

  // NEW — Audio refs
  const clickSound = useRef(new Audio(clickSoundFile));
  const hoverSound = useRef(new Audio(hoverSoundFile));

  // WEB AUDIO for reveal sound
  const audioCtxRef = useRef(null);
  const revealBufferRef = useRef(null);
  const audioUnlockedRef = useRef(false); // whether audio context has been resumed
  const pendingRevealRef = useRef(false); // if reveal should play when context resumes

  // Playlist audio refs
  const bg = useRef({
    tracks: [], // array of Audio objects in playlist order
  });

  // index of currently playing track in bg.current.tracks
  const currentIndexRef = useRef(0);

  // single fade timer for current audio
  const fadeTimerRef = useRef(null);

  // For animation (FLIP) of leaderboard
  // We store the previous bounding rects so we can compute deltas when order changes
  const prevRectsRef = useRef({});

  // Animation frames refs for the score count animations so we can cancel if needed
  const scoreAnimFramesRef = useRef({});

  // small highlight state for when score bumps (used to add a temporary CSS class)
  const [scoreHighlight, setScoreHighlight] = useState({});

  // Initialize Discord integration and multiplayer
  useEffect(() => {
    const initializeGame = async () => {
      try {
        // Check if we're in Discord's embedded app environment
        const isDiscordEmbedded = window.location.href.includes('discord.com') || 
                                 window.parent !== window ||
                                 window.location.search.includes('discord');
        
        console.log('Environment check:', {
          isDiscordEmbedded,
          url: window.location.href,
          parent: window.parent !== window
        });
        
        // Try to initialize Discord integration
        const discordInitialized = await discordIntegration.initialize();
        
        if (discordInitialized) {
          console.log('Discord integration successful, switching to multiplayer mode');
          setIsMultiplayerMode(true);
          const user = await discordIntegration.getCurrentUser();
          console.log('Current Discord user:', user);
          setCurrentUser(user);
          
          // Initialize multiplayer service
          const multiplayerInitialized = await multiplayerService.initialize();
          if (multiplayerInitialized) {
            setIsConnected(true);
            
            // Set up multiplayer event handlers
            multiplayerService.onConnect = () => {
              setIsConnected(true);
              console.log('Connected to multiplayer server');
            };
            
            multiplayerService.onDisconnect = () => {
              setIsConnected(false);
              console.log('Disconnected from multiplayer server');
            };
            
            multiplayerService.onRoomStateUpdate = (data) => {
              setPlayers(data.players || []);
              setScores(data.scores || {});
              
              // Update Discord activity
              const activity = discordIntegration.formatActivityForDiscord({
                currentQuestion,
                scores: data.scores,
                players: data.players,
                timeLeft
              });
              discordIntegration.setActivity(activity);
            };
            
            multiplayerService.onQuestionStart = (data) => {
              setCurrentQuestion(data.question);
              setSelections({});
              setShowResult(false);
              setTimeLeft(data.maxTime || MAX_TIME);
              setCardInput("");
              setCardLastWrong(false);
              awardedDoneRef.current = false;
              answerTimesRef.current = {};
              
              // Update Discord activity
              const activity = discordIntegration.formatActivityForDiscord({
                currentQuestion: data.question,
                scores,
                players,
                timeLeft: data.maxTime || MAX_TIME
              });
              discordIntegration.setActivity(activity);
            };
            
            multiplayerService.onShowResult = (data) => {
              setShowResult(true);
              setScores(data.scores || {});
              
              // Update Discord activity
              const activity = discordIntegration.formatActivityForDiscord({
                currentQuestion: null,
                scores: data.scores,
                players
              });
              discordIntegration.setActivity(activity);
            };
            
            // Check if this user is the host (first to join)
            const roomState = multiplayerService.getCurrentState();
            setIsHost(roomState.players.length === 1);
            
          } else {
            console.warn('Failed to initialize multiplayer, but Discord user is available');
            // Even if multiplayer fails, we can show the Discord user
            setPlayers([user]); // Show the Discord user in the list
            setIsMultiplayerMode(false);
          }
        } else {
          console.log('Discord SDK not available, running in local mode');
          setIsMultiplayerMode(false);
          // Initialize local game
          pickAndSetRandomQuestion();
        }
      } catch (error) {
        console.error('Failed to initialize game:', error);
        setIsMultiplayerMode(false);
        // Initialize local game as fallback
        pickAndSetRandomQuestion();
      }
    };

    initializeGame();

    // Cleanup on unmount
    return () => {
      if (isMultiplayerMode) {
        multiplayerService.disconnect();
        discordIntegration.clearActivity();
      }
    };
  }, []);

  // helper: fade an audio element to target volume over duration (single timer)
  const fadeTo = (audio, targetVolume, duration = FADE_DURATION) => {
    if (!audio) return;
    if (fadeTimerRef.current) {
      clearInterval(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }

    const intervalMs = 50;
    const steps = Math.max(1, Math.floor(duration / intervalMs));
    const start = Number(audio.volume) || 0;
    const delta = targetVolume - start;
    let step = 0;

    fadeTimerRef.current = setInterval(() => {
      step++;
      const fraction = step / steps;
      const newVol = Math.max(0, Math.min(1, start + delta * fraction));
      audio.volume = newVol;
      if (step >= steps) {
        clearInterval(fadeTimerRef.current);
        fadeTimerRef.current = null;
        audio.volume = Math.max(0, Math.min(1, targetVolume)); // final exact value
      }
    }, intervalMs);
  };

  // helper: pause all tracks
  const pauseAllTracks = () => {
    bg.current.tracks.forEach((t) => {
      try {
        t.pause();
      } catch (e) {}
    });
  };

  // play the track at given index (pauses others)
  const playTrackAt = (index) => {
    const tracks = bg.current.tracks;
    if (!tracks || tracks.length === 0) return;
    index = ((index % tracks.length) + tracks.length) % tracks.length;
    currentIndexRef.current = index;

    // pause other tracks
    tracks.forEach((t, i) => {
      if (!t) return;
      if (i !== index) {
        try {
          t.pause();
          // don't reset currentTime — we want tracks to play full when they come up again
        } catch (e) {}
      }
    });

    const current = tracks[index];
    if (!current) return;

    // set appropriate volume depending on showResult
    current.volume = showResult ? FADED_VOLUME : NORMAL_VOLUME;

    const p = current.play();
    if (p && typeof p.catch === "function") {
      p.catch((err) => {
        console.warn("playTrackAt play() rejected:", err);
      });
    }
  };

  // Initialize playlist audios on mount AND create AudioContext + decode reveal sound
  useEffect(() => {
    // create playlist audios
    try {
      const files = [someOfAKindFile, revolootinFile, kothFile];
      const created = files.map((f, i) => {
        const a = new Audio(f);
        a.preload = "auto";
        a.loop = false; // we'll chain via 'ended' to go to next track
        a.volume = NORMAL_VOLUME;
        a.crossOrigin = "anonymous";

        // ended: advance to next track and play it
        const onEnded = () => {
          const next = (currentIndexRef.current + 1) % files.length;
          currentIndexRef.current = next;
          // only auto-advance/play if music is enabled
          if (musicEnabled) playTrackAt(next);
        };

        // attach listener
        a.addEventListener("ended", onEnded);
        a._onEnded = onEnded;

        return a;
      });

      bg.current.tracks = created;
    } catch (err) {
      console.error("Error creating playlist audios:", err);
    }

    // create audio context and decode reveal sound
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = new AudioCtx();

      // fetch the revealSoundFile (import gives a URL) and decode
      (async () => {
        try {
          const resp = await fetch(revealSoundFile);
          const arrayBuffer = await resp.arrayBuffer();
          const decoded = await audioCtxRef.current.decodeAudioData(arrayBuffer);
          revealBufferRef.current = decoded;
        } catch (err) {
          console.warn("Failed to load/decode reveal sound:", err);
        }
      })();
    } catch (e) {
      console.warn("WebAudio not available:", e);
    }

    // cleanup on unmount: remove listeners, pause and free
    return () => {
      if (fadeTimerRef.current) {
        clearInterval(fadeTimerRef.current);
      }
      bg.current.tracks.forEach((a) => {
        if (a._onEnded) a.removeEventListener("ended", a._onEnded);
        a.pause();
        a.src = "";
      });
    };
  }, []);

  // helper: unlock/resume the audio context on user gesture and play any pending reveal
  const unlockAudioContext = async () => {
    const ctx = audioCtxRef.current;
    if (!ctx) return;
    try {
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      audioUnlockedRef.current = true;
      // if reveal was pending, play it now
      if (pendingRevealRef.current && revealBufferRef.current) {
        playRevealBuffer();
        pendingRevealRef.current = false;
      }
    } catch (e) {
      // ignore
    }
  };

  // one-time pointerdown unlock attempt (in case user interacts somewhere else)
  useEffect(() => {
    const handler = () => {
      unlockAudioContext();
      window.removeEventListener("pointerdown", handler);
    };
    window.addEventListener("pointerdown", handler, { once: true });
    return () => window.removeEventListener("pointerdown", handler);
  }, []);

  // play reveal buffer via Web Audio
  const playRevealBuffer = () => {
    const ctx = audioCtxRef.current;
    const buffer = revealBufferRef.current;
    if (!ctx || !buffer) return;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.value = 1.0; // tweak if too loud
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(0);
      // no need to keep a reference — it will close after playback
    } catch (e) {
      console.warn("Failed to play reveal buffer:", e);
    }
  };

  // function that attempts to play the current track (must be called from a user gesture to satisfy autoplay)
  const startBackgroundMusic = () => {
    if (!musicEnabled) return;
    const tracks = bg.current.tracks;
    if (!tracks || tracks.length === 0) {
      console.warn("Playlist not ready yet.");
      return;
    }

    // ensure AudioContext is unlocked/resumed as well (so reveal sound will work later)
    unlockAudioContext();

    // attempt to play the track at current index
    const indexToPlay = currentIndexRef.current || 0;
    try {
      playTrackAt(indexToPlay);
      console.log("Background playlist started at index", indexToPlay);
    } catch (err) {
      console.warn("startBackgroundMusic: play failed:", err);
    }
  };

  // Attach one-time pointerdown to start music on first user gesture (only if musicEnabled)
  useEffect(() => {
    const tryAutoStart = () => {
      if (musicEnabled) startBackgroundMusic();
      window.removeEventListener("pointerdown", tryAutoStart);
    };
    window.addEventListener("pointerdown", tryAutoStart, { once: true });
    return () => window.removeEventListener("pointerdown", tryAutoStart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicEnabled]);

  // When showResult changes, fade the currently-playing track down/up (only if music enabled)
  // and play the reveal sound once (via WebAudio) when results are shown.
  useEffect(() => {
    if (showResult) {
      // attempt to play via WebAudio
      if (audioUnlockedRef.current && revealBufferRef.current) {
        playRevealBuffer();
      } else {
        // can't play now — mark pending to play once context is unlocked
        pendingRevealRef.current = true;
      }
    }

    if (!musicEnabled) return;
    const tracks = bg.current.tracks;
    if (!tracks || tracks.length === 0) return;
    const current = tracks[currentIndexRef.current] || tracks[0];
    if (!current) return;

    if (showResult) {
      fadeTo(current, FADED_VOLUME, FADE_DURATION);
    } else {
      // try resume if paused
      current
        .play()
        .catch(() => {
          /* ignore */
        })
        .finally(() => {
          fadeTo(current, NORMAL_VOLUME, FADE_DURATION);
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResult, musicEnabled]);

  // toggle music on/off handler
  const toggleMusic = (e) => {
    e.stopPropagation();
    const newValue = !musicEnabled;
    setMusicEnabled(newValue);

    if (newValue) {
      // user turned music ON — this click is a user gesture so play() should be allowed
      startBackgroundMusic();
    } else {
      // user turned music OFF — pause immediately
      try {
        pauseAllTracks();
      } catch (err) {}
      // clear fade timer if any
      if (fadeTimerRef.current) {
        clearInterval(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
    }
  };

  const playClickSound = () => {
    // attempt to start background music if enabled (user gesture)
    if (musicEnabled) startBackgroundMusic();

    // unlocking audio context on any user click will also flush pending reveal sounds
    unlockAudioContext();

    clickSound.current.currentTime = 0;
    clickSound.current.play().catch(() => {});
  };

  const playHoverSound = () => {
    hoverSound.current.currentTime = 0;
    hoverSound.current.play().catch(() => {});
  };

  const pickAndSetRandomQuestion = () => {
    // Only for local mode - multiplayer mode uses server questions
    if (isMultiplayerMode) return;

    // 30% chance to pick a HC card "guess the card" style question
    const pickCard = Math.random() < 0.3 && Object.keys(hcCards).length > 0;

    if (pickCard) {
      const keys = Object.keys(hcCards);
      const idx = Math.floor(Math.random() * keys.length);
      const name = keys[idx];
      const url = hcCards[name];

      setCurrentQuestion({ isCard: true, cardName: name, cardUrl: url });
      setSelections({});
      setShowResult(false);
      setTimeLeft(MAX_TIME);
      setCardInput("");
      setCardLastWrong(false);

      // reset per-question tracking
      answerTimesRef.current = {};
      awardedDoneRef.current = false;
      return;
    }

    // Otherwise pick trivia as before
    if (availableQuestions.length === 0) {
      setCurrentQuestion(null);
      return;
    }
    const index = Math.floor(Math.random() * availableQuestions.length);
    const q = availableQuestions[index];
    setAvailableQuestions((prev) => prev.filter((_, i) => i !== index));
    setCurrentQuestion(q);
    setSelections({});
    setShowResult(false);
    setTimeLeft(MAX_TIME);

    // reset per-question tracking
    answerTimesRef.current = {};
    awardedDoneRef.current = false;
  };

  const startMultiplayerGame = () => {
    if (isMultiplayerMode && isHost) {
      multiplayerService.startGame();
    }
  };

  useEffect(() => {
    pickAndSetRandomQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentQuestion) return;
    if (showResult) return;

    setTimeLeft(MAX_TIME);
    clearInterval(timerRef.current);

    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          setShowResult(true);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, [currentQuestion, showResult]);

  const myPlayerId = "player1";

  const isCardMode = currentQuestion ? !!currentQuestion.isCard : false;

  const correctLetter = !isCardMode && currentQuestion ? currentQuestion.answer : null;
  const correctIndex = !isCardMode && currentQuestion
    ? currentQuestion.options.findIndex((opt) => opt.startsWith(correctLetter))
    : -1;

  // Updated: do NOT award at click. Instead, record the timeLeft at click for later scoring.
  const onSelectOption = (playerId, optionIndex) => {
    if (showResult) return;
    if (selections[playerId] !== undefined) return;

    if (isMultiplayerMode) {
      // Send selection to server
      multiplayerService.selectOption(optionIndex);
    } else {
      // Local mode logic
      const clickedTimeLeft = timeLeft;

      setSelections((prev) => {
        const newSelections = { ...prev, [playerId]: optionIndex };

        answerTimesRef.current = {
          ...answerTimesRef.current,
          [playerId]: clickedTimeLeft,
        };

        // If everybody has now answered, stop the timer and reveal results
        if (Object.keys(newSelections).length === playersList.length) {
          clearInterval(timerRef.current);
          setShowResult(true);
        }

        return newSelections;
      });
    }

    // unlock audio context & maybe start music because this was a user gesture
    if (musicEnabled) startBackgroundMusic();
    unlockAudioContext();
    playClickSound();
  };

  // New: submit typed answer for card questions (player can keep trying until time runs out)
  const onSubmitCardAnswer = (playerId, text) => {
    if (showResult) return;
    if (!isCardMode) return;
    if (selections[playerId] !== undefined) return; // already answered correctly

    const attempt = (text || cardInput || "").trim();
    if (!attempt) return;

    // Normalize comparison: case-insensitive, trim
    const expected = (currentQuestion.cardName || "").trim().toLowerCase();
    const given = attempt.toLowerCase();

    if (given === expected) {
      // correct!
      const clickedTimeLeft = timeLeft;

      answerTimesRef.current = {
        ...answerTimesRef.current,
        [playerId]: clickedTimeLeft,
      };

      setSelections((prev) => ({ ...prev, [playerId]: true }));
      setCardLastWrong(false);
      // don't reveal immediately — follow the same reveal rules (either everyone or timer)

      // play click to reward the user feel
      playClickSound();

      // Optionally clear input or keep it; we'll keep it for context and disable further typing
      // setCardInput(attempt);

      // If every player has now answered (unlikely for multi players in card-mode), reveal
      const answeredCount = Object.keys({ ...selections, [playerId]: true }).length;
      if (answeredCount === playersList.length) {
        clearInterval(timerRef.current);
        setShowResult(true);
      }
    } else {
      // wrong — allow keep trying until timer runs out
      setCardLastWrong(true);
      // small audio cue
      playHoverSound();
    }
  };

  // Award points once when results are revealed. Use the stored answer times.
  useEffect(() => {
    if (!showResult) return;
    if (awardedDoneRef.current) return; // guard — only award once per question

    // calculate and award points
    setScores((prevScores) => {
      const newScores = { ...prevScores };

      const computePointsFromTime = (time) => {
        if (!time || time <= 0) return 0;
        const x = Math.max(0, Math.min(1, time / MAX_TIME)); // normalized [0..1]
        const raw = MAX_POINTS * Math.pow(x, SCORING_EXPONENT);
        return Math.round(raw);
      };

      if (isCardMode) {
        // award points to any player who answered correctly (selections[playerId] === true)
        playersList.forEach(({ id }) => {
          if (selections[id] === true) {
            const timeAtAnswer = answerTimesRef.current[id];
            const points = timeAtAnswer ? computePointsFromTime(timeAtAnswer) : 0;
            newScores[id] = (newScores[id] || 0) + points;
          }
        });
      } else {
        // trivia mode (existing logic)
        playersList.forEach(({ id }) => {
          // only award if the player's selection was correct
          if (selections[id] === correctIndex) {
            const timeAtAnswer = answerTimesRef.current[id];
            const points = timeAtAnswer ? computePointsFromTime(timeAtAnswer) : 0;
            newScores[id] = (newScores[id] || 0) + points;
          }
        });
      }

      return newScores;
    });

    // mark awarding done for this question so effect won't re-run awarding
    awardedDoneRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showResult]);

  const onNextQuestion = () => {
    if (isMultiplayerMode) {
      // In multiplayer, the server handles next questions
      if (isHost) {
        multiplayerService.startGame();
      }
    } else {
      pickAndSetRandomQuestion();
    }
  };

  // Audio functions (duplicates removed)

  // Build a sorted leaderboard from scores
  const sortedPlayers = useMemo(() => {
    if (isMultiplayerMode) {
      // Use actual players from multiplayer
      return players
        .map((p) => ({
          id: p.id,
          name: p.name,
          score: scores[p.id] || 0,
          isCurrentUser: currentUser && p.id === currentUser.id
        }))
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.name.localeCompare(b.name);
        });
    } else {
      // Local mode - use placeholder players
      return playersList
        .map((p) => ({ ...p, score: scores[p.id] || 0 }))
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.name.localeCompare(b.name);
        });
    }
  }, [scores, players, isMultiplayerMode, currentUser]);

  // helper to get medal asset for top-3 ranks
  const getMedalForRank = (rankIdx) => {
    if (rankIdx === 0) return medalFirst;
    if (rankIdx === 1) return medalSecond;
    if (rankIdx === 2) return medalThird;
    return null;
  };

  // FLIP animation using layout measurements — triggers whenever sortedPlayers changes.
  useLayoutEffect(() => {
    // Capture new positions
    const newRects = {};
    sortedPlayers.forEach((p) => {
      // there may be multiple leaderboard renderings; pick the first occurrence to measure
      const el = document.querySelector(`[data-player-id="${p.id}"]`);
      if (el) newRects[p.id] = el.getBoundingClientRect();
    });

    const prevRects = prevRectsRef.current || {};

    // For each player that existed before and still exists now, compute delta
    sortedPlayers.forEach((p) => {
      const prev = prevRects[p.id];
      const next = newRects[p.id];
      if (!prev || !next) return;
      const deltaY = prev.top - next.top;
      if (!deltaY) return; // no movement

      // Apply transform to all occurrences of this player's row (handles multiple leaderboards)
      const els = document.querySelectorAll(`[data-player-id="${p.id}"]`);
      els.forEach((el) => {
        // set up initial transform to visually place it where it was
        el.style.transition = "none";
        el.style.transform = `translateY(${deltaY}px)`;
        el.style.willChange = "transform";
      });

      // Force a reflow so the browser acknowledges the transform, then animate to 0
      requestAnimationFrame(() => {
        els.forEach((el) => {
          // start animation
          el.style.transition = "transform 480ms cubic-bezier(0.2, 0.8, 0.2, 1)";
          el.style.transform = ""; // animate to natural position
        });
      });

      // After animation, clean up inline styles (optional)
      setTimeout(() => {
        els.forEach((el) => {
          el.style.transition = "";
          el.style.willChange = "";
        });
      }, 520);
    });

    // Save the newRects for the next run
    prevRectsRef.current = newRects;
  }, [sortedPlayers]);

  // Animate displayScores when scores change (count up)
  useEffect(() => {
    const duration = 600; // ms for the count animation

    Object.keys(scores).forEach((id) => {
      const start = displayScoresRef.current[id] || 0;
      const end = scores[id] || 0;
      if (start === end) return;

      // cancel any previous frame for this id
      if (scoreAnimFramesRef.current[id]) {
        cancelAnimationFrame(scoreAnimFramesRef.current[id]);
        scoreAnimFramesRef.current[id] = null;
      }

      const startTime = performance.now();

      const step = (now) => {
        const t = Math.min(1, (now - startTime) / duration);
        const value = Math.round(start + (end - start) * t);
        setDisplayScores((prev) => {
          if (prev[id] === value) return prev;
          return { ...prev, [id]: value };
        });

        if (t < 1) {
          scoreAnimFramesRef.current[id] = requestAnimationFrame(step);
        } else {
          scoreAnimFramesRef.current[id] = null;
          // briefly highlight increases
          if (end > start) {
            setScoreHighlight((h) => ({ ...h, [id]: true }));
            setTimeout(() => {
              setScoreHighlight((h) => {
                const copy = { ...h };
                delete copy[id];
                return copy;
              });
            }, 700);
          }
        }
      };

      scoreAnimFramesRef.current[id] = requestAnimationFrame(step);
    });

    // cleanup on unmount or scores change
    return () => {
      Object.values(scoreAnimFramesRef.current).forEach((f) => {
        if (f) cancelAnimationFrame(f);
      });
      scoreAnimFramesRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores]);

  // Completed screen
  if (!currentQuestion) {
    return (
      <div
        className="app-container"
        style={{
          backgroundImage: `url(${marbleBg})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          height: "100vh",
          width: "100vw",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          padding: 20,
          boxSizing: "border-box",
        }}
      >
        {/* Leaderboard sidebar (still visible on completion) */}
        <aside className="leaderboard-container" aria-label="Leaderboard">
          <div className="leaderboard-title">Leaderboard</div>
          <ol className="leaderboard-list">
            {sortedPlayers.map((p, idx) => {
              const medal = getMedalForRank(idx);
              return (
                <li
                  key={p.id}
                  data-player-id={p.id}
                  className={`leaderboard-item ${p.id === myPlayerId ? "you" : ""} rank-${idx + 1}`}
                  aria-label={`${p.name} score ${p.score}`}
                >
                  {/* NEW: inner wrapper so FLIP's translate transforms on <li> do not override scale */}
                  <div className="leaderboard-row">
                    {medal ? (
                      <img
                        src={medal}
                        alt={`#${idx + 1} medal`}
                        // sizes controlled by CSS below to keep adjustments centralized
                      />
                    ) : (
                      <span className="leaderboard-rank">{idx + 1}</span>
                    )}
                    <span className="leaderboard-name">{p.name}</span>
                    <span className={`leaderboard-score ${scoreHighlight[p.id] ? "score-bump" : ""}`}>
                      {formatNumber(displayScores[p.id] ?? 0)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        </aside>

        <div
          className="wood-panel"
          style={{
            backgroundImage: `url(${woodPanelBg})`,
            backgroundSize: "contain",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
            padding: 60,
            boxSizing: "border-box",
            width: 850,
            maxWidth: "95vw",
            minHeight: 600,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            overflow: "hidden",
            color: "white",
            textShadow: "0 1px 2px rgba(0,0,0,0.8)",
          }}
        >
          <h1 className="title">Quiz Completed!</h1>
          <button
            className="restart-button"
            onMouseEnter={playHoverSound}
            onClick={() => {
              playClickSound();
              setAvailableQuestions([...questions]);
              setScores(
                playersList.reduce((acc, p) => {
                  acc[p.id] = 0;
                  return acc;
                }, {})
              );
              // reset per-question tracking
              answerTimesRef.current = {};
              awardedDoneRef.current = false;
              pickAndSetRandomQuestion();
            }}
          >
            Restart Quiz
          </button>
        </div>
      </div>
    );
  }

  // Main quiz UI
  return (
    <div
      className="app-container"
      style={{
        backgroundImage: `url(${marbleBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      {/* Multiplayer Status */}
      {isMultiplayerMode && (
        <div
          style={{
            position: "absolute",
            top: 20,
            left: 20,
            background: "rgba(0,0,0,0.7)",
            padding: "8px 16px",
            borderRadius: 8,
            color: "white",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: isConnected ? "#4CAF50" : "#f44336",
            }}
          />
          {isConnected ? "Connected" : "Disconnected"}
          {isHost && " (Host)"}
        </div>
      )}

      {/* Leaderboard sidebar */}
      <aside className="leaderboard-container" aria-label="Leaderboard">
        <div className="leaderboard-title">Leaderboard</div>
        <ol className="leaderboard-list">
          {sortedPlayers.map((p, idx) => {
            const medal = getMedalForRank(idx);
            return (
              <li
                key={p.id}
                data-player-id={p.id}
                className={`leaderboard-item ${p.id === myPlayerId ? "you" : ""} rank-${idx + 1}`}
                aria-label={`${p.name} score ${p.score}`}
              >
                {/* NEW: inner wrapper so FLIP's translate transforms on <li> do not override scale */}
                <div className="leaderboard-row">
                  {medal ? (
                    <img
                      src={medal}
                      alt={`#${idx + 1} medal`}
                      // sizes controlled by CSS below to keep adjustments centralized
                    />
                  ) : (
                    <span className="leaderboard-rank">{idx + 1}</span>
                  )}
                  <span className="leaderboard-name">{p.name}</span>
                  <span className={`leaderboard-score ${scoreHighlight[p.id] ? "score-bump" : ""}`}>
                    {formatNumber(displayScores[p.id] ?? 0)}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
      </aside>

      {/* Music toggle button (always visible) */}
      <div style={{ position: "fixed", top: 12, right: 12, zIndex: 999 }}>
        <button
          onClick={toggleMusic}
          onMouseEnter={() => {
            // don't play hover sound for this toggle to avoid accidental audio starts
          }}
          style={{
            width: 44,
            height: 44,
            padding: 6,
            borderRadius: 8,
            border: "none",
            background: "transparent",
            cursor: "pointer",
          }}
          aria-label={musicEnabled ? "Turn music off" : "Turn music on"}
          title={musicEnabled ? "Music On (click to mute)" : "Music Off (click to enable)"}
        >
          <img
            src={musicEnabled ? soundOnIcon : soundOffIcon}
            alt={musicEnabled ? "music on" : "music off"}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </button>
      </div>

      <div
        className="wood-panel"
        style={{
          backgroundImage: `url(${woodPanelBg})`,
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          padding: 60,
          boxSizing: "border-box",
          width: 850,
          maxWidth: "95vw",
          minHeight: 600,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          overflow: "hidden",
          color: "white",
          textShadow: "0 1px 2px rgba(0,0,0,0.8)",
        }}
      >
        <h1 className="title">Age of Empires III Trivia!</h1>
        {isMultiplayerMode && !currentQuestion && isHost && (
          <button
            style={{
              background: "linear-gradient(135deg, #4CAF50, #45a049)",
              border: "none",
              borderRadius: 8,
              color: "white",
              padding: "12px 24px",
              fontSize: "16px",
              fontWeight: "bold",
              cursor: "pointer",
              marginTop: 20,
              boxShadow: "0 4px 8px rgba(0,0,0,0.3)",
            }}
            onClick={startMultiplayerGame}
          >
            Start Game
          </button>
        )}
        <img
          src={dividingLine}
          alt=""
          className="divider-line"
          style={{
            display: "block",
            width: 600,
            maxWidth: "100%",
            height: "auto",
            pointerEvents: "none",
            userSelect: "none",
            transform: "translateY(-15px)"
          }}
        />

        <p className="timer">Time Left: {timeLeft}s</p>

        {/* Render differently when this question is a card-guess */}
        {isCardMode ? (
          <>
            <h2 className="question">What HC card is this?</h2>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              {/* image wrapper (position:relative) so overlay can be placed over the image */}
              <div style={{ position: "relative", width: 160, height: 160 }}>
                <img
                  src={currentQuestion.cardUrl}
                  alt="HC card"
                  style={{ width: "100%", height: "100%", objectFit: "contain", borderRadius: 8, boxShadow: "0 6px 18px rgba(0,0,0,0.6)" }}
                />

                {/* Overlayed correct answer (center bottom) — slightly transparent background for legibility */}
                {showResult && (
                  <div
                    style={{
                      position: "absolute",
                      left: "50%",
                      bottom: 8,
                      transform: "translateX(-50%)",
                      background: "rgba(0, 0, 0, 0.6)",
                      padding: "8px 10px",
                      borderRadius: 6,
                      color: "#ffd",
                      textAlign: "center",
                      maxWidth: "92%",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
                      pointerEvents: "none",
                      fontSize: "0.77rem",
                      width: "75%",
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>Correct Answer: {currentQuestion.cardName}</div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input
                  className="card-input"
                  value={cardInput}
                  onChange={(e) => {
                    setCardInput(e.target.value);
                    setCardLastWrong(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onSubmitCardAnswer(myPlayerId, e.target.value);
                    }
                  }}
                  disabled={showResult || selections[myPlayerId] !== undefined}
                  placeholder="Type the card name here..."
                  style={{
                    width: 420,
                    height: 48,
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "none",
                    outline: "none",
                    fontSize: "1.4rem",
                    fontFamily: `"Trajan Pro White", "Trajan Pro", serif`,
                    color: "#ffffff",
                    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.02)",
                    // background image switches to "over" when locked (submitted or timer ran out)
                    backgroundImage: `url(${(showResult || selections[myPlayerId] !== undefined) ? nicknameBgOver : nicknameBg})`,
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                    // make sure text sits above the image
                    backgroundColor: "transparent",
                    WebkitAppearance: "none",
                    MozAppearance: "none",
                  }}
                />

                <button
                  onClick={() => onSubmitCardAnswer(myPlayerId, cardInput)}
                  onMouseEnter={playHoverSound}
                  disabled={showResult || selections[myPlayerId] !== undefined}
                  style={{
                    height: 48,
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    cursor: selections[myPlayerId] !== undefined || showResult ? "default" : "pointer",
                    backgroundImage: `url(${btnNormal})`,
                    backgroundSize: "contain",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "center",
                    backgroundColor: "transparent",
                    color: "white",
                    textShadow: "0 1px 3px rgba(0,0,0,0.8)",
                    fontSize: "1.4rem",
                    width: 320,
                  }}
                >
                  Submit!
                </button>
              </div>

              {cardLastWrong && !showResult && (
                <div style={{ color: "#ffb3b3", marginTop: 6 }}>Incorrect — try again.</div>
              )}

              {/* The previous "Correct: ..." block under the input was removed and is now overlayed on the image */}
            </div>
          </>
        ) : (
          // Trivia mode (existing UI)
          <>
            <h2 className="question">{currentQuestion.question}</h2>

            <div className="options-grid">
              {currentQuestion.options.map((opt, i) => {
                const mySelection = selections[myPlayerId];
                const reveal = showResult;
                const isMySelected = i === mySelection;

                let backgroundImage = `url(${btnNormal})`;
                let boxShadow = "none";

                if (reveal) {
                  if (i === correctIndex) {
                    backgroundImage = `url(${btnHover})`;
                    boxShadow = "0 0 12px 4px gold";
                  } else {
                    backgroundImage = `url(${btnDisabled})`;
                  }
                } else if (isMySelected) {
                  backgroundImage = `url(${btnHover})`;
                }

                return (
                  <button
                    key={i}
                    disabled={reveal || selections[myPlayerId] !== undefined}
                    className="option-button"
                    style={{ backgroundImage, boxShadow }}
                    onMouseEnter={playHoverSound}
                    onClick={() => {
                      onSelectOption(myPlayerId, i);
                    }}
                  >
                    <span className="option-text">{opt}</span>
                    {reveal && (
                      <span className="option-badge">
                        {playersList
                          .filter((p) => selections[p.id] === i)
                          .map((p) => p.name)
                          .join(", ")}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Always render the button, but hide and disable when showResult is false */}
      <button
        className="next-question-button"
        onMouseEnter={() => {
          if (showResult) playHoverSound();
        }}
        onClick={() => {
          if (showResult) {
            playClickSound();
            onNextQuestion();
          }
        }}
        style={{
          marginTop: 16,
          width: 360,
          height: 65,
          backgroundImage: `url(${btnMainMenuDisabled})`,
          backgroundSize: "contain",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "center",
          backgroundColor: "transparent",
          border: "none",
          borderRadius: 12,
          color: "white",
          fontFamily: '"Trajan Pro Bold", serif',
          fontWeight: 600,
          fontSize: "1.7rem",
          cursor: showResult ? "pointer" : "default",
          outline: "none",
          filter: showResult ? "drop-shadow(0 0 8px gold)" : "none",
          visibility: showResult ? "visible" : "hidden",
          pointerEvents: showResult ? "auto" : "none",
          userSelect: "none",
        }}
      >
        Next Question
      </button>

      {/* Small inline style to improve animation smoothness for leaderboard items and score bump */}
      <style>{`
        /* Leaderboard — compact spacing while preserving top-3 emphasis */
        .leaderboard-list { padding: 0; margin: 0; list-style: none; }

        .leaderboard-item { /* li element */
          display: block;
          margin: 2px 0;               /* tightened vertical spacing (was 6px) */
          border-radius: 8px;
          overflow: visible;
        }

        /* inner row: reduced padding and gap so rows are closer */
        .leaderboard-row {
          display: flex;
          align-items: center;
          gap: 6px;                    /* slightly tighter horizontal gap (was 8px) */
          padding: 4px 8px;            /* reduced padding (was 6px 8px) */
          border-radius: 8px;
          transition: transform 220ms ease, box-shadow 220ms ease;
          transform-origin: left center;
          background: transparent;
        }

        /* default small medal size (reduced from 36 -> 32) */
        .leaderboard-row img { width: 32px; height: 32px; margin-right: 8px; object-fit: contain; }

        /* keep top-3 larger but balanced for the tighter layout */
        .leaderboard-item.rank-3 .leaderboard-row { transform: scale(1.03); }
        .leaderboard-item.rank-3 .leaderboard-row img { width: 34px; height: 34px; }
        .leaderboard-item.rank-3 .leaderboard-name { font-size: 0.98rem; }

        .leaderboard-item.rank-2 .leaderboard-row { transform: scale(1.05); }
        .leaderboard-item.rank-2 .leaderboard-row img { width: 36px; height: 36px; }
        .leaderboard-item.rank-2 .leaderboard-name { font-size: 1.00rem; font-weight: 600; }

        .leaderboard-item.rank-1 .leaderboard-row { transform: scale(1.08); }
        .leaderboard-item.rank-1 .leaderboard-row img { width: 38px; height: 38px; }
        .leaderboard-item.rank-1 .leaderboard-name { font-size: 1.03rem; font-weight: 700; }

        /* subtle highlight for "you" */
        .leaderboard-item.you .leaderboard-row { background: rgba(255,255,255,0.025); }

        .leaderboard-name { flex: 1; }
        .leaderboard-score { min-width: 48px; text-align: right; display: inline-block; transform-origin: center; }

        /* keep score bump animation unchanged */
        .score-bump { animation: bump 680ms cubic-bezier(.2,.9,.3,1); color: gold; }
        @keyframes bump {
          0% { transform: scale(1); }
          25% { transform: scale(1.35); }
          60% { transform: scale(0.98); }
          100% { transform: scale(1); }
        }

        /* Card input customizations */
        .card-input {
          background-clip: padding-box; /* prevent weird bleed on rounded corners */
          caret-color: #ffffff;
        }

        .card-input::placeholder {
          color: rgba(255,255,255,0.85);
          opacity: 1; /* ensure consistent placeholder color across browsers */
          font-family: "Trajan Pro White", "Trajan Pro", serif;
        }

        .card-input:disabled {
          cursor: default;
          /* if you want a slight dim when locked, uncomment next line */
          /* opacity: 0.98; */
        }
        
        /* divider under main title */
        .divider-line { display: block; height: auto; }
      `}</style>
    </div>
  );
}
