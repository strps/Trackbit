import { Button } from "@/shared/components/ui/button";
import { ICONS } from "./habit-icons";

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