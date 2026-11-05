import type { ComponentType } from "react";

import type { FormatId } from "./core";

export type Composition<P extends object = Record<string, unknown>> = {
  /** url id: /video?id=<id> */
  id: string;
  title: string;
  /** what it is for, shown in the gallery and `render --list` */
  description: string;
  /** seconds; may depend on props */
  duration: number | ((props: P) => number);
  fps?: number;
  formats: FormatId[];
  defaultProps: P;
  component: ComponentType<P>;
  /** seconds, frame used for the thumbnail */
  poster?: number;
  background?: string;
};

export function defineComposition<P extends object>(c: Composition<P>): Composition<P> {
  return c;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyComposition = Composition<any>;
