import type { AnyComposition } from "@/components/video-kit/composition";
import { templates } from "@/components/video-kit/templates";

/**
 * Every video the renderer can make. Built-in LaneSite formats come from the kit;
 * add custom compositions (e.g. ones built from library components) below.
 */
export const compositions: AnyComposition[] = [
  ...templates,
  // featureAccordion,
];
