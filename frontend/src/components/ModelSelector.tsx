import type { Option } from "../types";

type Props = {
  options: Option[];
  selected: string[];
  onChange: (selected: string[]) => void;
};

export function ModelSelector({ options, selected, onChange }: Props) {
  const toggle = (id: string) => {
    if (selected.includes(id)) {
      // Don't allow deselecting if it's the last one
      if (selected.length > 1) {
        onChange(selected.filter((s) => s !== id));
      }
    } else {
      onChange([...selected, id]);
    }
  };

  return (
    <div className="border border-white/15 p-5">
      <span className="block text-xs uppercase tracking-[0.3em] text-white/60">Models</span>
      <div className="mt-4 flex flex-col gap-3">
        {options.map((option) => {
          const isSelected = selected.includes(option.id);
          return (
            <label key={option.id} className="flex items-center gap-3 cursor-pointer group">
              <span
                className={`w-5 h-5 border flex items-center justify-center transition ${
                  isSelected
                    ? "border-white bg-white"
                    : "border-white/30 group-hover:border-white/50"
                }`}
              >
                {isSelected && (
                  <svg
                    className="w-3 h-3 text-black"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={3}
                    role="img"
                    aria-label="Selected"
                  >
                    <title>Selected</title>
                    <path strokeLinecap="square" strokeLinejoin="miter" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span
                className={`transition ${
                  isSelected ? "text-white" : "text-white/60 group-hover:text-white/80"
                }`}
              >
                {option.label}
              </span>
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(option.id)}
                className="sr-only"
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
