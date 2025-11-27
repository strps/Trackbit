import React, { useState } from 'react';
import { 
  Plus, Trash2, Save, X, Settings, 
  BookOpen, Dumbbell, Code, Droplet, 
  Sun, Moon, Music, Coffee, Briefcase, 
  Home, Star, Heart, Zap, 
  Layout, CheckCircle, List, BarChart2,
  XCircle, AlertTriangle
} from 'lucide-react';

// --- Constants & Config Options ---

const ICONS = [
  { id: 'book', icon: BookOpen, label: 'Read' },
  { id: 'dumbbell', icon: Dumbbell, label: 'Fitness' },
  { id: 'code', icon: Code, label: 'Code' },
  { id: 'water', icon: Droplet, label: 'Health' },
  { id: 'sun', icon: Sun, label: 'Morning' },
  { id: 'moon', icon: Moon, label: 'Sleep' },
  { id: 'music', icon: Music, label: 'Creativity' },
  { id: 'work', icon: Briefcase, label: 'Work' },
  { id: 'coffee', icon: Coffee, label: 'Breaks' },
  { id: 'ban', icon: XCircle, label: 'Quit' },
  { id: 'alert', icon: AlertTriangle, label: 'Limit' },
  { id: 'home', icon: Home, label: 'Chores' },
  { id: 'star', icon: Star, label: 'Focus' },
  { id: 'heart', icon: Heart, label: 'Wellness' },
];

const COLORS = [
  { id: 'emerald', bg: 'bg-emerald-500', ring: 'ring-emerald-500', label: 'Emerald' },
  { id: 'blue', bg: 'bg-blue-500', ring: 'ring-blue-500', label: 'Blue' },
  { id: 'violet', bg: 'bg-violet-500', ring: 'ring-violet-500', label: 'Violet' },
  { id: 'orange', bg: 'bg-orange-500', ring: 'ring-orange-500', label: 'Orange' },
  { id: 'rose', bg: 'bg-rose-500', ring: 'ring-rose-500', label: 'Rose' },
  { id: 'amber', bg: 'bg-amber-500', ring: 'ring-amber-500', label: 'Amber' },
  { id: 'cyan', bg: 'bg-cyan-500', ring: 'ring-cyan-500', label: 'Cyan' },
  { id: 'slate', bg: 'bg-slate-500', ring: 'ring-slate-500', label: 'Slate' },
];

const TRACKING_TYPES = [
  { 
    id: 'simple', 
    label: 'Simple Completion', 
    description: 'Track daily checks or counts (e.g., Read 30 mins).',
    icon: CheckCircle 
  },
  { 
    id: 'complex', 
    label: 'Structured Session', 
    description: 'Log sets, reps, weights, time, or distance (e.g., Gym).',
    icon: List 
  },
  { 
    id: 'negative', 
    label: 'Negative Habit', 
    description: 'Track bad habits to reduce or avoid (e.g., Smoking, Junk Food).',
    icon: XCircle 
  }
];

// --- Helper Components ---

const IconSelector = ({ selected, onChange }) => (
  <div className="grid grid-cols-7 gap-2">
    {ICONS.map(({ id, icon: Icon }) => (
      <button
        key={id}
        onClick={() => onChange(id)}
        className={`
          p-2.5 rounded-xl flex items-center justify-center transition-all
          ${selected === id 
            ? 'bg-slate-900 text-white shadow-md scale-110' 
            : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:scale-105'}
        `}
        title={id}
      >
        {/* Render Icon safely */}
        {Icon && <Icon className="w-5 h-5" />}
      </button>
    ))}
  </div>
);

const ColorSelector = ({ selected, onChange }) => (
  <div className="flex flex-wrap gap-3">
    {COLORS.map(({ id, bg, ring }) => (
      <button
        key={id}
        onClick={() => onChange(id)}
        className={`
          w-8 h-8 rounded-full transition-all duration-200
          ${bg}
          ${selected === id ? `ring-4 ring-offset-2 ${ring} scale-110` : 'hover:scale-110 hover:opacity-80'}
        `}
        aria-label={id}
      />
    ))}
  </div>
);

// --- Main Component ---

