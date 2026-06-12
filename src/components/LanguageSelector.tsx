import React, { useState, useRef, useEffect } from "react";
import { LANGUAGES, LanguageCode } from "../utils/translations";
import { Globe, ChevronDown } from "lucide-react";

interface LanguageSelectorProps {
  currentLanguage: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  dark?: boolean;
}

export function LanguageSelector({ currentLanguage, onLanguageChange, dark = false }: LanguageSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedLang = LANGUAGES.find((l) => l.code === currentLanguage) || LANGUAGES[0];

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
    <div className="relative inline-block text-right" ref={containerRef} id="language-selector-wrapper">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm cursor-pointer select-none ${
          dark
            ? "bg-slate-900 border-slate-800 text-slate-200 hover:bg-slate-800"
            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
        }`}
      >
        <Globe className={`w-4 h-4 ${dark ? "text-indigo-400" : "text-blue-600 animate-spin-slow"}`} />
        <span className="flex items-center gap-1.5 font-sans">
          <span>{selectedLang.flag}</span>
          <span className="hidden sm:inline font-semibold">{selectedLang.name}</span>
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 mt-2 w-48 rounded-2xl shadow-xl border z-50 overflow-hidden animate-fade-in ${
            dark
              ? "bg-slate-950 border-slate-800 text-slate-200"
              : "bg-white border-slate-100 text-slate-800"
          }`}
          style={{ transformOrigin: "top left" }}
        >
          <div className="py-1.5 max-h-72 overflow-y-auto">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  onLanguageChange(lang.code);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-xs font-semibold flex items-center justify-between transition-all ${
                  currentLanguage === lang.code
                    ? dark
                      ? "bg-indigo-600/20 text-indigo-300 border-l-2 border-indigo-500 font-bold"
                      : "bg-blue-50 text-blue-700 border-l-2 border-blue-500 font-bold"
                    : dark
                    ? "hover:bg-slate-900 text-slate-300"
                    : "hover:bg-slate-50 text-slate-700"
                }`}
                style={{ direction: "ltr" }} // keep selection rows uniformly LTR-styled for list preview
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{lang.flag}</span>
                  <span>{lang.name}</span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono uppercase bg-slate-900/10 px-1.5 py-0.5 rounded">
                  {lang.code}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
