import { Button } from "@/shared/components/ui/button";
import { AlertTriangle, BookOpen, Briefcase, Code, Coffee, Droplet, Dumbbell, Heart, Home, Moon, Music, Star, Sun, Trees, XCircle } from "lucide-react";

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
    { id: 'trees', icon: Trees, label: 'Nature' },
];

interface IconSelectorProps {
    selected: string;
    onChange: (iconId: string) => void;
}

export const IconSelector = ({ selected, onChange }: IconSelectorProps) => (
    <div className="grid grid-cols-5 grid-rows-[max-content_max-content_max-content] gap-2 justify-items-center align-items-stretch">
        {ICONS.map(({ id, icon: Icon }) => (
            <Button
                key={id}
                onClick={() => onChange(id)}
                type="button"
                variant={selected === id ? "default" : "outline"}
                className={`${selected === id ? 'shadow-md scale-110' : 'hover:scale-105'} h-14 w-14`}
                title={id}
            >
                {Icon && <Icon className="w-6! h-6!" />}
            </Button>
        ))}
    </div>
);