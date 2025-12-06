// import { useEffect, useState } from "react";
// import { useExercises } from "@/hooks/use-exercises";
// import { ChevronDown, Dumbbell, Ghost, Hash, Info, Plus, Save, Scale, Trash2, X } from "lucide-react";
// import { Button } from "@/components/ui/button";
// import { SetInputField } from "./SetInputField";
// import { Select, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue, SelectContent } from "@/components/ui/select";
// import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
// import { Label } from "@radix-ui/react-label";
// import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
// import { Input } from "@/components/ui/input";

// interface ExerciseSessionPanelProps {
//     dateStr: string;
//     habitId: number;
//     logs: any[];
//     onSaveLog: (data: any) => void;
//     onClose: () => void;
// }


// // Exercise Session Panel (The Vertical Accordion Container) (Restored & Wired)
// export const ExerciseSessionPanel = ({ dateStr, habitId, logs, onSaveLog, onClose }: any) => {
//     const [editingId, setEditingId] = useState<number | 'NEW' | null>(null);
//     const { exercises } = useExercises();

//     // Find the log entry for the selected day/habit
//     const logEntry = logs.find((l: any) => l.habitId === habitId && l.date === dateStr);

//     // The sets are directly available on the log entry (JSONB/Sets in Drizzle)
//     const logsForDay = logEntry?.sets || [];
//     const logId = logEntry?.id;

//     // We can only edit one complex log per day for this MVP setup
//     const initialData = logEntry;

//     // Function to calculate stats for the session summary
//     const calculateSummary = (sets: any[]) => {
//         if (sets.length === 0) return { totalSets: 0, maxWeight: 0 };
//         return {
//             totalSets: sets.length,
//             maxWeight: Math.max(...sets.map((s: any) => s.weight))
//         };
//     };

//     const summary = calculateSummary(logsForDay);

//     // Handle saving the full log entry
//     const handleSave = (data: any) => {
//         onSaveLog({
//             id: logId, // Pass ID if updating
//             habitId: habitId,
//             date: dateStr,
//             sets: data.sets
//         });
//         setEditingId(null);
//     };

//     const getRecomendedExercises = () => {
//         //TODO: this should return an ordered lis of execises depending of workout program, selected muscular zones, or favorites/most done. for now I will just return the list as it is
//         return (exercises)
//     }

//     return (
//         <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 rounded-b-xl">


//             <div className="flex flex-col space-y-3">
//                 {/* Check if a log entry exists for this day */}
//                 {logEntry ? (
//                     <div className="border border-slate-200 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-800 overflow-hidden shadow-sm">
//                         {editingId === logId ? (
//                             /* Expanded Edit View */
//                             <div className="p-4 bg-slate-50 dark:bg-slate-900/50">
//                                 <h4 className="font-bold text-sm text-slate-500 mb-4 uppercase tracking-wider">Edit Session</h4>
//                                 <ExerciseForm
//                                     isNew={false}
//                                     initialData={initialData}
//                                     onSave={handleSave}
//                                     onCancel={() => setEditingId(null)}
//                                     // Delete button needs to delete the entire log header
//                                     onDelete={() => alert("Deletion needs to be implemented in API.")}
//                                     habitId={habitId}
//                                     dateStr={dateStr}
//                                 />
//                             </div>
//                         ) : (
//                             /* Collapsed Summary View */
//                             <div
//                                 onClick={() => setEditingId(logId)}
//                                 className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
//                             >
//                                 <div>
//                                     <div className="font-bold text-slate-900 dark:text-slate-100">Workout Summary</div>
//                                     <div className="text-xs text-slate-500 dark:text-slate-400 flex gap-3">
//                                         <span className="font-semibold">{summary.totalSets} Sets Logged</span>
//                                         {summary.maxWeight > 0 && <span>Max Lift: {summary.maxWeight}kg</span>}
//                                     </div>
//                                 </div>
//                                 <ChevronDown className="w-5 h-5 text-slate-400" />
//                             </div>
//                         )}
//                     </div>
//                 ) : editingId === 'NEW' ? (
//                     <div className="border border-border rounded-xl shadow-sm animate-in fade-in slide-in-from-bottom-2">
//                         <Collapsible>
//                             <CollapsibleTrigger asChild>
//                                 <div className="flex justify-between items-center border-b p-4">
//                                     <h4 className="font-bold text-sm text-primary uppercase tracking-wider">
//                                         New Exercise Session
//                                     </h4>
//                                     <Button variant="outline">
//                                         <Trash2 />
//                                     </Button>
//                                 </div>
//                             </CollapsibleTrigger>
//                             <CollapsibleContent>
//                                 <div className="flex flex-col p-4 gap-2">
//                                     <ExerciseForm
//                                         isNew={true}
//                                         onSave={handleSave}
//                                         onCancel={() => setEditingId(null)}
//                                         habitId={habitId}
//                                         dateStr={dateStr}
//                                     />
//                                     <div className="flex p-4  justify-between rounded-xl shadow-lg border border-border">
//                                         <div>
//                                             <Label>Add Exercise. Recomended:</Label>
//                                             <Popover>
//                                                 <PopoverTrigger asChild>
//                                                     <Button variant="outline">Open popover <ChevronDown /></Button>
//                                                 </PopoverTrigger>
//                                                 <PopoverContent>
//                                                     <Input type="search" />
//                                                     <ul>
//                                                         {exercises.map(ex => <li key={ex.id}>{ex.name}</li>)}

