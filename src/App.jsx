import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Home, Search, Library, Play, Pause, SkipBack, SkipForward, 
  Volume2, Mic2, Heart, Search as SearchIcon, Plus, List, 
  Bell, User, Download, Pin, Settings2, X, Archive, ChevronLeft, 
  ChevronRight, CheckCircle, Shuffle, MoreHorizontal, Clock, 
  Sparkles, Flame, ListMusic, ListPlus, ListMinus, Share2, 
  UserCircle, Disc3, ShieldAlert, LogOut, MonitorSmartphone, 
  Terminal as TerminalIcon, Server, PlaySquare
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInWithPopup, GoogleAuthProvider, 
  signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  onAuthStateChanged, signOut, setPersistence, browserLocalPersistence
} from 'firebase/auth';
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBALUg4Re7McwM7bNzwFr_oat7vl-_rAQU",
  authDomain: "fl4me-music.firebaseapp.com",
  projectId: "fl4me-music",
  storageBucket: "fl4me-music.firebasestorage.app",
  messagingSenderId: "369250788320",
  appId: "1:369250788320:web:7adcc66664264354778185"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();
const appId = 'fl4me-music-app';

const NAVIDROME_IP = "192.168.1.5";
const NAVIDROME_PORT = "4533";
const NAVIDROME_USER = "DevRaj";
const NAVIDROME_PASS = "2026";
const API_PARAMS = `u=${NAVIDROME_USER}&p=${NAVIDROME_PASS}&v=1.16.1&c=fl4me`;
const NAVIDROME_URL = "[https://uplifted-facelift-scanning.ngrok-free.dev/rest/getRandomSongs?size=](https://uplifted-facelift-scanning.ngrok-free.dev/rest/getRandomSongs?size=)...";

const INITIAL_PROFILE = { artistWeights: {}, albumWeights: {}, trackHistory: [], trackStats: {} };