const HabitConfiguration = () => {
  // Mock initial state - in real app, this would come from your database
  const [habits, setHabits] = useState([
    { id: '1', name: 'Morning Read', type: 'simple', color: 'blue', icon: 'book', goal: 7 },
    { id: '2', name: 'Gym Workout', type: 'complex', color: 'orange', icon: 'dumbbell', goal: 4 },
  ]);

  const [isEditing, setIsEditing] = useState(false);
  const [activeHabitId, setActiveHabitId] = useState(null); // ID of habit being edited, or null for new

  // Default empty form state
  const defaultForm = {
    name: '',
    description: '',
    type: 'simple',
    color: 'emerald',
    icon: 'star',
    goal: 5, // days per week
  };

  const [formData, setFormData] = useState(defaultForm);

  // --- Handlers ---

  const startNewHabit = () => {
    setFormData(defaultForm);
    setActiveHabitId(null);
    setIsEditing(true);
  };

  const editHabit = (habit) => {
    setFormData({ ...defaultForm, ...habit });
    setActiveHabitId(habit.id);
    setIsEditing(true);
  };

  const deleteHabit = (id, e) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this habit? All data will be lost.')) {
      setHabits(prev => prev.filter(h => h.id !== id));
      if (activeHabitId === id) cancelEdit();
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setActiveHabitId(null);
    setFormData(defaultForm);
  };

  const saveHabit = () => {
    if (!formData.name.trim()) return;

    if (activeHabitId) {
      // Update existing
      setHabits(prev => prev.map(h => h.id === activeHabitId ? { ...formData, id: activeHabitId } : h));
    } else {
      // Create new
      const newHabit = {
        ...formData,
        id: Date.now().toString(),
        createdAt: new Date().toISOString()
      };
      setHabits(prev => [...prev, newHabit]);
    }
    cancelEdit();
  };

  // Helper to render the actual Lucide icon component dynamically
  const renderIcon = (iconId, className = "w-5 h-5") => {
    const iconDef = ICONS.find(i => i.id === iconId) || ICONS[0];
    const IconComponent = iconDef.icon;
    return IconComponent ? <IconComponent className={className} /> : null;
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans p-4 md:p-8">
      <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Header (Spans full width) */}
        <div className="lg:col-span-12 flex items-center justify-between mb-2">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Settings className="w-8 h-8 text-slate-400" />
              Habit Settings
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1">Configure your daily routines and tracking preferences.</p>
          </div>
        </div>

        {/* Left Column: Habit List */}
        <div className="lg:col-span-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Your Habits</h2>
            <span className="text-xs font-medium px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300">
              {habits.length} Active
            </span>
          </div>

          <div className="space-y-3">
            {habits.map(habit => (
              <div 
                key={habit.id}
                onClick={() => editHabit(habit)}
                className={`
                  group p-4 rounded-xl border-2 transition-all cursor-pointer relative overflow-hidden
                  ${activeHabitId === habit.id 
                    ? 'bg-white dark:bg-slate-800 border-blue-500 ring-2 ring-blue-500/20 shadow-lg' 
                    : 'bg-white dark:bg-slate-800 border-transparent hover:border-slate-300 dark:hover:border-slate-600 shadow-sm hover:shadow-md'}
                `}
              >
                <div className="flex items-center gap-4 relative z-10">
                  <div className={`
                    w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-sm
                    bg-${habit.color}-500
                  `}>
                    {renderIcon(habit.icon, "w-6 h-6")}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-lg truncate">{habit.name}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className={`px-1.5 py-0.5 rounded capitalize ${habit.type === 'negative' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'bg-slate-100 dark:bg-slate-700'}`}>
                        {habit.type === 'complex' ? 'Structured' : habit.type === 'negative' ? 'Negative' : 'Simple'}
                      </span>
                      <span>•</span>
                      <span>{habit.type === 'negative' ? 'Limit:' : 'Goal:'} {habit.goal}/wk</span>
                    </div>
                  </div>

                  <button 
                    onClick={(e) => deleteHabit(habit.id, e)}
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                
                {/* Decorative background accent */}
                <div className={`absolute right-0 top-0 w-24 h-full bg-gradient-to-l from-${habit.color}-50 dark:from-${habit.color}-900/10 to-transparent opacity-50 pointer-events-none`} />
              </div>
            ))}

            <button
              onClick={startNewHabit}
              className="w-full py-4 border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400 hover:text-blue-500 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all flex items-center justify-center gap-2 font-medium"
            >
              <Plus className="w-5 h-5" />
              Create New Habit
            </button>
          </div>
        </div>

        {/* Right Column: Configuration Form */}
        <div className="lg:col-span-7">
          <div className={`
            bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden sticky top-8 transition-all duration-300
            ${isEditing ? 'opacity-100 translate-y-0' : 'opacity-50 grayscale pointer-events-none translate-y-4'}
          `}>
            {/* Form Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800">
              <div>
                <h2 className="text-xl font-bold">
                  {activeHabitId ? 'Edit Habit' : 'New Habit'}
                </h2>
                <p className="text-sm text-slate-500">Define how you want to track this routine.</p>
              </div>
              <div className="flex gap-2">
                 <button 
                  onClick={cancelEdit}
                  className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button 
                  onClick={saveHabit}
                  className="px-6 py-2 text-sm font-bold text-white bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 rounded-lg shadow-lg shadow-slate-200 dark:shadow-none flex items-center gap-2 transition-transform active:scale-95"
                >
                  <Save className="w-4 h-4" /> Save
                </button>
              </div>
            </div>

            {/* Form Content */}
            <div className="p-6 space-y-8">
              
              {/* Name & Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Habit Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., Drink Water"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
                  />
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                    {formData.type === 'negative' ? 'Weekly Limit (Days)' : 'Weekly Goal (Days)'}
                  </label>
                  <div className="flex items-center gap-4">
                     <input
                      type="range"
                      min="1"
                      max="7"
                      value={formData.goal}
                      onChange={(e) => setFormData(prev => ({ ...prev, goal: Number(e.target.value) }))}
                      className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-slate-900 dark:accent-white"
                    />
                    <span className={`w-12 text-center font-bold text-xl py-1 rounded-lg ${formData.type === 'negative' ? 'bg-red-50 text-red-600 dark:bg-red-900/20' : 'bg-slate-100 dark:bg-slate-700'}`}>
                      {formData.goal}
                    </span>
                  </div>
                </div>
              </div>

              {/* Tracking Logic */}
              <div className="space-y-3">
                <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">Tracking Method</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {TRACKING_TYPES.map(type => {
                    const TypeIcon = type.icon;
                    return (
                      <button
                        key={type.id}
                        onClick={() => setFormData(prev => ({ ...prev, type: type.id }))}
                        className={`
                          p-4 rounded-xl border-2 text-left transition-all flex gap-4 items-start
                          ${formData.type === type.id 
                            ? type.id === 'negative' 
                              ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                              : 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                            : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}
                        `}
                      >
                        <div className={`p-2 rounded-lg ${
                          formData.type === type.id 
                            ? type.id === 'negative' ? 'bg-red-500 text-white' : 'bg-blue-500 text-white' 
                            : 'bg-slate-100 text-slate-500'
                        }`}>
                          {TypeIcon && <TypeIcon className="w-5 h-5" />}
                        </div>
                        <div>
                          <div className={`font-bold ${
                            formData.type === type.id 
                              ? type.id === 'negative' ? 'text-red-700 dark:text-red-300' : 'text-blue-700 dark:text-blue-300' 
                              : 'text-slate-700 dark:text-slate-300'
                          }`}>
                            {type.label}
                          </div>
                          <div className="text-xs text-slate-500 mt-1 leading-relaxed">
                            {type.description}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="h-px bg-slate-100 dark:bg-slate-700" />

              {/* Appearance */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Icon Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Icon
                    <span className="ml-2 text-xs font-normal text-slate-400">Select one</span>
                  </label>
                  <IconSelector 
                    selected={formData.icon} 
                    onChange={(icon) => setFormData(prev => ({ ...prev, icon }))} 
                  />
                </div>

                {/* Color Selection */}
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-slate-700 dark:text-slate-300">
                    Color Theme
                    <span className="ml-2 text-xs font-normal text-slate-400">Used for heatmaps</span>
                  </label>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-slate-100 dark:border-slate-600">
                    <ColorSelector 
                      selected={formData.color} 
                      onChange={(color) => setFormData(prev => ({ ...prev, color }))} 
                    />
                    
                    {/* Preview Area */}
                    <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-600">
                      <div className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">Preview</div>
                      <div className="flex items-center gap-2">
                        <div className={`w-4 h-4 rounded-sm bg-${formData.color}-200`}></div>
                        <div className={`w-4 h-4 rounded-sm bg-${formData.color}-400`}></div>
                        <div className={`w-4 h-4 rounded-sm bg-${formData.color}-600`}></div>
                        <div className={`w-4 h-4 rounded-sm bg-${formData.color}-800`}></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* Empty State / Prompt */}
          {!isEditing && (
            <div className="hidden lg:flex h-full min-h-[400px] flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl bg-slate-50/50 dark:bg-slate-800/30">
              <Layout className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">Select a habit to edit</p>
              <p className="text-sm">or create a new one to get started.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default HabitConfiguration;