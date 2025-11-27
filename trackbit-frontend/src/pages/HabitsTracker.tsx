import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Flame, Trophy, Calendar, Activity, CheckCircle2, Plus, Minus, X, Dumbbell, Clock, HeartPulse, ChevronDown, ChevronUp, Trash2, Save } from 'lucide-react';

// --- Utility Functions ---

const generateData = (habitId, intensity = 'medium') => {
  const data = {};
  const today = new Date();
  
  for (let i = 0; i < 365; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = formatDate(date);
    
    if (habitId === 'exercise') {
      data[dateStr] = [];
    } else {
      let value = 0;
      const rand = Math.random();
      if (intensity === 'high') {
        value = rand > 0.2 ? Math.floor(Math.random() * 4) + 1 : 0;
      } else if (intensity === 'low') {
        value = rand > 0.7 ? Math.floor(Math.random() * 2) + 1 : 0;
      } else {
        value = rand > 0.5 ? Math.floor(Math.random() * 3) + 1 : 0;
      }
      data[dateStr] = value;
    }
  }
  return data;
};

const getCalendarDates = () => {
  const dates = [];
  const today = new Date();
  const totalDays = 53 * 7;
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + (6 - today.getDay())); 
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - totalDays + 1);

  let current = new Date(startDate);
  while (current <= endDate) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
};

const formatDate = (date) => {
  return date.toISOString().split('T')[0];
};

const getIntensityColor = (value, baseColor = 'emerald') => {
  if (value === 0) return 'bg-slate-100 dark:bg-slate-800';
  const colors = {
    emerald: ['bg-emerald-200', 'bg-emerald-400', 'bg-emerald-600', 'bg-emerald-800'],
    blue: ['bg-blue-200', 'bg-blue-400', 'bg-blue-600', 'bg-blue-800'],
    violet: ['bg-violet-200', 'bg-violet-400', 'bg-violet-600', 'bg-violet-800'],
    orange: ['bg-orange-200', 'bg-orange-400', 'bg-orange-600', 'bg-orange-800'],
  };
  const palette = colors[baseColor] || colors.emerald;
  return palette[Math.min(value, 4) - 1] || palette[3];
};


// --- Sub-Components ---

const SessionSummaryDisplay = ({ session }) => {
  if (session.type === 'weight') {
    const totalSets = session.sets.length;
    const weights = session.sets.map(s => s.weight).filter(w => w > 0);
    const maxWeight = weights.length > 0 ? Math.max(...weights) : 0;
    const unit = session.weightUnit || 'kg';

    return (
      <div className="text-xs text-slate-500 dark:text-slate-400 flex gap-3">
        <span className="font-semibold">{totalSets} Sets</span>
        {maxWeight > 0 && <span>Max: {maxWeight}{unit}</span>}
      </div>
    );
  }
  if (session.type === 'cardio') {
    return (
      <div className="text-xs text-slate-500 dark:text-slate-400">
        <span className="font-semibold">{session.distance} {session.unit}</span>
        <span className="mx-2">•</span>
        <span>{session.time} min</span>
      </div>
    );
  }
  return null;
};

// Custom input field with +/- buttons
const SetInputField = ({ value, onChange, placeholder, isReps }) => {
    const increment = () => onChange((value || 0) + 1);
    const decrement = () => onChange(Math.max(0, (value || 0) - 1));
    
    const inputStyle = `
        input[type="number"].no-spinner::-webkit-inner-spin-button, 
        input[type="number"].no-spinner::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
        input[type="number"].no-spinner {
            -moz-appearance: textfield; /* Firefox */
        }
    `;

    return (
        <>
            <style>{inputStyle}</style>
            <div className={`flex items-stretch w-full rounded-md overflow-hidden border border-slate-300 dark:border-slate-600 shadow-inner ${isReps ? 'h-7' : 'h-6'}`}>
                <button onClick={decrement} className="flex-none w-5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 flex items-center justify-center border-r border-slate-300 dark:border-slate-600" disabled={value <= 0} tabIndex="-1">
                    <Minus className={`w-2 h-2 ${isReps ? 'text-blue-500' : 'text-slate-500'}`} />
                </button>
                <input type="number" value={value || ''} min="0" onChange={(e) => onChange(Number(e.target.value))} placeholder={placeholder} className={`flex-1 min-w-0 text-center bg-transparent dark:text-white focus:outline-none no-spinner ${isReps ? 'text-sm font-bold' : 'text-xs'}`} />
                <button onClick={increment} className="flex-none w-5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center border-l border-slate-300 dark:border-slate-600" tabIndex="-1">
                    <Plus className={`w-2 h-2 ${isReps ? 'text-blue-500' : 'text-slate-500'}`} />
                </button>
            </div>
        </>
    );
};

