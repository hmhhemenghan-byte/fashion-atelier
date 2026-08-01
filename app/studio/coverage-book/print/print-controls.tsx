"use client";

export default function PrintControls() {
  return (
    <button type="button" onClick={() => window.print()}>
      打印 / 存为 PDF
    </button>
  );
}