//                                                     </ul>
//                                                 </PopoverContent>
//                                             </Popover>

//                                         </div>
//                                         <button className="">
//                                             <Plus />
//                                         </button>

//                                     </div>
//                                 </div>
//                             </CollapsibleContent>
//                         </Collapsible>
//                     </div>
//                 ) : (
//                     <button
//                         onClick={() => setEditingId('NEW')}
//                         className="w-full py-3 rounded-xl border-2 border-dashed border-slate-300 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-blue-400 text-slate-400 font-medium transition-all flex items-center justify-center gap-2"
//                     >

//                         <Plus className="w-5 h-5" /> Log First Session
//                     </button>
//                 )}
//             </div>

//             {
//                 logEntry === undefined && editingId !== 'NEW' && (
//                     <div className="text-center py-8 text-slate-400">
//                         <Dumbbell className="w-8 h-8 mx-auto mb-2 opacity-20" />
//                         <p className="text-sm">No complex session logged for this day yet.</p>
//                     </div>
//                 )
//             }
//         </div >
//     );
// };



// const ExerciseForm = ({ initialData, onSave, onCancel, onDelete, isNew, habitId, dateStr, isOpen }: any) => {
//     const { exercises } = useExercises();

//     // Find the primary exercise ID from the existing log if editing
//     const initialExerciseId = initialData?.sets?.[0]?.exerciseId || exercises[0]?.id || 0;

//     const [formData, setFormData] = useState({
//         // Note: For simplicity, we assume one exercise per session form entry
//         exerciseId: initialExerciseId,
//         sets: initialData?.sets || [{ setNumber: 1, reps: 0, weight: 0, weightUnit: 'kg' }],
//     });

//     useEffect(() => {
//         if (formData.exerciseId === 0 && exercises.length > 0) {
//             setFormData(prev => ({ ...prev, exerciseId: exercises[0].id }));
//         }
//     }, [exercises, formData.exerciseId]);


//     const handleSetChange = (index: number, field: any, value: any) => {
//         const newSets = [...formData.sets];
//         newSets[index] = { ...newSets[index], [field]: value };
//         setFormData({ ...formData, sets: newSets });
//     };

//     const addSet = () => {
//         const lastSet = formData.sets[formData.sets.length - 1];
//         setFormData({
//             ...formData,
//             sets: [...formData.sets, {
//                 setNumber: formData.sets.length + 1,
//                 reps: lastSet.reps,
//                 weight: lastSet.weight,
//                 weightUnit: lastSet.weightUnit
//             }]
//         });
//     };