// Reusable Form Component for both Editing and Creating
const SessionForm = ({ formData, sessionType, handleInputChange, handleSessionTypeChange, handleWeightUnitChange, handleSetChange, addSet, removeSet, onSave, onCancel, onDelete, isNew }) => {
    return (
        <div className="space-y-4 animate-in fade-in duration-200">
             {/* Type Selector */}
             <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg shadow-sm w-fit border border-slate-200 dark:border-slate-700">
                <button onClick={() => handleSessionTypeChange('weight')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${sessionType === 'weight' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white font-bold' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                    <Dumbbell className="w-3 h-3" /> Weights
                </button>
                <button onClick={() => handleSessionTypeChange('cardio')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${sessionType === 'cardio' ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white font-bold' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'}`}>
                    <Clock className="w-3 h-3" /> Cardio
                </button>
            </div>

            <input type="text" name="name" value={formData.name} onChange={handleInputChange} placeholder={sessionType === 'weight' ? "Exercise Name (e.g., Squats)" : "Activity Name (e.g., Running)"} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-800 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none" autoFocus />
        
            {sessionType === 'weight' && (
                <div className="space-y-3 mt-2">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Unit:</span>
                        <select name="weightUnit" value={formData.weightUnit} onChange={handleWeightUnitChange} className="text-sm py-1 px-2 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 dark:text-white outline-none">
                            <option value="kg">kg</option>
                            <option value="lbs">lbs</option>
                        </select>
                    </div>

                    <div className="flex justify-start text-[10px] font-bold text-slate-400 pl-1 uppercase tracking-wider">
                        <span className="inline-flex items-center gap-1 mr-4"><span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span> Reps</span>
                        <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Weight</span>
                    </div>
                    
                    <div className="flex overflow-x-auto space-x-2 pb-2">
                        {formData.sets.map((set, index) => (
                            <div key={index} className="flex-none w-24 bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex flex-col items-center">
                                <div className="flex justify-between items-center w-full mb-2">
                                    <span className="font-bold text-[10px] text-slate-400 uppercase">Set {index + 1}</span>
                                    <button onClick={() => removeSet(index)} disabled={formData.sets.length === 1} className="text-slate-300 hover:text-red-500 disabled:opacity-0 transition-colors">
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="flex flex-col gap-1.5 w-full">
                                    <SetInputField value={set.reps} onChange={(val) => handleSetChange(index, 'reps', val)} placeholder="0" isReps={true} />
                                    <SetInputField value={set.weight} onChange={(val) => handleSetChange(index, 'weight', val)} placeholder="0" isReps={false} />
                                </div>
                            </div>
                        ))}
                        
                        <button onClick={addSet} className="flex-none w-12 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 text-slate-400 hover:text-blue-500 transition-colors bg-slate-50 dark:bg-slate-800/50" title="Add Set">
                            <Plus className="w-5 h-5" />
                            <span className="text-[10px] font-medium">Add</span>
                        </button>
                    </div>
                </div>
            )}

            {sessionType === 'cardio' && (
                <div className="grid grid-cols-3 gap-3">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Time (min)</label>
                        <input type="number" name="time" value={formData.time} onChange={handleInputChange} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md dark:bg-slate-800 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Distance</label>
                        <input type="number" name="distance" value={formData.distance} onChange={handleInputChange} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md dark:bg-slate-800 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Unit</label>
                        <select name="unit" value={formData.unit} onChange={handleInputChange} className="w-full p-2 border border-slate-300 dark:border-slate-600 rounded-md dark:bg-slate-800 dark:text-white">
                            <option value="km">km</option>
                            <option value="miles">miles</option>
                        </select>
                    </div>
                </div>
            )}

            <div className="flex gap-3 pt-2">
                <button onClick={onSave} disabled={formData.name.trim() === ''} className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold bg-blue-600 hover:bg-blue-700 text-white disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors shadow-sm">
                    <Save className="w-4 h-4" /> {isNew ? 'Log Session' : 'Save Changes'}
                </button>
                {isNew ? (
                    <button onClick={onCancel} className="px-4 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100 border border-slate-200 transition-colors">
                        Cancel
                    </button>
                ) : (
                    <button onClick={onDelete} className="px-4 py-2 rounded-lg font-medium text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-colors" title="Delete Session">
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );
};


const ExerciseSessionPanel = ({ dateStr, sessions, updateSessions, onClose }) => {
  const defaultSet = { reps: 10, weight: 100 };
  
  // 'NEW' string indicates creating a new session, ID string indicates editing that session, null means list view
  const [editingId, setEditingId] = useState(null); 
  
  const [sessionType, setSessionType] = useState('weight');
  const [formData, setFormData] = useState({
    name: '',
    type: 'weight',
    sets: [ {...defaultSet}, {...defaultSet}, {...defaultSet}, {...defaultSet} ], 
    weightUnit: 'kg', 
    time: 30,
    distance: 5,
    unit: 'km'
  });

  // Populate form when editingId changes
  useEffect(() => {
    if (editingId && editingId !== 'NEW') {
      const sessionToEdit = sessions.find(s => s.id === editingId);
      if (sessionToEdit) {
        setFormData({
            name: sessionToEdit.name,
            type: sessionToEdit.type,
            sets: sessionToEdit.type === 'weight' ? sessionToEdit.sets : [ {...defaultSet} ],
            weightUnit: sessionToEdit.weightUnit || 'kg',
            time: sessionToEdit.time || 30,
            distance: sessionToEdit.distance || 5,
            unit: sessionToEdit.unit || 'km'
        });
        setSessionType(sessionToEdit.type);
      }
    } else if (editingId === 'NEW') {
        // Reset to default for new session
        setFormData({
            name: '',
            type: 'weight',
            sets: [ {...defaultSet}, {...defaultSet}, {...defaultSet}, {...defaultSet} ],
            weightUnit: 'kg',
            time: 30,
            distance: 5,
            unit: 'km'
        });
        setSessionType('weight');
    }
  }, [editingId, sessions]);


  // --- Form Handlers ---
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: ['time', 'distance'].includes(name) ? Number(value) : value }));
  };
    
  const handleWeightUnitChange = (e) => setFormData(prev => ({ ...prev, weightUnit: e.target.value }));
  const handleSetChange = (index, field, value) => {
    const updatedSets = formData.sets.map((set, i) => i === index ? { ...set, [field]: Number(value) } : set);
    setFormData(prev => ({ ...prev, sets: updatedSets }));
  };

  const addSet = () => {
    const lastSet = formData.sets[formData.sets.length - 1];
    const newSet = lastSet ? { ...lastSet } : { ...defaultSet };
    setFormData(prev => ({ ...prev, sets: [...prev.sets, newSet] }));
  };

  const removeSet = (index) => {
    if (formData.sets.length > 1) {
        setFormData(prev => ({ ...prev, sets: prev.sets.filter((_, i) => i !== index) }));
    }
  };

  const handleSessionTypeChange = (type) => {
    setSessionType(type);
    setFormData(prev => ({ ...prev, type }));
  };

  const saveSession = () => {
    if (formData.name.trim() === '') return;
    
    let sessionPayload;
    if (sessionType === 'weight') {
      const recordedSets = formData.sets.filter(set => set.reps > 0 && set.weight > 0);
      if (recordedSets.length === 0) return; 
      sessionPayload = {
          id: editingId === 'NEW' ? Date.now() + Math.random() : editingId,
          name: formData.name,
          type: 'weight',
          sets: recordedSets,
          weightUnit: formData.weightUnit
      };
    } else {
      sessionPayload = {
          id: editingId === 'NEW' ? Date.now() + Math.random() : editingId,
          name: formData.name,
          type: 'cardio',
          time: formData.time,
          distance: formData.distance,
          unit: formData.unit
      };
    }

    const newSessionsList = editingId === 'NEW' 
        ? [...sessions, sessionPayload] 
        : sessions.map(s => s.id === editingId ? sessionPayload : s);

    updateSessions(dateStr, newSessionsList);
    setEditingId(null);
  };

  const deleteSession = () => {
      if (editingId && editingId !== 'NEW') {
          updateSessions(dateStr, sessions.filter(s => s.id !== editingId));
          setEditingId(null);
      }
  };

  const todayStr = formatDate(new Date());

  return (
    <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50">
      
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex flex-col">
          Session Log
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
            {new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </h3>
        <button onClick={onClose} className="p-2 rounded-full text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col space-y-3">
        {/* List of Existing Sessions */}
        {sessions.map((session) => (
            <div key={session.id} className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
                {editingId === session.id ? (
                    /* Expanded Edit View */
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/50">
                         <div className="flex justify-between items-center mb-4">
                            <h4 className="font-bold text-sm text-slate-500 uppercase tracking-wider">Editing Session</h4>
                            <button onClick={() => setEditingId(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-4 h-4" />
                            </button>
                         </div>
                         <SessionForm 
                            formData={formData} 
                            sessionType={sessionType}
                            handleInputChange={handleInputChange}
                            handleSessionTypeChange={handleSessionTypeChange}
                            handleWeightUnitChange={handleWeightUnitChange}
                            handleSetChange={handleSetChange}
                            addSet={addSet}
                            removeSet={removeSet}
                            onSave={saveSession}
                            onCancel={() => setEditingId(null)} // Cancel just collapses
                            onDelete={deleteSession}
                            isNew={false}
                         />
                    </div>
                ) : (
                    /* Collapsed Summary View */
                    <div 
                        onClick={() => setEditingId(session.id)}
                        className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                        <div>
                            <div className="font-bold text-slate-900 dark:text-slate-100">{session.name}</div>
                            <SessionSummaryDisplay session={session} />
                        </div>
                        <ChevronDown className="w-5 h-5 text-slate-400" />
                    </div>
                )}
            </div>
        ))}

        {/* Add New Session Area */}
        {editingId === 'NEW' ? (
            <div className="border border-blue-200 dark:border-blue-900 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                 <h4 className="font-bold text-sm text-blue-600 mb-4 uppercase tracking-wider">New Workout Session</h4>
                 <SessionForm 
                    formData={formData} 
                    sessionType={sessionType}
                    handleInputChange={handleInputChange}
                    handleSessionTypeChange={handleSessionTypeChange}
                    handleWeightUnitChange={handleWeightUnitChange}
                    handleSetChange={handleSetChange}
                    addSet={addSet}
                    removeSet={removeSet}
                    onSave={saveSession}
                    onCancel={() => setEditingId(null)}
                    isNew={true}
                 />
            </div>
        ) : (
            <button
                onClick={() => setEditingId('NEW')}
                className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-blue-400 text-slate-400 font-medium transition-all flex items-center justify-center gap-2"
            >
                <Plus className="w-5 h-5" /> Add Workout Session
            </button>
        )}
      </div>

      {sessions.length === 0 && editingId !== 'NEW' && (
        <div className="text-center py-8 text-slate-400">
            <Dumbbell className="w-8 h-8 mx-auto mb-2 opacity-20" />
            <p className="text-sm">No sessions logged for this day yet.</p>
        </div>
      )}

    </div>
  );
};

// ... SimpleHabitPanel and HabitTracker components remain mostly the same ...
// Re-exporting main component to ensure file completeness

// The simple habit viewing/adjustment panel
const SimpleHabitPanel = ({ dateStr, value, color, updateCount, onClose }) => {
  return (
    <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-between items-center min-h-[72px] animate-in fade-in slide-in-from-left-4 duration-200">
      <div className="flex flex-col">
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {new Date(dateStr).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </span>
        <span className="text-slate-500 text-xs">
          {value} completions recorded (Intensity: {value}/4)
        </span>
      </div>

      <div className="flex items-center gap-4">
        {/* Manual Adjustment Controls */}
        <div className="flex items-center gap-1 bg-white dark:bg-slate-700 rounded-lg p-1 border border-slate-200 dark:border-slate-600 shadow-sm">
          <button 
            onClick={() => updateCount(value - 1)}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-600 rounded text-slate-500 hover:text-slate-900 dark:text-slate-300"
          >
            <Minus className="w-3 h-3" />
          </button>
          <span className="w-6 text-center text-xs font-mono font-bold">{value}</span>
          <button 
            onClick={() => updateCount(value + 1)}
            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-600 rounded text-slate-500 hover:text-slate-900 dark:text-slate-300"
          >
            <Plus className="w-3 h-3" />
          </button>
        </div>
        
        <button 
          onClick={onClose}
          className="p-2 rounded-full text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

// --- Main Habit Tracker Component ---

const HabitTracker = () => {
  const [selectedHabit, setSelectedHabit] = useState('exercise'); // Default to exercise for demo
  const [habitData, setHabitData] = useState({
    reading: generateData('reading', 'medium'),
    exercise: generateData('exercise'), // Stores sessions array for each day
    coding: generateData('coding', 'high'),
  });
  const [showWeekHigh, setShowWeekHigh] = useState(false);
  const [hoveredDate, setHoveredDate] = useState(null);
  const [selectedDay, setSelectedDay] = useState(formatDate(new Date())); // Default to today's date

  const habits = [
    { id: 'reading', label: 'Reading', color: 'blue', icon: <Calendar className="w-4 h-4" /> },
    { id: 'exercise', label: 'Exercise', color: 'orange', icon: <HeartPulse className="w-4 h-4" /> },
    { id: 'coding', label: 'Coding', color: 'emerald', icon: <CheckCircle2 className="w-4 h-4" /> },
  ];

  const currentHabit = habits.find(h => h.id === selectedHabit);
  const currentData = habitData[selectedHabit];
  const todayStr = formatDate(new Date());

  // Function to get the display value (number of sessions or count)
  const getDisplayValue = useCallback((dateStr) => {
    const data = currentData[dateStr];
    if (selectedHabit === 'exercise') {
      return Array.isArray(data) ? data.length : 0;
    }
    return data || 0;
  }, [currentData, selectedHabit]);

  // Process data for the grid
  const calendarDates = useMemo(() => getCalendarDates(), []);
  
  // Group by weeks for the grid structure
  const weeks = useMemo(() => {
    const w = [];
    let currentWeek = [];
    calendarDates.forEach((date) => {
      currentWeek.push(date);
      if (currentWeek.length === 7) {
        w.push(currentWeek);
        currentWeek = [];
      }
    });
    return w;
  }, [calendarDates]);

  // Calculate Stats (re-runs when habitData changes)
  const stats = useMemo(() => {
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let totalCount = 0;
    
    // Calculate current streak backward from today
    let d = new Date();
    while (true) {
      const str = formatDate(d);
      const value = getDisplayValue(str);

      if (value > 0) {
        currentStreak++;
        d.setDate(d.getDate() - 1);
      } else if (str === todayStr && value === 0) {
        // Check yesterday if today is zero
        d.setDate(d.getDate() - 1);
        continue;
      } else {
        break;
      }
    }

    // Calculate total count and longest streak
    const sortedDates = Object.keys(habitData[selectedHabit]).sort();
    sortedDates.forEach(dateStr => {
      const value = getDisplayValue(dateStr);
      if (value > 0) {
        totalCount += value;
        tempStreak++;
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 0;
      }
    });
    longestStreak = Math.max(longestStreak, tempStreak);

    return { 
      currentStreak, 
      longestStreak, 
      totalCount
    };
  }, [getDisplayValue, habitData, selectedHabit, todayStr]);

  // Identify "Week Highs"
  const bestWeekIndex = useMemo(() => {
    let maxScore = -1;
    let bestIdx = -1;

    weeks.forEach((week, idx) => {
      const weekScore = week.reduce((acc, date) => acc + getDisplayValue(formatDate(date)), 0);
      if (weekScore > maxScore) {
        maxScore = weekScore;
        bestIdx = idx;
      }
    });
    return bestIdx;
  }, [weeks, getDisplayValue]);

  // --- Interaction Handlers ---
  
  // For simple habits (Reading/Coding): updates count
  const updateSimpleCount = (dateStr, val) => {
    const newValue = Math.max(0, Math.min(4, val)); // Clamp between 0 and 4
    setHabitData(prev => ({
      ...prev,
      [selectedHabit]: {
        ...prev[selectedHabit],
        [dateStr]: newValue
      }
    }));
  };
  
  // For Exercise: handles session array updates
  const updateExerciseSessions = (dateStr, sessions) => {
    setHabitData(prev => ({
      ...prev,
      [selectedHabit]: {
        ...prev[selectedHabit],
        [dateStr]: sessions
      }
    }));
  };

  // Main click handler for cells
  const handleCellClick = (dateStr) => {
    setSelectedDay(dateStr);
  };

  // Quick Log button handler (Only for simple habits now)
  const handleQuickLog = () => {
    if (selectedHabit !== 'exercise') {
      updateSimpleCount(todayStr, (currentData[todayStr] || 0) + 1);
      setSelectedDay(todayStr); // Select today if quick logged
    } else {
      // For exercise, clicking quick log will just select today
      setSelectedDay(todayStr);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Flame className="w-8 h-8 text-orange-500 fill-orange-500" />
              Momentum Tracker
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Visualize your consistency across different habits.</p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
              {habits.map(habit => (
                <button
                  key={habit.id}
                  onClick={() => { setSelectedHabit(habit.id); setSelectedDay(todayStr); }} // Reset selection to today on habit switch
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                    selectedHabit === habit.id 
                      ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm' 
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                  }`}
                >
                  {habit.icon}
                  {habit.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard 
            title="Current Streak" 
            value={`${stats.currentStreak} Days`} 
            icon={<Flame className="w-5 h-5 text-orange-500" />}
            trend="Keep it burning!"
          />
          <StatCard 
            title="Best Streak" 
            value={`${stats.longestStreak} Days`} 
            icon={<Trophy className="w-5 h-5 text-yellow-500" />}
            trend="All time high"
          />
          <StatCard 
            title="Total Completions" 
            value={stats.totalCount} 
            icon={<CheckCircle2 className="w-5 h-5 text-emerald-500" />}
            trend={selectedHabit === 'exercise' ? "Total Sessions logged" : "Total activities recorded"}
          />
        </div>

        {/* Heatmap Section */}
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Activity className="w-5 h-5 text-slate-400" />
              {currentHabit.label} Activity Log
            </h2>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                <input 
                  type="checkbox" 
                  checked={showWeekHigh}
                  onChange={(e) => setShowWeekHigh(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-900" 
                />
                Highlight Best Week
              </label>
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <span>Less</span>
                <div className="w-3 h-3 rounded-sm bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700"></div>
                <div className={`w-3 h-3 rounded-sm ${getIntensityColor(1, currentHabit.color)}`}></div>
                <div className={`w-3 h-3 rounded-sm ${getIntensityColor(2, currentHabit.color)}`}></div>
                <div className={`w-3 h-3 rounded-sm ${getIntensityColor(3, currentHabit.color)}`}></div>
                <div className={`w-3 h-3 rounded-sm ${getIntensityColor(4, currentHabit.color)}`}></div>
                <span>More</span>
              </div>
            </div>
          </div>
          
          <div className="p-6 overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Heatmap Grid Container */}
              <div className="flex gap-1">
                {/* Day Labels Column */}
                <div className="flex flex-col gap-1 pr-2 pt-6 text-xs text-slate-400 font-medium">
                  <span className="h-3 leading-3">Mon</span>
                  <span className="h-3 leading-3 opacity-0">Tue</span>
                  <span className="h-3 leading-3">Wed</span>
                  <span className="h-3 leading-3 opacity-0">Thu</span>
                  <span className="h-3 leading-3">Fri</span>
                  <span className="h-3 leading-3 opacity-0">Sat</span>
                  <span className="h-3 leading-3">Sun</span>
                </div>

                {/* Weeks Columns */}
                <div className="flex gap-1 flex-1">
                  {weeks.map((week, weekIdx) => {
                    const isBestWeek = showWeekHigh && weekIdx === bestWeekIndex;
                    
                    return (
                      <div key={weekIdx} className={`flex flex-col gap-1 relative group/week ${isBestWeek ? 'z-10' : ''}`}>
                        {/* Month Label */}
                        <div className="h-5 text-[10px] text-slate-400 font-medium absolute -top-6 left-0 whitespace-nowrap">
                          {week[0].getDate() <= 7 && week[0].toLocaleDateString('en-US', { month: 'short' })}
                        </div>

                        {/* Best Week Highlighter */}
                        {isBestWeek && (
                          <div className="absolute -inset-1 border-2 border-yellow-400 rounded-md pointer-events-none opacity-75"></div>
                        )}
                        
                        {/* Week High Label */}
                        {isBestWeek && (
                          <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-20">
                            Best Week! 🏆
                            <div className="absolute bottom-[-4px] left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900"></div>
                          </div>
                        )}

                        {week.map((date) => {
                          const dateStr = formatDate(date);
                          const value = getDisplayValue(dateStr);
                          const isToday = dateStr === todayStr;
                          const isSelected = selectedDay === dateStr;
                          
                          return (
                            <div 
                              key={dateStr}
                              onClick={() => handleCellClick(dateStr)} 
                              onMouseEnter={() => setHoveredDate({ date: dateStr, value })}
                              onMouseLeave={() => setHoveredDate(null)}
                              className={`
                                w-3 h-3 rounded-sm cursor-pointer transition-all duration-200 relative
                                ${getIntensityColor(value, currentHabit.color)}
                                ${isToday ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-slate-100 z-10' : ''}
                                ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500 z-20 scale-110' : ''}
                                hover:scale-125 hover:z-30 hover:ring-2 hover:ring-offset-1 hover:ring-slate-400 dark:hover:ring-offset-slate-900
                              `}
                            >
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer / Interaction Hint & Adjustment Controls */}
          <div className="bg-slate-50 dark:bg-slate-800/50 px-6 py-4 border-t border-slate-200 dark:border-slate-700 text-sm flex items-center justify-between min-h-[72px]">
            {/* Hover Hint */}
            {!selectedDay && (
              <span className="text-slate-500 text-xs">
                {hoveredDate 
                  ? `${new Date(hoveredDate.date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}: ${hoveredDate.value} ${selectedHabit === 'exercise' ? 'sessions' : 'completions'}` 
                  : 'Click a cell to view or log activity for that day.'}
              </span>
            )}
            
            {/* Quick Log Button (Always visible) */}
            <div className="flex items-center gap-3 ml-4">
               <span className="text-xs font-medium text-slate-500 hidden sm:inline">
                 {selectedHabit === 'exercise' ? 'Open Today\'s Log' : 'Quick Log Today'}
              </span>
              <button
                onClick={handleQuickLog}
                title={selectedHabit === 'exercise' ? 'Open Session Logger for Today' : 'Increment count for Today'}
                className="p-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-full shadow-md hover:scale-110 transition-transform active:scale-90 flex items-center justify-center"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Main Details Panel */}
        {selectedDay && selectedHabit === 'exercise' && (
          <ExerciseSessionPanel 
            dateStr={selectedDay}
            sessions={habitData.exercise[selectedDay] || []}
            updateSessions={updateExerciseSessions}
            onClose={() => setSelectedDay(null)}
          />
        )}
        
        {selectedDay && selectedHabit !== 'exercise' && (
          <SimpleHabitPanel 
            dateStr={selectedDay}
            value={currentData[selectedDay] || 0}
            color={currentHabit.color}
            updateCount={(newValue) => updateSimpleCount(selectedDay, newValue)}
            onClose={() => setSelectedDay(null)}
          />
        )}

      </div>
    </div>
  );
};

// Helper Component for Stats
const StatCard = ({ title, value, icon, trend }) => (
  <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col gap-4">
    <div className="flex items-center justify-between">
      <span className="text-slate-500 dark:text-slate-400 text-sm font-medium">{title}</span>
      <div className="p-2 bg-slate-100 dark:bg-slate-700 rounded-lg">
        {icon}
      </div>
    </div>
    <div>
      <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{trend}</p>
    </div>
  </div>
);

export default HabitTracker;