export default function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authView, setAuthView] = useState('user'); 
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [catalog, setCatalog] = useState([]);
  const [likedSongs, setLikedSongs] = useState([]);
  const [profile, setProfile] = useState(() => JSON.parse(localStorage.getItem('fl4me_profile')) || INITIAL_PROFILE);
  const [artistImages, setArtistImages] = useState(() => JSON.parse(localStorage.getItem('fl4me_artist_images')) || {});
  
  // PERSISTENT PLAYER STATE
  const [currentTrack, setCurrentTrack] = useState(() => JSON.parse(localStorage.getItem('fl4me_last_track')) || null);
  const [queue, setQueue] = useState(() => JSON.parse(localStorage.getItem('fl4me_queue')) || []);
  const [volume, setVolume] = useState(() => parseFloat(localStorage.getItem('fl4me_volume')) || 1.0);
  const [playbackHistory, setPlaybackHistory] = useState([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [lyrics, setLyrics] = useState([]);

  // UI STATE
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const [activeView, setActiveView] = useState('home'); 
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [selectedAlbum, setSelectedAlbum] = useState(null);
  const [rightPanel, setRightPanel] = useState('none'); 
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0, track: null, indexInQueue: -1 });

  const [eqValues, setEqValues] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const eqLabels = ['32Hz', '64Hz', '125Hz', '250Hz', '500Hz', '1KHz', '2KHz', '4KHz', '8KHz', '16KHz'];
  
  const audioRef = useRef(null);
  const audioCtxRef = useRef(null);
  const filtersRef = useRef([]);
  const trackStartTimeRef = useRef(0);
  const hasLoggedMidListenRef = useRef(false);

  const addLog = (msg) => setDebugLogs(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 50));

  useEffect(() => { localStorage.setItem('fl4me_last_track', JSON.stringify(currentTrack)); }, [currentTrack]);
  useEffect(() => { localStorage.setItem('fl4me_queue', JSON.stringify(queue)); }, [queue]);
  useEffect(() => { localStorage.setItem('fl4me_profile', JSON.stringify(profile)); }, [profile]);
  useEffect(() => { 
    if (audioRef.current) audioRef.current.volume = volume; 
    localStorage.setItem('fl4me_volume', volume.toString()); 
  }, [volume]);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        return onAuthStateChanged(auth, (currentUser) => {
          if (isAdmin && user && user.uid === 'admin_master_001') return;
          setUser(currentUser);
          setAuthLoading(false);
          if (currentUser) {
            addLog(`User authenticated: ${currentUser.email || currentUser.uid}`);
            onSnapshot(doc(db, 'artifacts', appId, 'users', currentUser.uid), (docSnap) => {
              if (docSnap.exists() && docSnap.data().profile) setProfile(docSnap.data().profile);
            });
            onSnapshot(collection(db, 'artifacts', appId, 'users', currentUser.uid, 'likedSongs'), (snapshot) => {
              setLikedSongs(snapshot.docs.map(doc => doc.id));
            });
          }
        });
      })
      .catch(err => {
        setAuthLoading(false);
        addLog("Auth Persistence Error: " + err.message);
      });
  }, [isAdmin, user]);

  const handleGoogleLogin = async () => {
    try { setAuthError(''); await signInWithPopup(auth, googleProvider); setIsAdmin(false); } 
    catch (err) { setAuthError(err.message); }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (authView === 'admin' && emailInput === 'admin@fl4me.com' && passwordInput === 'fl4me2026') {
      setIsAdmin(true); setUser({ email: 'admin@fl4me.com', uid: 'admin_master_001' });
      setAuthLoading(false); addLog("Master Admin connected."); return;
    }
    try {
      await signInWithEmailAndPassword(auth, emailInput, passwordInput);
      setIsAdmin(false);
    } catch (err) {
      if (err.code === 'auth/user-not-found' && authView !== 'admin') {
        try { await createUserWithEmailAndPassword(auth, emailInput, passwordInput); setIsAdmin(false); } 
        catch (createErr) { setAuthError(createErr.message); }
      } else { setAuthError("Invalid credentials or admin key."); }
    }
  };

  const handleLogout = async () => {
    if (user && user.uid !== 'admin_master_001') await signOut(auth);
    setUser(null); setIsAdmin(false);
    setProfile(INITIAL_PROFILE); setLikedSongs([]); setCatalog([]);
  };

  useEffect(() => {
    if (!user) return;
    const fetchNavidromeCatalog = async () => {
      addLog(`Connecting to Mobile Navidrome Server at ${NAVIDROME_IP}...`);
      try {
        const response = await fetch(`${NAVIDROME_URL}/rest/getRandomSongs?size=9999999&f=json&${API_PARAMS}`);
        const data = await response.json();
        if (data["subsonic-response"]?.randomSongs?.song) {
          const loadedTracks = data["subsonic-response"].randomSongs.song.map(song => ({
            id: song.id, title: song.title, artist: song.artist, album: song.album || "Unknown Album",
            year: song.year || new Date().getFullYear(), trackDuration: song.duration || 180,
            suffix: song.suffix || "flac", bitRate: song.bitRate || 1411, 
            cover: `${NAVIDROME_URL}/rest/getCoverArt?id=${song.coverArt}&${API_PARAMS}`, isLocal: true 
          }));
          setCatalog(loadedTracks);
          addLog(`Successfully loaded ${loadedTracks.length} tracks.`);
        }
      } catch (err) {
        addLog(`Critical Failure: Could not reach Navidrome. ${err.message}`);
      }
    };
    fetchNavidromeCatalog();
  }, [user]);

  useEffect(() => {
    let isCancelled = false;
    const fetchArtistFaces = async () => {
      const uniqueArtists = [...new Set(catalog.flatMap(track => (track.artist || 'Unknown Artist').split(/,|\&/).map(a => a.trim()).filter(Boolean)))];
      for (const artist of uniqueArtists) {
        if (isCancelled) break;
        const currentCache = JSON.parse(localStorage.getItem('fl4me_artist_images') || '{}');
        if (currentCache[artist]) continue;
        try {
          const res = await fetch(`https://www.theaudiodb.com/api/v1/json/123/search.php?s=${encodeURIComponent(artist)}`);
          if (res.ok) {
            const data = await res.json();
            let newImg = 'NOT_FOUND';
            if (data.artists && data.artists[0] && data.artists[0].strArtistThumb) newImg = data.artists[0].strArtistThumb;
            if (!isCancelled) {
              setArtistImages(prev => {
                const next = { ...prev, [artist]: newImg };
                localStorage.setItem('fl4me_artist_images', JSON.stringify(next));
                return next;
              });
            }
          }
          await new Promise(r => setTimeout(r, 2000));
        } catch (e) { }
      }
    };
    if (catalog.length > 0) fetchArtistFaces();
    return () => { isCancelled = true; };
  }, [catalog]);

  useEffect(() => {
    const handleClick = () => setContextMenu(prev => ({ ...prev, visible: false }));
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const saveProfileToCloud = async (newProfile) => {
    setProfile(newProfile);
    if (user && user.uid !== 'admin_master_001') {
      try { await setDoc(doc(db, 'artifacts', appId, 'users', user.uid), { profile: newProfile }, { merge: true }); } 
      catch (err) { addLog("Cloud profile sync failed."); }
    }
  };

  const recordFeedback = (track, eventType) => {
    if (!track) return;
    const artist = track.artist?.split(/,|\&/)[0].trim() || "Unknown";
    const album = track.album || "Single";
    const trackId = track.id;
    const newProfile = { ...profile };
    newProfile.artistWeights = { ...profile.artistWeights };
    newProfile.albumWeights = { ...profile.albumWeights };
    newProfile.trackStats = { ...profile.trackStats };
    newProfile.trackHistory = [trackId, ...(profile.trackHistory || []).filter(id => id !== trackId)].slice(0, 30);
    if (!newProfile.trackStats[trackId]) newProfile.trackStats[trackId] = { plays: 0, completions: 0, skips: 0, score: 0 };

    if (eventType === 'COMPLETE') {
      newProfile.artistWeights[artist] = (newProfile.artistWeights[artist] || 0) + 2.0;
      newProfile.albumWeights[album] = (newProfile.albumWeights[album] || 0) + 1.0;
      newProfile.trackStats[trackId].completions += 1;
      newProfile.trackStats[trackId].plays += 1;
      newProfile.trackStats[trackId].score += 3.0;
    } else if (eventType === 'SKIP_PENALTY') {
      newProfile.artistWeights[artist] = Math.max((newProfile.artistWeights[artist] || 0) - 1.2, -10);
      newProfile.trackStats[trackId].skips += 1;
      newProfile.trackStats[trackId].score -= 2.5;
    } else if (eventType === 'MID_LISTEN') {
      newProfile.artistWeights[artist] = (newProfile.artistWeights[artist] || 0) + 1.2;
      newProfile.trackStats[trackId].plays += 1;
      newProfile.trackStats[trackId].score += 1.0;
    } else if (eventType === 'LIKE') {
      newProfile.artistWeights[artist] = (newProfile.artistWeights[artist] || 0) + 5.0;
      newProfile.albumWeights[album] = (newProfile.albumWeights[album] || 0) + 3.0;
      newProfile.trackStats[trackId].score += 5.0;
    } else if (eventType === 'UNLIKE') {
      newProfile.artistWeights[artist] = Math.max((newProfile.artistWeights[artist] || 0) - 4.0, 0);
      newProfile.albumWeights[album] = Math.max((newProfile.albumWeights[album] || 0) - 2.0, 0);
      newProfile.trackStats[trackId].score -= 4.0;
    }
    saveProfileToCloud(newProfile);
  };

  const recommendations = useMemo(() => {
    if (catalog.length === 0) return { topPicks: [], deepCuts: [], rediscovery: [] };
    const scored = catalog.map(track => {
      const primaryArtist = track.artist?.split(/,|\&/)[0].trim() || "Unknown";
      const album = track.album || "Single";
      const stats = profile.trackStats[track.id] || { plays: 0, completions: 0, skips: 0, score: 0 };
      const artistScore = (profile.artistWeights[primaryArtist] || 0) * 1.5;
      const albumScore = (profile.albumWeights[album] || 0) * 0.8;
      const likeScore = likedSongs.includes(track.id) ? 4.0 : 0;
      const historyIndex = profile.trackHistory.indexOf(track.id);
      let fatiguePenalty = 0;
      if (historyIndex !== -1) {
        if (historyIndex < 4) fatiguePenalty = -8.0; 
        else if (historyIndex < 10) fatiguePenalty = -3.5; 
      }
      const totalScore = artistScore + albumScore + likeScore + stats.score + fatiguePenalty + (Math.random() - 0.5);
      return { track, totalScore, plays: stats.plays, artistScore };
    });
    const topPicks = [...scored].sort((a, b) => b.totalScore - a.totalScore).slice(0, 30).map(item => item.track);
    const deepCuts = scored.filter(item => item.artistScore > 2.0 && item.plays === 0).sort((a, b) => b.artistScore - a.artistScore).slice(0, 10).map(item => item.track);
    const rediscovery = scored.filter(item => (likedSongs.includes(item.track.id) || item.plays > 1) && !topPicks.includes(item.track)).sort(() => Math.random() - 0.5).slice(0, 10).map(item => item.track);
    return { topPicks, deepCuts, rediscovery };
  }, [catalog, profile.trackHistory.length, likedSongs.length]); 

  const initEQ = () => {
    if (!audioCtxRef.current && audioRef.current) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const source = ctx.createMediaElementSource(audioRef.current);
        const freqs = [32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];
        const filters = freqs.map((freq, i) => {
          const filter = ctx.createBiquadFilter();
          filter.type = 'peaking'; filter.frequency.value = freq;
          filter.Q.value = 1; filter.gain.value = eqValues[i];
          return filter;
        });
        source.connect(filters[0]);
        for (let i = 0; i < filters.length - 1; i++) filters[i].connect(filters[i + 1]);
        filters[filters.length - 1].connect(ctx.destination);
        filtersRef.current = filters;
      } catch(e) { console.warn("EQ Init Blocked:", e); }
    }
  };

  const playSong = async (track, clearQueue = true) => {
    initEQ(); 
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
    
    if (currentTrack && duration > 0 && isPlaying) {
      const listenDuration = audioRef.current.currentTime;
      if (listenDuration < 15 && listenDuration < duration * 0.2) recordFeedback(currentTrack, 'SKIP_PENALTY');
    }
    if (clearQueue) {
      setQueue([]);
      if (currentTrack) setPlaybackHistory(prev => [currentTrack, ...prev].slice(0, 50));
    }

    trackStartTimeRef.current = Date.now();
    hasLoggedMidListenRef.current = false;
    setRecentSearches(prev => { const f = prev.filter(t => t.id !== track.id); return [track, ...f].slice(0, 10); });
    setCurrentTrack(track);
    setLyrics([]); setProgress(0); setIsPlaying(false);
    audioRef.current.pause();

    fetchLyrics(track.artist, track.title);
    
    try {
      audioRef.current.src = track.isLocal ? `${NAVIDROME_URL}/rest/stream?id=${track.id}&${API_PARAMS}` : track.streamUrl; 
      await audioRef.current.play();
      setIsPlaying(true);
    } catch (e) { addLog(`Playback error: ${e.message}`); }
  };

  const playFromQueue = async (index) => {
    const trackToPlay = queue[index];
    const newQueue = [...queue];
    newQueue.splice(index, 1); 
    setQueue(newQueue); 
    if (currentTrack) setPlaybackHistory(prev => [currentTrack, ...prev].slice(0, 50));
    await playSong(trackToPlay, false);
  };

  const removeFromQueue = (e, index) => {
    e.stopPropagation();
    setQueue(prev => prev.filter((_, i) => i !== index));
  };

  const playNext = async () => {
    if (currentTrack) setPlaybackHistory(prev => [currentTrack, ...prev].slice(0, 50));
    let nextTrack;
    if (queue.length > 0) {
      nextTrack = queue[0]; setQueue(prev => prev.slice(1));
    } else {
      const pool = recommendations.topPicks.length > 0 ? recommendations.topPicks : catalog;
      const available = pool.filter(t => t.id !== currentTrack?.id);
      nextTrack = available.length > 0 ? available[Math.floor(Math.random() * available.length)] : catalog[0];
    }
    if (nextTrack) await playSong(nextTrack, false);
  };

  const playPrevious = async () => {
    if (progress > 3 || playbackHistory.length === 0) {
      if (audioRef.current) audioRef.current.currentTime = 0; return;
    }
    const prevTrack = playbackHistory[0];
    setPlaybackHistory(prev => prev.slice(1));
    if (currentTrack) setQueue(prev => [currentTrack, ...prev]);
    await playSong(prevTrack, false);
  };

  const handleShuffleList = (list) => {
    if (!list || list.length === 0) return;
    const shuffled = [...list].sort(() => Math.random() - 0.5);
    setQueue(shuffled.slice(1));
    playSong(shuffled[0], false);
  };

  const handleTrackEnded = () => {
    setIsPlaying(false);
    if (currentTrack) recordFeedback(currentTrack, 'COMPLETE');
    playNext(); 
  };

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const curTime = audioRef.current.currentTime;
    const dur = audioRef.current.duration || 0;
    setProgress(curTime); setDuration(dur);
    if (!hasLoggedMidListenRef.current && currentTrack && (curTime > 45 || (dur > 0 && curTime / dur > 0.5))) {
      hasLoggedMidListenRef.current = true;
      recordFeedback(currentTrack, 'MID_LISTEN');
    }
  };

  const togglePlayPause = async () => {
    if (!audioRef.current) return;
    if (!currentTrack && queue.length > 0) return playNext();
    if (!currentTrack) return;
    initEQ();
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const toggleLike = async (track) => {
    const isLiked = likedSongs.includes(track.id);
    const updatedLikes = isLiked ? likedSongs.filter(id => id !== track.id) : [...likedSongs, track.id];
    setLikedSongs(updatedLikes);
    recordFeedback(track, isLiked ? 'UNLIKE' : 'LIKE');
    if (user && user.uid !== 'admin_master_001') {
      try {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'likedSongs', track.id);
        if (isLiked) await deleteDoc(docRef); else await setDoc(docRef, { addedAt: Date.now(), title: track.title, artist: track.artist });
      } catch (err) {}
    }
  };

  const handleMenuAction = (actionType) => {
    const track = contextMenu.track;
    switch (actionType) {
      case 'ADD_TO_QUEUE': setQueue(prev => [...prev, track]); break;
      case 'REMOVE_FROM_QUEUE': setQueue(prev => prev.filter((_, i) => i !== contextMenu.indexInQueue)); break;
      case 'TOGGLE_LIKE': toggleLike(track); break;
      case 'GO_ARTIST': setSelectedArtist(track.artist.split(/,|\&/)[0].trim()); setActiveView('artistDetail'); break;
      case 'GO_ALBUM': setSelectedAlbum(track.album); setActiveView('albumDetail'); break;
      case 'SHARE': navigator.clipboard.writeText(`Check out ${track.title} by ${track.artist} on Fl4me Music!`); break;
      default: break;
    }
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  const fetchLyrics = async (artist, title) => {
    try {
      const primaryArtist = artist.split(/,|\&/)[0].trim();
      const cleanTitle = title.replace(/\(.*?\)|\[.*?\]/g, '').split('-')[0].split('|')[0].trim();
      let url = `https://lrclib.net/api/get?artist_name=${encodeURIComponent(primaryArtist)}&track_name=${encodeURIComponent(cleanTitle)}`;
      let response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        if (data.syncedLyrics) {
          const lines = data.syncedLyrics.split('\n');
          const parsed = lines.map(line => {
            const match = /\[(\d+):(\d+\.\d+)\](.*)/.exec(line);
            if (match) return { time: parseInt(match[1]) * 60 + parseFloat(match[2]), text: match[3] };
            return null;
          }).filter(item => item !== null && item.text.trim() !== '');
          setLyrics(parsed); return;
        } else if (data.plainLyrics) { setLyrics([{ time: 0, text: data.plainLyrics }]); return; }
      }
      url = `https://lrclib.net/api/search?q=${encodeURIComponent(primaryArtist + ' ' + cleanTitle)}`;
      response = await fetch(url);
      if (response.ok) {
        const searchData = await response.json();
        const bestMatch = searchData.find(t => t.syncedLyrics || t.plainLyrics);
        if (bestMatch) {
            if (bestMatch.syncedLyrics) {
              const lines = bestMatch.syncedLyrics.split('\n');
              const parsed = lines.map(line => {
                const match = /\[(\d+):(\d+\.\d+)\](.*)/.exec(line);
                if (match) return { time: parseInt(match[1]) * 60 + parseFloat(match[2]), text: match[3] }; return null;
              }).filter(item => item !== null && item.text.trim() !== '');
              setLyrics(parsed); return;
            } else if (bestMatch.plainLyrics) { setLyrics([{ time: 0, text: bestMatch.plainLyrics }]); return; }
        }
      }
      throw new Error("Not found");
    } catch (err) { setLyrics([{ time: 0, text: "Lyrics unavailable for this track." }]); }
  };

  const formatTime = (seconds) => {
    if (isNaN(seconds)) return "0:00";
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const getEqSvgPaths = () => {
    const segments = eqValues.length - 1;
    let linePath = `M 0,${((12 - eqValues[0]) / 24) * 100} `;
    for (let i = 0; i < segments; i++) {
      const currX = (i / segments) * 100;
      const currY = ((12 - eqValues[i]) / 24) * 100;
      const nextX = ((i + 1) / segments) * 100;
      const nextY = ((12 - eqValues[i + 1]) / 24) * 100;
      const cpX = (currX + nextX) / 2;
      linePath += `C ${cpX},${currY} ${cpX},${nextY} ${nextX},${nextY} `;
    }
    const fillPath = `${linePath} L 100,100 L 0,100 Z`;
    return { linePath, fillPath };
  };

  const artistMap = {};
  catalog.forEach(track => {
    const rawArtistString = track.artist || 'Unknown Artist';
    const individualArtists = rawArtistString.split(/,|\&/).map(a => a.trim()).filter(Boolean);
    individualArtists.forEach(name => {
      if (!artistMap[name]) artistMap[name] = { name, cover: (artistImages[name] && artistImages[name] !== 'NOT_FOUND') ? artistImages[name] : track.cover, trackCount: 0 };
      artistMap[name].trackCount++;
    });
  });
  
  const artistsList = Object.values(artistMap).sort((a,b) => a.name.localeCompare(b.name));
  const uniqueAlbums = [...new Set(catalog.map(t => t.album))];
  const likedCatalog = catalog.filter(t => likedSongs.includes(t.id));
  const { linePath, fillPath } = getEqSvgPaths();

  const matchedArtists = searchQuery ? artistsList.filter(a => a.name.toLowerCase().includes(searchQuery.toLowerCase())) : [];
  const matchedLocalSongs = searchQuery ? catalog.filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.artist.toLowerCase().includes(searchQuery.toLowerCase())) : [];
  const matchedAlbums = searchQuery ? uniqueAlbums.filter(a => a.toLowerCase().includes(searchQuery.toLowerCase())) : [];

  const activeLyricIndex = lyrics.findIndex((l, i) => {
    const nextTime = lyrics[i + 1]?.time || Infinity;
    return progress >= l.time && progress < nextTime;
  });

  useEffect(() => {
    if (rightPanel === 'lyrics' && activeLyricIndex !== -1) {
      const activeEl = document.getElementById(`lyric-${activeLyricIndex}`);
      if (activeEl) activeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeLyricIndex, rightPanel]);

  const activeArtistTracks = catalog.filter(t => t.artist?.split(/,|\&/).map(a => a.trim()).includes(selectedArtist));
  const activeArtistAlbums = [...new Set(activeArtistTracks.map(t => t.album))];
  const activeAlbumTracks = catalog.filter(t => t.album === selectedAlbum);
  const totalAlbumDuration = activeAlbumTracks.reduce((acc, curr) => acc + (curr.trackDuration || 0), 0);
  const totalLikedDuration = likedCatalog.reduce((acc, curr) => acc + (curr.trackDuration || 0), 0);

  if (authLoading) return <div className="h-screen w-full bg-black flex items-center justify-center text-white"><Flame size={48} className="animate-pulse text-[#1DB954]" /></div>;

  if (!user) {
    return (
      <div className="h-screen w-full bg-black flex flex-col items-center justify-center text-white font-sans relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#1DB954]/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/20 blur-[120px] rounded-full pointer-events-none" />
        <div className="z-10 w-[400px] bg-[#121212] p-10 rounded-2xl border border-[#333] shadow-2xl flex flex-col items-center">
          <div className="flex items-center gap-3 mb-8">
            <Flame size={40} className="text-[#1DB954]" />
            <h1 className="text-3xl font-black tracking-tight">Fl4me Music</h1>
          </div>
          <h2 className="text-xl font-bold mb-6 w-full text-center">{authView === 'user' ? 'Log in to listen' : 'Admin Portal Access'}</h2>
          {authError && <div className="w-full p-3 bg-red-500/20 border border-red-500/50 rounded-lg mb-6 text-red-200 text-sm font-medium flex items-center gap-2"><ShieldAlert size={16}/> {authError}</div>}
          {authView === 'user' && (
            <button onClick={handleGoogleLogin} className="w-full flex items-center justify-center gap-3 bg-white text-black font-bold py-3.5 rounded-full hover:scale-105 transition-transform mb-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.16v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.16C1.43 8.55 1 10.22 1 12s.43 3.45 1.16 4.93l3.68-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.16 7.07l3.68 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continue with Google
            </button>
          )}
          {authView === 'user' && <div className="w-full flex items-center gap-4 mb-6"><div className="flex-1 h-px bg-[#333]"></div><span className="text-[#b3b3b3] text-sm font-medium">OR</span><div className="flex-1 h-px bg-[#333]"></div></div>}
          <form onSubmit={handleEmailAuth} className="w-full flex flex-col gap-4">
            <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-white">Email address</label><input type="email" required value={emailInput} onChange={e => setEmailInput(e.target.value)} placeholder="name@domain.com" className="w-full bg-transparent border border-[#555] rounded-md px-4 py-3 text-white focus:outline-none focus:border-white transition-colors placeholder:text-[#555]" /></div>
            <div className="flex flex-col gap-1.5"><label className="text-sm font-bold text-white flex justify-between">{authView === 'user' ? 'Verification Code / Password' : 'Admin Key'}</label><input type="password" required value={passwordInput} onChange={e => setPasswordInput(e.target.value)} placeholder={authView === 'user' ? 'Enter 6-digit code or password' : '••••••••'} className="w-full bg-transparent border border-[#555] rounded-md px-4 py-3 text-white focus:outline-none focus:border-white transition-colors placeholder:text-[#555]" />{authView === 'user' && <p className="text-xs text-[#b3b3b3] mt-1">If not registered, an account will be created automatically.</p>}</div>
            <button type="submit" className="w-full bg-[#1DB954] text-black font-bold py-3.5 rounded-full hover:scale-105 transition-transform mt-4">{authView === 'user' ? 'Log In / Register' : 'Access Dashboard'}</button>
          </form>
          <div className="w-full h-px bg-[#333] my-8"></div>
          {authView === 'user' ? <button onClick={() => { setAuthView('admin'); setAuthError(''); }} className="text-[#b3b3b3] hover:text-white font-bold text-sm transition-colors flex items-center gap-2"><TerminalIcon size={16}/> Admin Login</button> : <button onClick={() => { setAuthView('user'); setAuthError(''); }} className="text-[#b3b3b3] hover:text-white font-bold text-sm transition-colors flex items-center gap-2"><UserCircle size={16}/> Back to User Login</button>}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full flex flex-col bg-black text-white font-sans overflow-hidden p-2 gap-2 selection:bg-[#1DB954]/30" onContextMenu={(e) => e.preventDefault()}>
      
      <audio ref={audioRef} crossOrigin="anonymous" onTimeUpdate={handleTimeUpdate} onEnded={handleTrackEnded} />

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #5a5a5a; border-radius: 4px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: #b3b3b3; }
        .line-clamp-2 { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
      `}} />

      {/* CONTEXT MENU */}
      {contextMenu.visible && contextMenu.track && (
        <div className="fixed z-[100] bg-[#282828] text-[#e5e5e5] text-sm font-medium rounded-md shadow-2xl p-1 w-64 border border-[#3e3e3e]" style={{ top: Math.min(contextMenu.y, window.innerHeight - 300), left: Math.min(contextMenu.x, window.innerWidth - 250) }} onClick={(e) => e.stopPropagation()}>
          {contextMenu.indexInQueue === -1 ? (
            <><button onClick={() => handleMenuAction('ADD_TO_QUEUE')} className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-[#3e3e3e] rounded-sm transition-colors"><ListPlus size={18} className="text-[#b3b3b3]" /> Add to queue</button><div className="h-px bg-[#3e3e3e] my-1 mx-2" /><button onClick={() => handleMenuAction('TOGGLE_LIKE')} className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-[#3e3e3e] rounded-sm transition-colors"><Heart size={18} className={likedSongs.includes(contextMenu.track.id) ? "fill-[#1DB954] text-[#1DB954]" : "text-[#b3b3b3]"} /> {likedSongs.includes(contextMenu.track.id) ? "Remove from your Liked Songs" : "Add to your Liked Songs"}</button></>
          ) : (
            <><button onClick={() => handleMenuAction('REMOVE_FROM_QUEUE')} className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-[#3e3e3e] rounded-sm transition-colors"><ListMinus size={18} className="text-[#b3b3b3]" /> Remove from queue</button><div className="h-px bg-[#3e3e3e] my-1 mx-2" /><button onClick={() => handleMenuAction('TOGGLE_LIKE')} className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-[#3e3e3e] rounded-sm transition-colors"><Heart size={18} className={likedSongs.includes(contextMenu.track.id) ? "fill-[#1DB954] text-[#1DB954]" : "text-[#b3b3b3]"} /> {likedSongs.includes(contextMenu.track.id) ? "Remove from your Liked Songs" : "Add to your Liked Songs"}</button></>
          )}
          <div className="h-px bg-[#3e3e3e] my-1 mx-2" />
          <button onClick={() => handleMenuAction('GO_ARTIST')} className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-[#3e3e3e] rounded-sm transition-colors"><UserCircle size={18} className="text-[#b3b3b3]" /> Go to artist</button>
          <button onClick={() => handleMenuAction('GO_ALBUM')} className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-[#3e3e3e] rounded-sm transition-colors"><Disc3 size={18} className="text-[#b3b3b3]" /> Go to album</button>
          <div className="h-px bg-[#3e3e3e] my-1 mx-2" />
          <button onClick={() => handleMenuAction('SHARE')} className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-[#3e3e3e] rounded-sm transition-colors"><Share2 size={18} className="text-[#b3b3b3]" /> Share</button>
        </div>
      )}

      {/* ADMIN DASHBOARD MODAL */}
      {isAdminDashboardOpen && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-[150] backdrop-blur-sm transition-all" onClick={() => setIsAdminDashboardOpen(false)}>
          <div className="bg-[#1f1f1f] p-8 rounded-xl w-[1000px] h-[700px] shadow-2xl border border-[#333] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-8 shrink-0">
              <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-3"><TerminalIcon className="text-[#1DB954]" /> Admin Dashboard</h2>
              <button onClick={() => setIsAdminDashboardOpen(false)} className="text-[#b3b3b3] hover:text-white transition-colors"><X size={24}/></button>
            </div>
            <div className="flex gap-6 flex-1 min-h-0">
              <div className="w-1/3 flex flex-col gap-6">
                <div className="bg-[#121212] rounded-lg border border-[#333] p-4 flex flex-col">
                  <h3 className="text-sm font-bold text-[#b3b3b3] uppercase tracking-wider mb-4 flex items-center gap-2"><Server size={16}/> Server Connection</h3>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3 p-3 bg-[#2a2a2a] rounded-md border border-[#1DB954]/50">
                      <Server size={20} className="text-[#1DB954]" />
                      <div className="flex flex-col"><span className="text-white text-sm font-bold">Mobile Navidrome</span><span className="text-[#b3b3b3] text-xs">IP: {NAVIDROME_IP}</span></div>
                    </div>
                  </div>
                  <button onClick={() => window.location.reload()} className="mt-4 w-full flex items-center justify-center gap-2 bg-[#1DB954]/10 text-[#1DB954] border border-[#1DB954]/50 py-2 rounded-md hover:bg-[#1DB954] hover:text-black transition-colors font-bold text-sm"><Archive size={16}/> Re-Sync Local Catalog</button>
                </div>
                <div className="bg-[#121212] rounded-lg border border-[#333] p-4 flex flex-col flex-1">
                  <h3 className="text-sm font-bold text-[#b3b3b3] uppercase tracking-wider mb-4 flex items-center gap-2"><MonitorSmartphone size={16}/> Active Sessions</h3>
                  <div className="flex flex-col gap-3 flex-1">
                    <div className="flex items-center gap-3 p-3 bg-[#2a2a2a] rounded-md border border-white/10">
                      <MonitorSmartphone size={20} className="text-[#b3b3b3]" />
                      <div className="flex flex-col"><span className="text-white text-sm font-bold">This Device (Current)</span><span className="text-[#b3b3b3] text-xs">Auth: {user.email || user.uid}</span></div>
                    </div>
                  </div>
                  <button onClick={handleLogout} className="mt-auto w-full flex items-center justify-center gap-2 bg-red-500/10 text-red-500 border border-red-500/50 py-2 rounded-md hover:bg-red-500 hover:text-white transition-colors font-bold text-sm"><LogOut size={16}/> Force Logout All</button>
                </div>
              </div>
              <div className="w-2/3 bg-[#0a0a0a] rounded-lg border border-[#333] p-4 flex flex-col relative">
                <h3 className="text-sm font-bold text-[#b3b3b3] uppercase tracking-wider mb-4 flex items-center gap-2"><TerminalIcon size={16}/> System Logs</h3>
                <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-xs text-[#0f0] flex flex-col-reverse">
                  {debugLogs.map((log, i) => <div key={i} className="mb-1">{log}</div>)}
                  {debugLogs.length === 0 && <div className="text-[#555] italic">System initialized. Waiting for events...</div>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EQUALIZER MODAL */}
      {isSettingsOpen && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm transition-all" onClick={() => setIsSettingsOpen(false)}>
          <div className="bg-[#1f1f1f] p-8 rounded-xl w-[900px] shadow-2xl border border-[#333]" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-10">
              <h2 className="text-xl font-bold text-white tracking-wide">Equalizer</h2>
              <div className="flex items-center gap-6">
                <button onClick={() => setEqValues(new Array(10).fill(0))} className="text-[#b3b3b3] hover:text-white text-sm font-bold tracking-widest uppercase transition-colors">Reset</button>
                <button onClick={() => setIsSettingsOpen(false)} className="text-[#b3b3b3] hover:text-white transition-colors"><X size={24}/></button>
              </div>
            </div>
            <div className="flex w-full h-[250px] relative">
              <div className="w-16 flex flex-col justify-between text-sm font-bold text-[#b3b3b3] py-2 pr-4 text-right"><span>+12dB</span><span>-12dB</span></div>
              <div className="flex-1 relative border-l border-[#333]">
                <div className="absolute top-1/2 left-0 w-full h-px bg-white/20 -translate-y-1/2" />
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none z-0">
                  <defs><linearGradient id="eqGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="rgba(255,255,255,0.4)" /><stop offset="100%" stopColor="rgba(255,255,255,0)" /></linearGradient></defs>
                  <path d={fillPath} fill="url(#eqGrad)" />
                  <path d={linePath} fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="0.75" vectorEffect="non-scaling-stroke" />
                </svg>
                <div className="absolute inset-0 flex justify-between">
                  {eqValues.map((val, i) => (
                    <div key={i} className="relative w-full h-full flex justify-center">
                      <div className="absolute top-0 w-px h-full bg-white/10 pointer-events-none" />
                      <div className="absolute w-[10px] h-[10px] bg-white rounded-full shadow pointer-events-none z-10" style={{ top: `${((12 - val) / 24) * 100}%`, transform: 'translateY(-50%)' }} />
                      <input type="range" min="-12" max="12" step="0.1" value={val} onChange={(e) => { const n = [...eqValues]; n[i] = parseFloat(e.target.value); setEqValues(n); }} className="absolute bg-transparent opacity-0 cursor-pointer z-20 m-0 p-0" style={{ width: '250px', height: '24px', left: '50%', top: '50%', transform: 'translate(-50%, -50%) rotate(-90deg)' }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex ml-16 mt-4 text-[#b3b3b3] text-xs font-bold">{eqLabels.map((lbl, i) => <div key={i} className="flex-1 text-center">{lbl}</div>)}</div>
          </div>
        </div>
      )}

      {/* TOP NAVIGATION */}
      <div className="h-12 flex items-center justify-between px-2 shrink-0 relative z-40 bg-black">
        <div className="flex items-center w-[280px] gap-4">
          <div className="flex items-center gap-2">
            <button onClick={() => { if (activeView === 'artistDetail') setActiveView('artists'); else if (activeView === 'albumDetail') setActiveView('albums'); else setActiveView('home'); }} className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-[#b3b3b3] hover:text-white transition-colors"><ChevronLeft size={20} /></button>
            <button className="w-8 h-8 rounded-full bg-black/60 flex items-center justify-center text-[#b3b3b3] hover:text-white transition-colors opacity-50 cursor-not-allowed"><ChevronRight size={20} /></button>
          </div>
          <div onClick={() => setActiveView('home')} className="flex items-center gap-2 cursor-pointer hover:text-white text-[#b3b3b3] transition">
            <span className="bg-white text-black p-1.5 rounded-full"><Play size={18} className="fill-current" /></span>
          </div>
        </div>

        <div className="flex flex-1 max-w-lg justify-center relative">
          <button onClick={() => setActiveView('home')} className={`w-12 h-12 mr-2 rounded-full flex items-center justify-center transition-colors shrink-0 ${activeView === 'home' ? 'bg-[#2a2a2a] text-white' : 'bg-[#1f1f1f] text-[#b3b3b3] hover:text-white hover:bg-[#2a2a2a]'}`}><Home size={24} /></button>
          <div className="relative w-full">
            <div className={`flex items-center bg-[#242424] hover:bg-[#2a2a2a] transition-all rounded-full px-4 py-3 w-full gap-3 border ${isSearchFocused ? 'border-white bg-[#2a2a2a]' : 'border-transparent'}`}>
              <SearchIcon size={22} className={isSearchFocused ? 'text-white' : 'text-[#b3b3b3]'} />
              <input type="text" placeholder="What do you want to play?" value={searchQuery} onFocus={() => setIsSearchFocused(true)} onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)} onChange={(e) => setSearchQuery(e.target.value)} className="bg-transparent border-none outline-none text-white w-full text-sm placeholder:text-[#b3b3b3] placeholder:font-medium" />
              <div className="h-6 w-px bg-[#333] mx-1"></div>
              <Archive size={22} className="text-[#b3b3b3] hover:text-white cursor-pointer transition-colors shrink-0" />
            </div>

            {/* SEARCH DROPDOWN OVERLAY */}
            {isSearchFocused && (
              <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-[#282828] rounded-lg shadow-2xl p-2 max-h-[60vh] overflow-y-auto custom-scrollbar border border-[#333]">
                {searchQuery.trim() === '' ? (
                  <>
                    <h3 className="text-white font-bold text-lg px-3 pt-2 pb-3">Recent searches</h3>
                    {recentSearches.length === 0 && <p className="text-[#b3b3b3] px-3 pb-2 text-sm font-medium">No recent searches</p>}
                    {recentSearches.map((track, i) => (
                      <div key={`recent-${i}`} onClick={() => playSong(track)} onContextMenu={(e) => handleContextMenu(e, track)} className="flex items-center gap-3 p-2 rounded-md hover:bg-[#3e3e3e] cursor-pointer transition-colors group">
                        <img src={track.cover} alt="" className="w-12 h-12 rounded object-cover shrink-0 bg-[#333]" />
                        <div className="flex flex-col justify-center overflow-hidden"><span className="font-bold text-base text-white truncate">{track.title}</span><span className="text-sm text-[#b3b3b3] truncate group-hover:text-white transition-colors">Song • {track.artist}</span></div>
                      </div>
                    ))}
                  </>
                ) : (
                  <>
                    {matchedArtists.length > 0 && (
                      <>
                        <h3 className="text-white font-bold text-lg px-3 pt-2 pb-2">Artists</h3>
                        {matchedArtists.slice(0, 3).map(artist => (
                          <div key={`live-artist-${artist.name}`} onClick={() => { setSelectedArtist(artist.name); setActiveView('artistDetail'); setIsSearchFocused(false); setSearchQuery(''); }} className="flex items-center gap-3 p-2 rounded-md hover:bg-[#3e3e3e] cursor-pointer transition-colors group">
                            <div className="w-12 h-12 rounded-full overflow-hidden shrink-0 bg-[#333] flex items-center justify-center"><img src={artist.cover} alt="" className="w-full h-full object-cover" /></div>
                            <div className="flex flex-col justify-center overflow-hidden"><span className="font-bold text-base text-white truncate">{artist.name}</span><span className="text-sm text-[#b3b3b3] truncate group-hover:text-white transition-colors">Artist</span></div>
                          </div>
                        ))}
                      </>
                    )}
                    {matchedAlbums.length > 0 && (
                      <>
                        <h3 className="text-white font-bold text-lg px-3 pt-4 pb-2">Albums</h3>
                        {matchedAlbums.slice(0, 3).map((album, idx) => {
                          const firstTrack = catalog.find(t => t.album === album);
                          return (
                            <div key={`live-album-${idx}`} onClick={() => { setSelectedAlbum(album); setActiveView('albumDetail'); setIsSearchFocused(false); setSearchQuery(''); }} className="flex items-center gap-3 p-2 rounded-md hover:bg-[#3e3e3e] cursor-pointer transition-colors group">
                              <img src={firstTrack?.cover} alt="" className="w-12 h-12 rounded object-cover shrink-0 bg-[#333]" />
                              <div className="flex flex-col justify-center overflow-hidden"><span className="font-bold text-base text-white truncate">{album}</span><span className="text-sm text-[#b3b3b3] truncate group-hover:text-white transition-colors">Album</span></div>
                            </div>
                          )
                        })}
                      </>
                    )}
                    {matchedLocalSongs.length > 0 && (
                      <>
                        <h3 className="text-white font-bold text-lg px-3 pt-4 pb-2">Songs</h3>
                        {matchedLocalSongs.slice(0, 8).map(track => (
                          <div key={`live-song-local-${track.id}`} onClick={() => playSong(track)} onContextMenu={(e) => handleContextMenu(e, track)} className="flex items-center gap-3 p-2 rounded-md hover:bg-[#3e3e3e] cursor-pointer transition-colors group">
                            <img src={track.cover} alt="" className="w-12 h-12 rounded object-cover shrink-0 bg-[#333]" />
                            <div className="flex flex-col justify-center overflow-hidden"><span className="font-bold text-base text-white truncate">{track.title}</span><span className="text-sm text-[#b3b3b3] truncate group-hover:text-white transition-colors">Song • {track.artist}</span></div>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 w-[280px]">
          {isAdmin ? (
            <button onClick={() => setIsAdminDashboardOpen(true)} className="bg-red-500 text-white text-sm font-bold px-4 py-1.5 rounded-full hover:scale-105 transition-transform flex items-center gap-2"><TerminalIcon size={16} /> Admin Settings</button>
          ) : (
            <button className="bg-white text-black text-sm font-bold px-4 py-1.5 rounded-full hover:scale-105 transition-transform">Explore Premium</button>
          )}
          <button className="text-[#b3b3b3] hover:text-white transition-colors"><Bell size={20} /></button>
          <button onClick={() => setIsSettingsOpen(true)} className="text-[#b3b3b3] hover:text-white transition-colors"><Settings2 size={20} /></button>
          <div className="relative group cursor-pointer">
            <button className="bg-[#1f1f1f] p-1.5 rounded-full text-[#b3b3b3] hover:text-white hover:bg-[#2a2a2a] transition-colors"><User size={20} /></button>
            <div className="absolute right-0 top-full mt-2 w-48 bg-[#282828] rounded-md shadow-2xl border border-[#333] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all">
              <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-sm font-bold text-red-500 hover:bg-[#333] rounded-md flex items-center gap-2"><LogOut size={16}/> Log out</button>
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT SPLIT AREA */}
      <div className="flex-1 flex min-h-0 gap-2 relative z-0">
        
        {/* LEFT SIDEBAR */}
        <div className="w-[320px] bg-[#121212] rounded-lg flex flex-col shrink-0">
          <div className="px-4 pt-4 pb-2 flex items-center justify-between">
            <button onClick={() => setActiveView('home')} className="flex items-center gap-4 text-[#b3b3b3] hover:text-white transition-colors font-bold group"><Library size={24} className="group-hover:text-white" /> Your Library</button>
            <div className="flex items-center gap-2"><button onClick={() => handleShuffleList(catalog)} className="w-8 h-8 flex items-center justify-center text-[#b3b3b3] hover:text-white hover:bg-[#1f1f1f] rounded-full transition-colors"><Plus size={20} /></button></div>
          </div>
          
          <div className="px-4 py-2 flex items-center gap-2">
            <button onClick={() => setActiveView('playlists')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeView === 'playlists' ? 'bg-white text-black' : 'bg-[#242424] hover:bg-[#2a2a2a]'}`}>Playlists</button>
            <button onClick={() => setActiveView('artists')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeView === 'artists' || activeView === 'artistDetail' ? 'bg-white text-black' : 'bg-[#242424] hover:bg-[#2a2a2a]'}`}>Artists</button>
            <button onClick={() => setActiveView('albums')} className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${activeView === 'albums' || activeView === 'albumDetail' ? 'bg-white text-black' : 'bg-[#242424] hover:bg-[#2a2a2a]'}`}>Albums</button>
          </div>

          <p className="text-xs text-[#b3b3b3] px-4 font-medium mb-1 mt-1">{catalog.length} total songs</p>

          <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-2 mt-2">
            <div onClick={() => setActiveView('playlists')} className="flex items-center gap-3 p-2 rounded-md hover:bg-[#1a1a1a] cursor-pointer transition-colors">
              <div className="w-12 h-12 rounded bg-gradient-to-br from-indigo-600 to-blue-300 flex items-center justify-center shrink-0"><Heart size={20} className="fill-white text-white" /></div>
              <div className="flex flex-col justify-center overflow-hidden"><span className="text-white font-bold text-base truncate">Liked Songs</span><span className="text-sm text-[#b3b3b3] flex items-center gap-1 truncate"><Pin size={12} className="fill-[#1DB954] text-[#1DB954]" /> Playlist • {likedSongs.length} songs</span></div>
            </div>

            {catalog.slice(0, 50).map((track) => (
              <div key={`lib-${track.id}`} onClick={() => playSong(track)} onContextMenu={(e) => handleContextMenu(e, track)} className={`flex items-center gap-3 p-2 rounded-md cursor-pointer transition-colors ${currentTrack?.id === track.id ? 'bg-[#2a2a2a]' : 'hover:bg-[#1a1a1a]'}`}>
                <img src={track.cover} alt="" className="w-12 h-12 rounded object-cover shrink-0 bg-[#282828]" />
                <div className="flex flex-col justify-center overflow-hidden"><span className={`font-bold text-base truncate ${currentTrack?.id === track.id ? 'text-[#1DB954]' : 'text-white'}`}>{track.title}</span><span className="text-sm text-[#b3b3b3] truncate">Song • {track.artist}</span></div>
              </div>
            ))}
          </div>
        </div>

        {/* CENTER CONTENT */}
        <div className="flex-1 bg-[#121212] rounded-lg overflow-y-auto custom-scrollbar relative flex flex-col">
          
          {activeView !== 'artistDetail' && activeView !== 'albumDetail' && activeView !== 'playlists' && (
            <div className="sticky top-0 bg-[#121212]/90 backdrop-blur-md z-10 px-6 py-4 flex items-center gap-2">
              <button onClick={() => setActiveView('home')} className={`px-3 py-1.5 rounded-full text-sm font-bold ${activeView === 'home' ? 'bg-white text-black' : 'bg-[#242424] hover:bg-[#2a2a2a] text-white'}`}>All</button>
              <button onClick={() => handleShuffleList(catalog)} className="bg-[#242424] hover:bg-[#2a2a2a] px-3 py-1.5 rounded-full text-sm font-medium transition-colors text-white">Music</button>
            </div>
          )}

          <div className={`flex-1 ${activeView !== 'artistDetail' && activeView !== 'albumDetail' && activeView !== 'playlists' ? 'px-6 pb-8 bg-gradient-to-b from-[#1a1a1a] to-[#121212]' : ''}`}>
            
            {/* 1. PLAYLISTS (LIKED SONGS DEDICATED VIEW) */}
            {activeView === 'playlists' && (
              <div className="flex flex-col w-full pb-8">
                <div className="bg-gradient-to-b from-[#4a154b] to-[#1a1a1a] p-6 pb-8 flex items-end gap-6 relative shadow-inner">
                  <div className="w-[232px] h-[232px] shadow-2xl rounded bg-gradient-to-br from-[#450af5] to-[#8e8ee5] flex items-center justify-center shrink-0"><Heart size={80} className="fill-white text-white shadow-lg" /></div>
                  <div className="flex flex-col pb-2">
                    <span className="text-sm font-bold text-white mb-2 uppercase tracking-wider">Playlist</span>
                    <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter">Liked Songs</h1>
                    <div className="text-white text-sm font-medium flex items-center gap-1.5"><span className="font-bold">{user.email || 'DevRaj'}</span><span>•</span><span>{likedCatalog.length} song{likedCatalog.length !== 1 ? 's' : ''}</span><span>•</span><span>{Math.floor(totalLikedDuration / 60)} min {totalLikedDuration % 60} sec</span></div>
                  </div>
                </div>

                <div className="bg-gradient-to-b from-[#1a1a1a] to-[#121212] px-6 min-h-[500px]">
                  <div className="py-6 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <button onClick={() => { if (likedCatalog.length > 0) handleShuffleList(likedCatalog); }} disabled={likedCatalog.length === 0} className="w-14 h-14 bg-[#1DB954] text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-xl disabled:opacity-50"><Play size={28} className="fill-current ml-1" /></button>
                      <button onClick={() => handleShuffleList(likedCatalog)} className="text-[#b3b3b3] hover:text-white transition-colors"><Shuffle size={32} /></button>
                      <button className="text-[#b3b3b3] hover:text-white transition-colors"><Download size={32} /></button>
                    </div>
                    <button className="flex items-center gap-2 text-[#b3b3b3] hover:text-white text-sm font-bold transition-colors">List <List size={20} /></button>
                  </div>

                  <div className="flex items-center px-4 py-2 border-b border-white/10 text-[#b3b3b3] text-sm font-medium mb-4"><span className="w-8 text-right mr-4">#</span><span className="flex-1">Title</span><span className="w-48 hidden md:block">Album</span><span className="w-12 flex justify-end"><Clock size={16} /></span></div>

                  <div className="flex flex-col pb-8">
                    {likedCatalog.length === 0 ? (
                      <p className="text-[#b3b3b3] text-sm px-4 py-8">Songs you like will appear here.</p>
                    ) : (
                      likedCatalog.map((track, idx) => {
                        const isActive = currentTrack?.id === track.id;
                        return (
                          <div key={`liked-view-${track.id}`} onClick={() => playSong(track)} onContextMenu={(e) => handleContextMenu(e, track)} className="flex items-center px-4 py-2 rounded-md hover:bg-white/10 cursor-pointer group transition-colors">
                            <div className="w-8 text-right mr-4 relative flex justify-end items-center"><span className={`text-base font-medium group-hover:invisible ${isActive ? 'text-[#1DB954]' : 'text-[#b3b3b3]'}`}>{idx + 1}</span><Play size={16} className={`absolute text-white invisible group-hover:visible ${isActive ? 'text-[#1DB954] fill-current' : ''}`} /></div>
                            <div className="flex items-center gap-3 flex-1 overflow-hidden"><img src={track.cover} alt="" className="w-10 h-10 rounded object-cover shrink-0 bg-[#282828]" /><div className="flex flex-col justify-center overflow-hidden"><span className={`font-medium text-base truncate ${isActive ? 'text-[#1DB954]' : 'text-white'}`}>{track.title}</span><span className="text-[#b3b3b3] text-sm truncate hover:underline hover:text-white w-fit">{track.artist}</span></div></div>
                            <div className="w-48 hidden md:block text-[#b3b3b3] text-sm truncate pr-4">{track.album}</div>
                            <button onClick={(e) => { e.stopPropagation(); toggleLike(track); }} className="transition-colors w-12 flex justify-center text-[#1DB954] hover:scale-110"><Heart size={16} className="fill-current" /></button>
                            <div className="w-12 text-right text-[#b3b3b3] text-sm font-medium">{formatTime(track.trackDuration)}</div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* 2. ARTISTS GRID VIEW */}
            {activeView === 'artists' && (
              <div>
                <h2 className="text-3xl font-black text-white mb-6 tracking-tight">Artists</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {artistsList.map(artist => (
                    <div key={`artist-tab-${artist.name}`} onClick={() => { setSelectedArtist(artist.name); setActiveView('artistDetail'); }} className="bg-[#181818] hover:bg-[#282828] p-4 rounded-lg cursor-pointer transition-all group flex flex-col items-center text-center hover:scale-[1.02]">
                      <div className="w-36 h-36 rounded-full overflow-hidden shadow-xl mb-4 bg-[#282828] flex items-center justify-center relative">
                         <img src={artist.cover} alt={artist.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                         <button onClick={(e) => { 
                           e.stopPropagation(); 
                           const artistTracks = catalog.filter(t => t.artist?.split(/,|\&/).map(a => a.trim()).includes(artist.name));
                           handleShuffleList(artistTracks);
                         }} className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 bg-[#1DB954] text-black p-3 rounded-full shadow-2xl transition-all translate-y-2 group-hover:translate-y-0 hover:scale-110"><Play size={20} className="fill-current ml-0.5" /></button>
                      </div>
                      <h3 className="text-white font-bold text-base truncate w-full">{artist.name}</h3>
                      <p className="text-[#b3b3b3] text-sm mt-1">Artist • {artist.trackCount} track{artist.trackCount !== 1 ? 's' : ''}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 3. ALBUMS GRID VIEW */}
            {activeView === 'albums' && (
              <div>
                <h2 className="text-3xl font-black text-white mb-6 tracking-tight">Albums</h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {uniqueAlbums.map((album, idx) => {
                    const firstTrack = catalog.find(t => t.album === album);
                    return (
                      <div key={`album-tab-${idx}`} onClick={() => { setSelectedAlbum(album); setActiveView('albumDetail'); }} className="bg-[#181818] hover:bg-[#282828] p-4 rounded-lg cursor-pointer transition-all group hover:scale-[1.02]">
                        <div className="relative mb-4 aspect-square rounded-md overflow-hidden shadow-xl">
                          <img src={firstTrack?.cover} alt={album} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                          <button onClick={(e) => { 
                            e.stopPropagation(); 
                            const albumTracks = catalog.filter(t => t.album === album);
                            handleShuffleList(albumTracks);
                          }} className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 bg-[#1DB954] text-black p-3 rounded-full shadow-2xl transition-all translate-y-2 group-hover:translate-y-0 hover:scale-110"><Play size={20} className="fill-current ml-0.5" /></button>
                        </div>
                        <h3 className="text-white font-bold text-base truncate mb-1">{album}</h3>
                        <p className="text-[#b3b3b3] text-sm line-clamp-2">{firstTrack?.artist || 'Unknown Artist'}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ALBUM DETAIL PAGE */}
            {activeView === 'albumDetail' && selectedAlbum && activeAlbumTracks.length > 0 && (
              <div className="flex flex-col w-full pb-8">
                <div className="bg-gradient-to-b from-[#531515] to-[#1a1a1a] p-6 pb-8 flex items-end gap-6 relative shadow-inner">
                  <img src={activeAlbumTracks[0]?.cover} className="w-[232px] h-[232px] shadow-2xl object-cover" />
                  <div className="flex flex-col pb-2">
                    <span className="text-sm font-bold text-white mb-2">{activeAlbumTracks.length === 1 ? 'Single' : 'Album'}</span>
                    <h1 className="text-5xl md:text-7xl font-black text-white mb-6 tracking-tighter line-clamp-2">{selectedAlbum}</h1>
                    <div className="text-white text-sm font-medium flex items-center gap-1"><img src={activeAlbumTracks[0]?.cover} className="w-6 h-6 rounded-full inline-block mr-1" /><span onClick={() => { setSelectedArtist(activeAlbumTracks[0].artist.split(/,|\&/)[0].trim()); setActiveView('artistDetail'); }} className="font-bold hover:underline cursor-pointer">{activeAlbumTracks[0]?.artist}</span><span>•</span><span>{activeAlbumTracks[0]?.year}</span><span>•</span><span>{activeAlbumTracks.length} song{activeAlbumTracks.length !== 1 ? 's' : ''}, {Math.floor(totalAlbumDuration / 60)} min {totalAlbumDuration % 60} sec</span></div>
                  </div>
                </div>

                <div className="bg-gradient-to-b from-[#1a1a1a] to-[#121212] px-6 min-h-[500px]">
                  <div className="py-6 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                      <button onClick={() => handleShuffleList(activeAlbumTracks)} className="w-14 h-14 bg-[#1DB954] text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-xl"><Play size={28} className="fill-current ml-1" /></button>
                      <button onClick={() => handleShuffleList(activeAlbumTracks)} className="text-[#b3b3b3] hover:text-white transition-colors"><Shuffle size={32} /></button>
                      <button className="text-[#b3b3b3] hover:text-white transition-colors"><Plus size={32} /></button>
                      <button className="text-[#b3b3b3] hover:text-white transition-colors"><Download size={32} /></button>
                      <button className="text-[#b3b3b3] hover:text-white transition-colors"><MoreHorizontal size={32} /></button>
                    </div>
                    <button className="flex items-center gap-2 text-[#b3b3b3] hover:text-white text-sm font-bold transition-colors">List <List size={20} /></button>
                  </div>

                  <div className="flex items-center px-4 py-2 border-b border-white/10 text-[#b3b3b3] text-sm font-medium mb-4"><span className="w-8 text-right mr-4">#</span><span className="flex-1">Title</span><span className="w-12 flex justify-end"><Clock size={16} /></span></div>

                  <div className="flex flex-col pb-8">
                    {activeAlbumTracks.map((track, idx) => {
                      const isActive = currentTrack?.id === track.id;
                      return (
                        <div key={`album-track-${track.id}`} onClick={() => playSong(track)} onContextMenu={(e) => handleContextMenu(e, track)} className="flex items-center px-4 py-2 rounded-md hover:bg-white/10 cursor-pointer group transition-colors">
                          <div className="w-8 text-right mr-4 relative flex justify-end items-center"><span className={`text-base font-medium group-hover:invisible ${isActive ? 'text-[#1DB954]' : 'text-[#b3b3b3]'}`}>{idx + 1}</span><Play size={16} className={`absolute text-white invisible group-hover:visible ${isActive ? 'text-[#1DB954] fill-current' : ''}`} /></div>
                          <div className="flex-1 flex flex-col justify-center overflow-hidden"><span className={`font-medium text-base truncate ${isActive ? 'text-[#1DB954]' : 'text-white'}`}>{track.title}</span><span className="text-[#b3b3b3] text-sm truncate hover:underline hover:text-white w-fit">{track.artist}</span></div>
                          <button onClick={(e) => { e.stopPropagation(); toggleLike(track); }} className={`transition-colors w-12 flex justify-center ${likedSongs.includes(track.id) ? 'text-[#1DB954]' : 'text-[#b3b3b3] opacity-0 group-hover:opacity-100 hover:text-white'}`}><Heart size={16} className={likedSongs.includes(track.id) ? "fill-current" : ""} /></button>
                          <div className="w-12 text-right text-[#b3b3b3] text-sm font-medium">{formatTime(track.trackDuration)}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ARTIST DETAIL PAGE */}
            {activeView === 'artistDetail' && selectedArtist && (
              <div className="flex flex-col w-full pb-8">
                <div className="h-[300px] bg-gradient-to-b from-[#535353] to-[#121212] p-6 flex items-end gap-6 relative shadow-inner">
                  <img src={(artistImages[selectedArtist] && artistImages[selectedArtist] !== 'NOT_FOUND') ? artistImages[selectedArtist] : activeArtistTracks[0]?.cover} className="w-48 h-48 rounded-full shadow-2xl object-cover border-4 border-[#121212]" />
                  <div className="flex flex-col pb-2">
                    <span className="text-sm font-bold flex items-center gap-2 mb-2"><CheckCircle size={20} className="fill-[#3d91f4] text-white" /> Verified Artist</span>
                    <h1 className="text-6xl md:text-8xl font-black text-white mb-4 tracking-tighter">{selectedArtist}</h1>
                    <span className="text-white font-medium">{activeArtistTracks.length * 42385} monthly listeners</span>
                  </div>
                </div>

                <div className="px-6 py-4 flex items-center gap-6">
                  <button onClick={() => handleShuffleList(activeArtistTracks)} className="w-14 h-14 bg-[#1DB954] text-black rounded-full flex items-center justify-center hover:scale-105 transition-transform shadow-xl"><Play size={28} className="fill-current ml-1" /></button>
                  <button className="border border-[#b3b3b3] text-white px-4 py-1.5 rounded-full text-sm font-bold hover:border-white transition-colors">Follow</button>
                </div>

                <div className="px-6 py-4">
                  <h2 className="text-2xl font-bold text-white mb-4">Popular</h2>
                  <div className="flex flex-col">
                    {activeArtistTracks.slice(0, 5).map((track, idx) => (
                      <div key={`artist-pop-${track.id}`} onClick={() => playSong(track)} onContextMenu={(e) => handleContextMenu(e, track)} className="flex items-center gap-4 p-2 hover:bg-[#2a2a2a] rounded-md group cursor-pointer transition-colors">
                        <span className="text-[#b3b3b3] w-6 text-right font-medium group-hover:hidden">{idx + 1}</span>
                        <Play size={16} className="text-white w-6 text-right hidden group-hover:block" />
                        <img src={track.cover} className="w-10 h-10 rounded shadow bg-[#333]" />
                        <div className="flex-1 text-white font-medium truncate">{track.title}</div>
                        <button onClick={(e) => { e.stopPropagation(); toggleLike(track); }} className={`transition-colors mr-4 ${likedSongs.includes(track.id) ? 'text-[#1DB954]' : 'text-[#b3b3b3] opacity-0 group-hover:opacity-100 hover:text-white'}`}><Heart size={16} className={likedSongs.includes(track.id) ? "fill-current" : ""} /></button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="px-6 py-8">
                  <h2 className="text-2xl font-bold text-white mb-4">Discography</h2>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {activeArtistAlbums.map((album, idx) => {
                      const firstTrack = activeArtistTracks.find(t => t.album === album);
                      return (
                        <div key={`artist-album-${idx}`} onClick={() => { setSelectedAlbum(album); setActiveView('albumDetail'); }} className="bg-[#181818] hover:bg-[#282828] p-4 rounded-lg cursor-pointer transition-colors group">
                          <div className="relative mb-4 aspect-square rounded-md overflow-hidden shadow-lg"><img src={firstTrack?.cover} alt="" className="w-full h-full object-cover" /></div>
                          <h3 className="text-white font-bold text-base truncate mb-1">{album}</h3><p className="text-[#b3b3b3] text-sm line-clamp-2">Album</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* 4. HOME VIEW */}
            {activeView === 'home' && (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
                  {catalog.slice(0, 8).map(track => (
                    <div key={`grid-${track.id}`} onClick={() => playSong(track)} onContextMenu={(e) => handleContextMenu(e, track)} className="bg-white/5 hover:bg-white/20 transition-all flex items-center rounded overflow-hidden group cursor-pointer relative h-16">
                      <img src={track.cover} alt="" className="w-16 h-16 object-cover shadow-[4px_0_10px_rgba(0,0,0,0.3)] shrink-0" />
                      <span className="text-white font-bold text-sm px-4 line-clamp-2 pr-12">{track.title}</span>
                      <button onClick={(e) => { e.stopPropagation(); playSong(track); }} className="absolute right-3 opacity-0 group-hover:opacity-100 bg-[#1DB954] text-black p-3 rounded-full shadow-lg hover:scale-105 transition-all">
                        {currentTrack?.id === track.id && isPlaying ? <Pause size={16} className="fill-current" /> : <Play size={16} className="fill-current ml-0.5" />}
                      </button>
                    </div>
                  ))}
                </div>

                {/* ADAPTIVE RECOMMENDATIONS */}
                <div className="flex items-center justify-between mb-4 mt-8"><h2 className="text-2xl font-bold text-white flex items-center gap-2"><Sparkles size={24} className="text-[#1DB954]" /> Recommended For You</h2></div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-10">
                  {(recommendations.topPicks.length > 0 ? recommendations.topPicks.slice(0, 5) : catalog.slice(0, 5)).map(track => (
                    <div key={`top-pick-${track.id}`} onClick={() => playSong(track)} onContextMenu={(e) => handleContextMenu(e, track)} className="bg-[#181818] hover:bg-[#282828] p-4 rounded-lg cursor-pointer transition-colors group">
                      <div className="relative mb-4 aspect-square rounded-md overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                        <img src={track.cover} alt="" className="w-full h-full object-cover" />
                        <button onClick={(e) => { e.stopPropagation(); playSong(track); }} className={`absolute bottom-2 right-2 bg-[#1DB954] text-black p-3 rounded-full shadow-xl transition-all ${currentTrack?.id === track.id ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105'}`}>
                          {currentTrack?.id === track.id && isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-1" />}
                        </button>
                      </div>
                      <h3 className="text-white font-bold text-base truncate mb-1">{track.title}</h3><p className="text-[#b3b3b3] text-sm line-clamp-2">{track.artist}</p>
                    </div>
                  ))}
                </div>

                {/* DEEP CUTS */}
                {recommendations.deepCuts.length > 0 && (
                  <>
                    <div className="flex items-center justify-between mb-4 mt-10 border-t border-[#222] pt-8"><h2 className="text-2xl font-bold text-white flex items-center gap-2"><Flame size={24} className="text-amber-500" /> Deep Cuts & Unheard Gems</h2></div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-10">
                      {recommendations.deepCuts.slice(0, 5).map(track => (
                        <div key={`deep-${track.id}`} onClick={() => playSong(track)} onContextMenu={(e) => handleContextMenu(e, track)} className="bg-[#181818] hover:bg-[#282828] p-4 rounded-lg cursor-pointer transition-colors group">
                          <div className="relative mb-4 aspect-square rounded-md overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                            <img src={track.cover} alt="" className="w-full h-full object-cover" />
                            <button onClick={(e) => { e.stopPropagation(); playSong(track); }} className={`absolute bottom-2 right-2 bg-[#1DB954] text-black p-3 rounded-full shadow-xl transition-all ${currentTrack?.id === track.id ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105'}`}>
                              {currentTrack?.id === track.id && isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-1" />}
                            </button>
                          </div>
                          <h3 className="text-white font-bold text-base truncate mb-1">{track.title}</h3><p className="text-[#b3b3b3] text-sm line-clamp-2">{track.artist}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* REDISCOVERY */}
                {recommendations.rediscovery.length > 0 && (
                  <>
                    <div className="flex items-center justify-between mb-4 mt-10 border-t border-[#222] pt-8"><h2 className="text-2xl font-bold text-white">Jump Back In</h2></div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 mb-8">
                      {recommendations.rediscovery.slice(0, 5).map(track => (
                        <div key={`rediscover-${track.id}`} onClick={() => playSong(track)} onContextMenu={(e) => handleContextMenu(e, track)} className="bg-[#181818] hover:bg-[#282828] p-4 rounded-lg cursor-pointer transition-colors group">
                          <div className="relative mb-4 aspect-square rounded-md overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                            <img src={track.cover} alt="" className="w-full h-full object-cover" />
                            <button onClick={(e) => { e.stopPropagation(); playSong(track); }} className={`absolute bottom-2 right-2 bg-[#1DB954] text-black p-3 rounded-full shadow-xl transition-all ${currentTrack?.id === track.id ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 hover:scale-105'}`}>
                              {currentTrack?.id === track.id && isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-1" />}
                            </button>
                          </div>
                          <h3 className="text-white font-bold text-base truncate mb-1">{track.title}</h3><p className="text-[#b3b3b3] text-sm line-clamp-2">{track.artist}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* RIGHT PANEL: LYRICS OR QUEUE OR NOW PLAYING */}
        {rightPanel === 'nowPlaying' && currentTrack && (
          <div className="w-[320px] bg-[#121212] rounded-lg flex flex-col shrink-0 overflow-y-auto custom-scrollbar p-4">
            <div className="flex justify-between items-center mb-4">
               <h2 className="text-white font-bold text-sm truncate pr-4">{currentTrack.album}</h2>
               <button onClick={() => setRightPanel('none')} className="text-[#b3b3b3] hover:text-white shrink-0"><X size={20}/></button>
            </div>
            <img src={currentTrack.cover} className="w-full aspect-square rounded-lg mb-4 object-cover shadow-xl" />
            <div className="flex justify-between items-start mb-6">
              <div className="overflow-hidden">
                <h2 className="text-2xl font-bold text-white mb-1 leading-tight truncate">{currentTrack.title}</h2>
                <p className="text-[#b3b3b3] text-sm truncate">{currentTrack.artist}</p>
              </div>
              <button onClick={() => toggleLike(currentTrack)} className="text-[#b3b3b3] hover:text-white mt-1 shrink-0 ml-2">
                <Heart size={20} className={likedSongs.includes(currentTrack.id) ? "fill-[#1DB954] text-[#1DB954]" : ""} />
              </button>
            </div>
            <div className="bg-[#242424] rounded-lg p-4 mb-4">
              <h3 className="text-white font-bold mb-3 text-sm">Credits</h3>
              <div className="flex justify-between items-center">
                <div className="overflow-hidden">
                  <p className="text-white text-sm font-bold truncate">{currentTrack.artist}</p>
                  <p className="text-[#b3b3b3] text-xs">Main Artist</p>
                </div>
                <button className="border border-[#b3b3b3] text-white text-xs font-bold px-3 py-1 rounded-full hover:border-white transition-colors shrink-0">Following</button>
              </div>
            </div>
          </div>
        )}

        {rightPanel === 'lyrics' && (
          <div className="w-[320px] bg-[#121212] rounded-lg flex flex-col shrink-0">
             <div className="p-4 flex items-center justify-between">
              <h2 className="text-white font-bold">Lyrics</h2>
              <button onClick={() => setRightPanel('none')} className="text-[#b3b3b3] hover:text-white"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-32 space-y-6 custom-scrollbar">
              {lyrics.length === 0 && <p className="text-[#B3B3B3] text-sm">No lyrics found.</p>}
              {lyrics.map((lyric, idx) => {
                const isActive = idx === activeLyricIndex;
                return <p key={idx} id={`lyric-${idx}`} onClick={() => { if (audioRef.current) audioRef.current.currentTime = lyric.time; }} className={`text-xl font-bold transition-all duration-300 cursor-pointer mb-6 ${isActive ? 'text-white text-2xl' : 'text-[#5a5a5a] hover:text-[#b3b3b3]'}`}>{lyric.text}</p>
              })}
            </div>
          </div>
        )}

        {rightPanel === 'queue' && (
          <div className="w-[320px] bg-[#121212] rounded-lg flex flex-col shrink-0">
            <div className="p-4 flex items-center justify-between border-b border-white/10">
              <h2 className="text-white font-bold">Queue</h2>
              <button onClick={() => setRightPanel('none')} className="text-[#b3b3b3] hover:text-white"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
              <h3 className="text-white font-bold mb-4">Now Playing</h3>
              {currentTrack && (
                <div onContextMenu={(e) => handleContextMenu(e, currentTrack)} className="flex items-center gap-3 p-2 rounded-md bg-[#2a2a2a] cursor-pointer">
                  <img src={currentTrack.cover} alt="" className="w-12 h-12 rounded object-cover shrink-0" />
                  <div className="flex flex-col justify-center overflow-hidden"><span className="font-bold text-base text-[#1DB954] truncate">{currentTrack.title}</span><span className="text-sm text-[#b3b3b3] truncate">{currentTrack.artist}</span></div>
                </div>
              )}

              {queue.length > 0 && (
                <>
                  <h3 className="text-white font-bold mt-6 mb-4">Next Up</h3>
                  {queue.map((track, idx) => (
                     <div key={`q-${idx}`} onDoubleClick={() => playFromQueue(idx)} onContextMenu={(e) => handleContextMenu(e, track, idx)} className="flex items-center gap-3 p-2 rounded-md hover:bg-white/10 group cursor-pointer">
                        <span className="text-[#b3b3b3] text-sm w-4">{idx + 1}</span>
                        <img src={track.cover} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                        <div className="flex flex-col justify-center overflow-hidden flex-1"><span className="font-bold text-sm text-white truncate">{track.title}</span><span className="text-xs text-[#b3b3b3] truncate">{track.artist}</span></div>
                        <button onClick={(e) => removeFromQueue(e, idx)} className="text-[#b3b3b3] opacity-0 group-hover:opacity-100 hover:text-white transition-opacity"><X size={16}/></button>
                     </div>
                  ))}
                </>
              )}

              {queue.length === 0 && (
                 <>
                  <h3 className="text-white font-bold mt-8 mb-2 flex items-center gap-2"><Sparkles size={18} className="text-[#1DB954]" /> Auto-Play</h3>
                  <p className="text-[#b3b3b3] text-xs mb-4">Dynamically picking similar tracks based on your listening habits.</p>
                  {recommendations.topPicks.filter(t => t.id !== currentTrack?.id).slice(0, 10).map((track, idx) => (
                     <div key={`auto-${idx}`} onDoubleClick={() => playSong(track)} onContextMenu={(e) => handleContextMenu(e, track)} className="flex items-center gap-3 p-2 rounded-md hover:bg-white/10 opacity-70 hover:opacity-100 transition-opacity cursor-pointer group">
                        <img src={track.cover} alt="" className="w-10 h-10 rounded object-cover shrink-0" />
                        <div className="flex flex-col justify-center overflow-hidden"><span className="font-bold text-sm text-white truncate">{track.title}</span><span className="text-xs text-[#b3b3b3] truncate">{track.artist}</span></div>
                     </div>
                  ))}
                 </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM PLAYER BAR */}
      <div className="h-[90px] bg-black flex items-center justify-between px-4 shrink-0 z-40 relative border-t border-[#333]">
        <div className="flex items-center w-[30%] min-w-[180px]">
          {currentTrack && (
            <>
              <img src={currentTrack.cover} alt="cover" className="w-[56px] h-[56px] rounded mr-4 object-cover" />
              <div className="flex flex-col mr-4 overflow-hidden">
                <span className="text-sm font-bold text-white hover:underline cursor-pointer truncate">{currentTrack.title}</span>
                <span onClick={() => { setSelectedArtist(currentTrack.artist.split(/,|\&/)[0].trim()); setActiveView('artistDetail'); }} className="text-xs text-[#b3b3b3] hover:underline hover:text-white cursor-pointer truncate mt-0.5">{currentTrack.artist}</span>
              </div>
              <button onClick={() => toggleLike(currentTrack)} className={`transition-colors ${likedSongs.includes(currentTrack.id) ? 'text-[#1DB954]' : 'text-[#b3b3b3] hover:text-white'} mr-4`}><Heart size={16} className={likedSongs.includes(currentTrack.id) ? "fill-current" : ""} /></button>
            </>
          )}
        </div>

        <div className="flex flex-col items-center justify-center w-[40%] max-w-2xl px-4">
          <div className="flex items-center gap-6 mb-2">
            <button onClick={playPrevious} className="text-[#b3b3b3] hover:text-white transition-colors"><SkipBack size={20} className="fill-current" /></button>
            <button onClick={togglePlayPause} disabled={!currentTrack} className={`w-8 h-8 flex items-center justify-center bg-white rounded-full text-black hover:scale-105 transition-transform ${!currentTrack && 'opacity-50 cursor-not-allowed'}`}>
              {isPlaying ? <Pause size={16} className="fill-current" /> : <Play size={16} className="fill-current ml-1" />}
            </button>
            <button onClick={playNext} className="text-[#b3b3b3] hover:text-white transition-colors"><SkipForward size={20} className="fill-current" /></button>
          </div>
          <div className="flex items-center gap-2 w-full group">
            <span className="text-xs text-[#b3b3b3] min-w-[40px] text-right font-medium">{formatTime(progress)}</span>
            <div className="h-1 flex-1 bg-[#4d4d4d] rounded-full cursor-pointer relative group-hover:h-3 transition-all flex items-center" onClick={(e) => {
                if (!audioRef.current || !duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                audioRef.current.currentTime = ((e.clientX - rect.left) / rect.width) * duration;
              }}>
              <div className="absolute left-0 h-1 group-hover:h-3 bg-white group-hover:bg-[#1DB954] rounded-full" style={{ width: `${duration ? (progress / duration) * 100 : 0}%` }} />
            </div>
            <span className="text-xs text-[#b3b3b3] min-w-[40px] font-medium">{formatTime(duration)}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-4 w-[30%] min-w-[180px]">
          <button onClick={() => setRightPanel(rightPanel === 'nowPlaying' ? 'none' : 'nowPlaying')} className={`transition-colors ${rightPanel === 'nowPlaying' ? 'text-[#1DB954]' : 'text-[#b3b3b3] hover:text-white'}`}><PlaySquare size={16} /></button>
          <button onClick={() => setRightPanel(rightPanel === 'lyrics' ? 'none' : 'lyrics')} className={`transition-colors ${rightPanel === 'lyrics' ? 'text-[#1DB954]' : 'text-[#b3b3b3] hover:text-white'}`}><Mic2 size={16} /></button>
          <button onClick={() => setRightPanel(rightPanel === 'queue' ? 'none' : 'queue')} className={`transition-colors ${rightPanel === 'queue' ? 'text-[#1DB954]' : 'text-[#b3b3b3] hover:text-white'}`}><ListMusic size={16} /></button>
          <div className="flex items-center gap-2 group w-24 relative">
            <Volume2 size={16} className="text-[#b3b3b3]" />
            <input type="range" min="0" max="1" step="0.01" value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="absolute w-full h-full opacity-0 cursor-pointer z-10" />
            <div className="h-1 flex-1 bg-[#4d4d4d] rounded-full relative group-hover:h-3 transition-all flex items-center pointer-events-none">
              <div className="absolute left-0 h-full bg-white group-hover:bg-[#1DB954] rounded-full" style={{ width: `${volume * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}