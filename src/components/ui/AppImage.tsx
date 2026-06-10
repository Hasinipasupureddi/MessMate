const fallback =
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836";

type Props = {
  src?: string;
  alt?: string;
};

export default function AppImage({ src, alt }: Props) {
  const isValid = typeof src === "string" && src.startsWith("http");

  return (
    <img
      src={isValid ? src : fallback}
      alt={alt || "image"}
      onError={(e) => {
        (e.currentTarget as HTMLImageElement).src = fallback;
      }}
      style={{
        width: "100%",
        height: "200px",
        objectFit: "cover",
        borderRadius: "12px",
      }}
    />
  );
}