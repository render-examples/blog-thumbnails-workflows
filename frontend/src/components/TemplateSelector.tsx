import { RadioGroup } from "@headlessui/react";
import { TEMPLATE_OPTIONS } from "../constants";
import type { Template } from "../types";

type Props = {
  value: Template;
  onChange: (value: Template) => void;
};

function TemplateSchematic({ template }: { template: Template }) {
  return (
    <div className="aspect-1200/630 bg-black border border-white/10 relative overflow-hidden">
      {/* Subtle gradient background for overlay templates to show they work on images */}
      {template.startsWith("overlay-") && (
        <div className="absolute inset-0 bg-linear-to-br from-white/5 to-white/10" />
      )}

      {template === "bottom-bar" && (
        <div className="absolute left-0 right-0 bottom-0 h-[32%] bg-white/10 flex items-center px-4">
          <span className="text-[10px] tracking-[0.4em] text-white/70">TITLE</span>
        </div>
      )}
      {template === "left-panel" && (
        <div className="absolute left-0 top-0 bottom-0 w-[42%] bg-white/10 flex items-center px-4">
          <span className="text-[10px] tracking-[0.4em] text-white/70">TITLE</span>
        </div>
      )}
      {template === "center-box" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-[65%] h-[45%] bg-white/10 flex items-center justify-center">
            <span className="text-[10px] tracking-[0.4em] text-white/70">TITLE</span>
          </div>
        </div>
      )}
      {template === "overlay-bottom" && (
        <div className="absolute left-0 right-0 bottom-0 h-[28%] flex items-center px-3">
          <span className="text-[10px] tracking-[0.4em] text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
            TITLE
          </span>
        </div>
      )}
      {template === "overlay-center" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[10px] tracking-[0.4em] text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
            TITLE
          </span>
        </div>
      )}
    </div>
  );
}

export function TemplateSelector({ value, onChange }: Props) {
  return (
    <div className="border border-white/15 p-5">
      <RadioGroup value={value} onChange={onChange}>
        <RadioGroup.Label className="block text-xs uppercase tracking-[0.3em] text-white/60">
          Template
        </RadioGroup.Label>
        <div className="mt-4 grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {TEMPLATE_OPTIONS.map((opt) => (
            <RadioGroup.Option
              key={opt.id}
              value={opt.id}
              className={({ checked }) =>
                `border p-3 w-full text-left transition cursor-pointer ${
                  checked ? "border-white" : "border-white/20 hover:border-white/50"
                }`
              }
            >
              <TemplateSchematic template={opt.id as Template} />
              <p className="text-xs uppercase tracking-[0.3em] text-white/60 mt-3">{opt.label}</p>
            </RadioGroup.Option>
          ))}
        </div>
      </RadioGroup>
    </div>
  );
}
