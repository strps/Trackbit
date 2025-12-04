import { Minus, Plus } from "lucide-react";


interface SetInputFieldProps {
    value: number;
    onChange: (val: number) => void;
    placeholder: string;
    isReps: boolean;
}

export const SetInputField = ({ value, onChange, placeholder, isReps }: SetInputFieldProps) => {
    const increment = () => onChange((value || 0) + (isReps ? 1 : 2.5));
    const decrement = () => onChange(Math.max(0, (value || 0) - (isReps ? 1 : 2.5)));

    // Inline styles to disable native number input spinners
    const inputStyle = `
        input[type="number"].no-spinner::-webkit-inner-spin-button, 
        input[type="number"].no-spinner::-webkit-outer-spin-button {
            -webkit-appearance: none;
            margin: 0;
        }
        input[type="number"].no-spinner {
            -moz-appearance: textfield;
        }
    `;

    return (
        <>
            <style>{inputStyle}</style>
            <div className={`flex items-stretch w-full rounded-md overflow-hidden border border-slate-300 dark:border-slate-600 shadow-inner h-7`}>
                <button type="button" onClick={decrement} className="flex-none w-5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 flex items-center justify-center border-r border-slate-300 dark:border-slate-600" disabled={value <= 0} tabIndex={-1}>
                    <Minus className={`w-2 h-2 ${isReps ? 'text-blue-500' : 'text-slate-500'}`} />
                </button>
                <input type="number" value={value || ''} min="0" onChange={(e) => onChange(Number(e.target.value))} placeholder={placeholder} className={`flex-1 min-w-0 text-center bg-transparent dark:text-white focus:outline-none no-spinner text-sm font-bold`} />
                <button type="button" onClick={increment} className="flex-none w-5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors flex items-center justify-center border-l border-slate-300 dark:border-slate-600" tabIndex={-1}>
                    <Plus className={`w-2 h-2 ${isReps ? 'text-blue-500' : 'text-slate-500'}`} />
                </button>
            </div>
        </>
    );
};
