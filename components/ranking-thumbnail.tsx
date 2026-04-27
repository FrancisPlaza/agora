import { ArtPlaceholder } from "./art-placeholder";
import { getTopicArtUrl } from "@/lib/data/storage";
import type { TopicView } from "@/lib/data/topics";

interface RankingThumbnailProps {
  topic: TopicView;
  size?: number;
}

/**
 * Square artwork tile used inside ranking rows. Renders the real image
 * for published topics (signed URL with retina-resolution thumbnail
 * transform), tinted ArtPlaceholder otherwise. Per design correction #2,
 * never the prototype's single-letter affordance.
 */
export async function RankingThumbnail({
  topic,
  size = 36,
}: RankingThumbnailProps) {
  const px = size * 2; // retina request
  const artUrl =
    topic.state === "published" && topic.art_image_path
      ? await getTopicArtUrl(topic.art_image_path, { w: px, h: px })
      : null;

  return (
    <span
      className="block overflow-hidden rounded shrink-0"
      style={{ width: size, height: size }}
    >
      {artUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={artUrl}
          alt=""
          className="w-full h-full object-cover"
        />
      ) : (
        <ArtPlaceholder
          orderNum={topic.order_num}
          philosopher={topic.philosopher}
          theme={topic.theme}
          showLabel={false}
        />
      )}
    </span>
  );
}
