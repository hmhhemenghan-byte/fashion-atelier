"use client";

import { useState } from "react";

export default function PressActions({
  slug,
  downloadable,
}: {
  slug: string;
  downloadable: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="press-material-actions">
      <button type="button" onClick={() => window.print()}>
        PRINT / SAVE PDF <span>↗</span>
      </button>
      <button type="button" onClick={() => void copyLink()}>
        {copied ? "LINK COPIED" : "COPY RELEASE LINK"} <span>＋</span>
      </button>
      {downloadable && (
        <>
          <a href={`/api/press/${encodeURIComponent(slug)}?format=txt`}>
            PRESS TEXT <span>↓</span>
          </a>
          <a href={`/api/press/${encodeURIComponent(slug)}`}>
            PRESS DATA / JSON <span>↓</span>
          </a>
        </>
      )}
    </div>
  );
}