//     const removeSet = (index: number) => {
//         if (formData.sets.length > 1) {
//             setFormData({
//                 ...formData,
//                 sets: formData.sets.filter((_, i) => i !== index)
//             });
//         }
//     };

//     const handleSubmit = () => {
//         // Filter out empty sets and prepare for API
//         const finalSets = formData.sets
//             .filter((s: any) => s.reps > 0 || s.weight > 0)
//             .map((s: any) => ({ ...s, exerciseId: Number(formData.exerciseId) }));

//         if (finalSets.length === 0) {
//             alert("Please log at least one set with reps or weight.");
//             return;
//         }

//         onSave({
//             id: initialData?.id, // Pass ID if updating
//             habitId: habitId,
//             date: dateStr,
//             sets: finalSets
//         });
//         onCancel();
//     };



//     return (
//         <div className="rounded-xl shadow-lg border border-border">
//             {/* Header */}
//             <div className="flex items-center gap-3 border-b p-3">
//                 <label className="text-xs font-bold text-slate-500 uppercase">Exercise</label>
//                 <Select
//                     value={formData.exerciseId}
//                     onChange={(e) => setFormData({ ...formData, exerciseId: Number(e.target.value) })}
//                 >
//                     <SelectTrigger className="w-[180px]">
//                         <SelectValue placeholder="Select exercise" />
//                     </SelectTrigger>
//                     <SelectContent>
//                         <SelectGroup>

//                             {exercises.length === 0 && <SelectLabel>Loading Exercises...</SelectLabel>}
//                             {exercises.map(ex => <SelectItem key={ex.id} value={ex.id}>{ex.name}</SelectItem>)}
//                         </SelectGroup>
//                     </SelectContent>
//                 </Select>
//                 <Button variant="ghost">
//                     <Info className="h-12 w-12" />
//                 </Button>
//             </div>

//             {/* Sets & Reps Section */}
//             <div className="space-y-3 mt-2 p-3">
//                 <div className="flex justify-start text-[10px] font-bold text-slate-400 pl-1 uppercase tracking-wider">
//                     <span className="inline-flex items-center gap-1 "><Hash className="w-3 h-3" /> Reps /<Scale className="w-3 h-3" /> Weight (kg)</span>
//                 </div>

//                 <div className="flex overflow-x-auto space-x-2 pb-2">
//                     {formData.sets.map((set, index: number) => (
//                         <div key={index} className="flex-none w-24 bg-white dark:bg-slate-800 p-2 rounded-lg shadow-sm border border-slate-200 dark:border-slate-600 flex flex-col items-center">
//                             <div className="flex justify-between items-center w-full mb-2">
//                                 <span className="font-bold text-[10px] text-slate-400 uppercase">Set {index + 1}</span>
//                                 <button type="button" onClick={() => removeSet(index)} disabled={formData.sets.length === 1} className="text-slate-300 hover:text-red-500 disabled:opacity-0 transition-colors">
//                                     <X className="w-3 h-3" />
//                                 </button>
//                             </div>
//                             <div className="flex flex-col gap-1.5 w-full">
//                                 <SetInputField value={set.reps} onChange={(val: number) => handleSetChange(index, 'reps', val)} placeholder="Reps" isReps={true} />
//                                 <SetInputField value={set.weight} onChange={(val: number) => handleSetChange(index, 'weight', val)} placeholder="Weight" isReps={false} />
//                             </div>
//                         </div>
//                     ))}

//                     <button type="button" onClick={addSet} className="flex-none w-12 flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-300 hover:border-blue-400 text-slate-400 hover:text-blue-500 transition-colors bg-slate-50 dark:bg-slate-800/50" title="Add Set">
//                         <Plus className="w-5 h-5" />
//                         <span className="text-[10px] font-medium">Add</span>
//                     </button>
//                 </div>
//             </div>


//         </div>
//     );
// };
