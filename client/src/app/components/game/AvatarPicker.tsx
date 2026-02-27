import { cn } from "../ui/utils";

export const avatars = [
  { id: "detective", emoji: "🕵️", label: "Detective" },
  { id: "colonel", emoji: "🎖️", label: "Colonel" },
  { id: "professor", emoji: "👨‍🏫", label: "Professor" },
  { id: "miss", emoji: "👩", label: "Miss Scarlet" },
  { id: "mrs", emoji: "👵", label: "Mrs. White" },
  { id: "mr", emoji: "🧔", label: "Mr. Green" },
  { id: "doctor", emoji: "👨‍⚕️", label: "Dr. Orchid" },
  { id: "reverend", emoji: "👴", label: "Reverend" },
];

export const avatarEmojiById = (id?: string) =>
  avatars.find((a) => a.id === id)?.emoji ?? "🕵️";

interface AvatarPickerProps {
  selected: string;
  onSelect: (id: string) => void;
}

export function AvatarPicker({ selected, onSelect }: AvatarPickerProps) {
  return (
    <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
      {avatars.map((avatar) => (
        <button
          key={avatar.id}
          type="button"
          onClick={() => onSelect(avatar.id)}
          className={cn(
            "aspect-square rounded-lg border-2 transition-all flex items-center justify-center text-2xl hover:scale-105",
            selected === avatar.id
              ? "border-primary bg-primary/10 scale-105"
              : "border-border bg-card hover:border-primary/50"
          )}
          title={avatar.label}
        >
          {avatar.emoji}
        </button>
      ))}
    </div>
  );
}