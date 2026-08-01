"use client";

export default function ShowroomActions(props: {
  lineupId: string;
  allowDownloads: boolean;
}) {
  return (
    <div className="showroom-actions">
      <button type="button" onClick={() => window.print()}>
        PRINT LINE SHEET ↘
      </button>
      <button
        type="button"
        onClick={() =>
          document
            .getElementById(props.lineupId)
            ?.scrollIntoView({ behavior: "smooth" })
        }
      >
        {props.allowDownloads ? "VIEW & DOWNLOAD LOOKS ↓" : "VIEW LOOKS ↓"}
      </button>
    </div>
  );
}
