import { Button } from "@/components/ui/button";
import { AlertTriangle, BookOpen, Briefcase, Code, Coffee, Droplet, Dumbbell, Heart, Home, Moon, Music, Star, Sun, XCircle } from "lucide-react";

export const ICONS = [
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

interface IconSelectorProps {
    selected: string;
    onChange: (iconId: string) => void;
}

export const IconSelector = ({ selected, onChange }: IconSelectorProps) => (
    <div className="grid grid-cols-7 gap-2">
        {ICONS.map(({ id, icon: Icon }) => (
            <Button
                key={id}
                onClick={() => onChange(id)}
                type="button"
                variant={selected === id ? "default" : "outline"}
                size="icon-sm"
                className={`${selected === id ? 'shadow-md scale-110' : 'hover:scale-105'}`}
                title={id}
            >
                {Icon && <Icon className="w-5 h-5" />}
            </Button>
        ))}
    </div>
);