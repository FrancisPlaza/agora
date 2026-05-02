import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Google Fonts currently serves Source Serif 4 weight 600 as TTF (not
// woff2). Satori (which powers ImageResponse) accepts TTF directly. The
// version segment (`v14`) is content-hashed; if Google bumps the family
// the URL will 404. If that happens, bundle the file under
// `public/fonts/` and read it via `fs.readFile` instead.
const SOURCE_SERIF_4_600_URL =
  "https://fonts.gstatic.com/s/sourceserif4/v14/vEFy2_tTDB4M7-auWDN0ahZJW3IX2ih5nk3AucvUHf6OAVIJmeUDygwjisltrhw.ttf";

export default async function AppleIcon() {
  const fontData = await fetch(SOURCE_SERIF_4_600_URL).then((res) =>
    res.arrayBuffer(),
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0A2540",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 32,
          fontFamily: "Source Serif 4",
          color: "#FFFFFF",
          fontSize: 110,
          fontWeight: 600,
          letterSpacing: "-2.2px",
          // Capital A reads low because it has no descender; nudge the
          // glyph up by adding bottom padding to the flex container.
          paddingBottom: 8,
        }}
      >
        A
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Source Serif 4",
          data: fontData,
          weight: 600,
          style: "normal",
        },
      ],
    },
  );
}
