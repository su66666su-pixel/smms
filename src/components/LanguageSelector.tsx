import React, { useState, useRef, useEffect } from "react";
import { LANGUAGES, LanguageCode } from "../utils/translations";
import { Globe, ChevronDown, Check } from "lucide-react";

interface LanguageSelectorProps {
  currentLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  dark?: boolean;
}

export function LanguageSelector({ currentLanguage, onLanguageChange, dark = false }: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLang = LANGUAGES.find((l) => l.code === currentLanguage) || LANGUAGES[0];
  const isRtl = selectedLang.dir === "rtl";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative inline-block" ref={containerRef} id="language-selector-wrapper">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-2 rounded-xl border-2 text-xs font-black transition-all shadow-md cursor-pointer select-none ${
          dark
            ? "bg-slate-900 border-indigo-900/50 text-indigo-150 hover:bg-slate-850 hover:border-indigo-800 focus:ring-2 focus:ring-indigo-500/30"
            : "bg-white border-blue-400/80 text-blue-950 hover:bg-slate-50 hover:border-blue-600/80 focus:ring-2 focus:ring-blue-500/30"
        }`}
        style={{ minWidth: "115px" }}
        id="language-selector-trigger"
      >
        <Globe className={`w-4 h-4 shrink-0 ${dark ? "text-indigo-400" : "text-blue-600 animate-spin-slow"}`} />
        <span className="flex items-center gap-1.5 font-sans truncate">
          <span className="text-sm shrink-0">{selectedLang.flag}</span>
          <span className="font-extrabold text-xs">{selectedLang.name}</span>
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-auto" />
      </button>

      {isOpen && (
        <div
          className={`absolute mt-2.5 w-52 rounded-2xl shadow-2xl border-2 z-50 overflow-hidden animate-fade-in ${
            isRtl ? "left-0" : "right-0"
          } ${
            dark
              ? "bg-slate-950 border-slate-800 text-slate-100 shadow-slate-950/80"
              : "bg-white border-blue-200/90 text-slate-900 shadow-slate-300/60"
          }`}
          style={{ transformOrigin: isRtl ? "top left" : "top right" }}
          id="language-dropdown-menu"
        >
          <div className="py-1.5 max-h-80 overflow-y-auto">
            {LANGUAGES.map((lang) => {
              const isSelected = currentLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    onLanguageChange(lang.code);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-2.5 text-xs font-extrabold flex items-center justify-between transition-all ${
                    isSelected
                      ? dark
                        ? "bg-indigo-650/30 text-indigo-300 font-black border-l-4 border-indigo-500"
                        : "bg-blue-50 text-blue-900 font-black border-l-4 border-blue-600"
                      : dark
                      ? "hover:bg-slate-900 text-slate-300"
                      : "hover:bg-blue-50/50 text-slate-700"
                  }`}
                  style={{ direction: "ltr" }} // Selection rows uniformly styled
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base shrink-0">{lang.flag}</span>
                    <span className="truncate">{lang.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-slate-400 font-mono uppercase bg-slate-900/10 px-1.5 py-0.5 rounded font-bold">
                      {lang.code}
                    </span>
                    {isSelected && (
                      <Check className={`w-3.5 h-3.5 ${dark ? "text-indigo-400" : "text-blue-600"}`} />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
