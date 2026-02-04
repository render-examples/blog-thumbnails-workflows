import { Listbox } from "@headlessui/react";
import type { FontOption } from "../types";

type Props = {
  value: string;
  options: FontOption[];
  onChange: (value: string) => void;
};

export function FontDropdown({ value, options, onChange }: Props) {
  const current = options.find((option) => option.id === value) ?? options[0];

  return (
    <Listbox value={current.id} onChange={onChange}>
      {({ open }) => (
        <div className="border border-white/15 p-5 relative">
          <span className="block text-xs uppercase tracking-[0.3em] text-white/60">Font</span>
          <Listbox.Button className="mt-3 w-full bg-black border border-white/20 px-4 py-3 text-left text-white flex items-center justify-between cursor-pointer hover:border-white/40">
            <span style={{ fontFamily: current.fontFamily }}>{current.label}</span>
            <span className="text-white/60">▾</span>
          </Listbox.Button>
          {open && (
            <Listbox.Options className="absolute left-5 right-5 mt-2 border border-white/20 bg-black z-10 focus:outline-none max-h-60 overflow-y-auto">
              {options.map((option) => (
                <Listbox.Option
                  key={option.id}
                  value={option.id}
                  className={({ active, selected }) =>
                    `px-4 py-3 border-b border-white/10 last:border-b-0 cursor-pointer ${
                      active ? "bg-white/10" : "bg-black"
                    } ${selected ? "text-white" : "text-white/70"}`
                  }
                >
                  <span style={{ fontFamily: option.fontFamily }}>{option.label}</span>
                </Listbox.Option>
              ))}
            </Listbox.Options>
          )}
        </div>
      )}
    </Listbox>
  );
}
