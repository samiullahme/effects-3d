"use client";

import { VideoApp } from "@/components/video-kit/app";

import { compositions } from "./compositions";

export default function VideoPlayer() {
  return <VideoApp compositions={compositions} />;
}
