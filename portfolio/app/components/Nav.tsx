"use client";

import { useState } from "react";
import { useLang } from "./LangContext";

const labels = {
  ja: { writing: "文筆", apps: "アプリ", membership: "メンバーシップ", sns: "SNS" },
  en: { writing: "Writing", apps: "Apps", membership: "Membership", sns: "SNS" },
};

function LangButton({
  lang,
  toggle,
}: {
  lang: "ja" | "en";
  toggle: () => void;
}) {
  return (
    <button
      onClick={toggle}
      style={{
        border: "1px solid #f5c518",
        color: "#f5c518",
        background: "transparent",
        padding: "0.25rem 0.75rem",
        fontSize: "0.75rem",
        fontWeight: 700,
        letterSpacing: "0.05em",
        cursor: "pointer",
        borderRadius: "2px",
        transition: "all 0.2s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.background = "#f5c518";
        (e.currentTarget as HTMLButtonElement).style.color = "#000";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.background = "transparent";
        (e.currentTarget as HTMLButtonElement).style.color = "#f5c518";
      }}
    >
      {lang === "ja" ? "EN" : "JA"}
    </button>
  );
}

function HamburgerIcon({ open }: { open: boolean }) {
  const bar = (rotation: string, y: string, opacity?: string) => ({
    display: "block",
    width: "22px",
    height: "2px",
    background: "#f5f5f5",
    borderRadius: "1px",
    transition: "transform 0.3s, opacity 0.3s",
    transform: rotation,
    position: "absolute" as const,
    top: y,
    left: "0",
    opacity: opacity ?? "1",
  });

  return (
    <div style={{ position: "relative", width: "22px", height: "16px" }}>
      <span
        style={bar(
          open ? "rotate(45deg) translate(5px, 5px)" : "none",
          "0px"
        )}
      />
      <span
        style={bar("none", "7px", open ? "0" : "1")}
      />
      <span
        style={bar(
          open ? "rotate(-45deg) translate(5px, -5px)" : "none",
          "14px"
        )}
      />
    </div>
  );
}

function MobileMenu({
  open,
  lang,
  onClose,
}: {
  open: boolean;
  lang: "ja" | "en";
  onClose: () => void;
}) {
  const t = labels[lang];
  const navItems = [
    { href: "#writing", label: t.writing },
    { href: "#apps", label: t.apps },
    { href: "#membership", label: t.membership },
    { href: "#sns", label: t.sns },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 40,
        background: "rgba(10,10,10,0.97)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "2.5rem",
        transition: "opacity 0.3s, visibility 0.3s",
        opacity: open ? 1 : 0,
        visibility: open ? "visible" : "hidden",
        pointerEvents: open ? "auto" : "none",
      }}
    >
      {navItems.map(item => (
        <a
          key={item.href}
          href={item.href}
          onClick={onClose}
          style={{
            fontSize: "2rem",
            fontWeight: 900,
            color: "#888",
            letterSpacing: "-0.02em",
            textDecoration: "none",
            transition: "color 0.2s",
          }}
          onMouseEnter={e => (e.currentTarget.style.color = "#f5f5f5")}
          onMouseLeave={e => (e.currentTarget.style.color = "#888")}
        >
          {item.label}
          <span style={{ color: "#f5c518" }}>.</span>
        </a>
      ))}
    </div>
  );
}

export default function Nav() {
  const { lang, toggle } = useLang();
  const t = labels[lang];
  const [menuOpen, setMenuOpen] = useState(false);

  const closeMenu = () => setMenuOpen(false);

  return (
    <>
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "1.25rem 2rem",
          background:
            "linear-gradient(to bottom, rgba(10,10,10,0.9) 0%, transparent 100%)",
        }}
      >
        {/* ── デスクトップ: 左ロゴ ── */}
        <a
          href="#top"
          className="desktop-logo"
          style={{
            fontWeight: 900,
            fontSize: "1.25rem",
            letterSpacing: "-0.03em",
            color: "#f5f5f5",
          }}
        >
          hovinci<span style={{ color: "#f5c518" }}>.</span>
        </a>

        {/* ── モバイル: ハンバーガーボタン（左上） ── */}
        <button
          className="hamburger-btn"
          onClick={() => setMenuOpen(v => !v)}
          aria-label="メニュー"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "0.25rem",
            display: "none",
            zIndex: 60,
          }}
        >
          <HamburgerIcon open={menuOpen} />
        </button>

        {/* ── デスクトップ: 右側ナビリンク + 言語 ── */}
        <div
          className="desktop-nav"
          style={{ display: "flex", alignItems: "center", gap: "2rem" }}
        >
          {(
            [
              { href: "#writing", label: t.writing },
              { href: "#apps", label: t.apps },
              { href: "#membership", label: t.membership },
              { href: "#sns", label: t.sns },
            ] as const
          ).map(item => (
            <a
              key={item.href}
              href={item.href}
              style={{
                fontSize: "0.875rem",
                color: "#888",
                transition: "color 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.color = "#f5f5f5")}
              onMouseLeave={e => (e.currentTarget.style.color = "#888")}
            >
              {item.label}
            </a>
          ))}
          <LangButton lang={lang} toggle={toggle} />
        </div>

        {/* ── モバイル: 右上の言語ボタン ── */}
        <div className="mobile-lang" style={{ display: "none" }}>
          <LangButton lang={lang} toggle={toggle} />
        </div>
      </nav>

      {/* ── モバイルメニューオーバーレイ ── */}
      <MobileMenu
        open={menuOpen}
        lang={lang}
        onClose={closeMenu}
      />

      <style>{`
        @media (max-width: 768px) {
          .desktop-logo { display: none !important; }
          .desktop-nav  { display: none !important; }
          .hamburger-btn { display: block !important; }
          .mobile-lang   { display: block !important; }
        }
      `}</style>
    </>
  );
}
