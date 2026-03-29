import React, { useEffect, useRef } from "react";
import { Platform, View, type ViewStyle } from "react-native";

interface Props {
  stream: MediaStream | null;
  style?: ViewStyle;
  muted?: boolean;
}

export function WebVideoElement({ stream, style, muted = true }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el && stream) {
      el.srcObject = stream;
    }
    return () => {
      if (el) el.srcObject = null;
    };
  }, [stream]);

  if (Platform.OS !== "web") {
    return null;
  }

  return (
    <View style={style}>
      {React.createElement("video", {
        ref: videoRef,
        autoPlay: true,
        playsInline: true,
        muted,
        style: {
          width: "100%",
          height: "100%",
          objectFit: "cover" as const,
        },
      })}
    </View>
  );
}
