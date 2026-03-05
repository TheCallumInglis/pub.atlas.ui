import type { Pub } from "../../types/pub";

type SelectedPubCardProps = {
  pubItem: Pub;
  directionsUrl: string;
};

export default function SelectedPubCard({
  pubItem,
  directionsUrl,
}: SelectedPubCardProps) {
  return (
    <article className="selected-card">
      <p className="selected-card__area">{pubItem.area ?? "Edinburgh"}</p>
      <h2>{pubItem.name}</h2>
      <a href={directionsUrl} target="_blank" rel="noreferrer">
        Open in Google Maps
      </a>
    </article>
  );
}
