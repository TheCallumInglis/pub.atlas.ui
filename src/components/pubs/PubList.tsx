import type { Pub } from "../../types/pub";

type PubListProps = {
  pubs: Pub[];
  activePubId: number | null;
  outlierIds: Set<number>;
  onSelect: (pubId: number) => void;
  setPubItemRef: (pubId: number, element: HTMLButtonElement | null) => void;
};

export default function PubList({
  pubs,
  activePubId,
  outlierIds,
  onSelect,
  setPubItemRef,
}: PubListProps) {
  return (
    <div className="pub-list" role="list" aria-label="Pubs">
      {pubs.map((pub, index) => (
        <button
          type="button"
          key={pub.id}
          ref={(element) => {
            setPubItemRef(pub.id, element);
          }}
          className={`pub-item${pub.id === activePubId ? " is-active" : ""}`}
          style={{ animationDelay: `${Math.min(index * 60, 360)}ms` }}
          onClick={() => onSelect(pub.id)}
          role="listitem"
        >
          <span>{pub.name}</span>
          <small>
            {pub.latitude == null || pub.longitude == null
              ? "Missing coordinates"
              : outlierIds.has(pub.id)
                ? "Outside Edinburgh"
                : pub.area ?? "Mapped"}
          </small>
        </button>
      ))}
    </div>
  );
}
