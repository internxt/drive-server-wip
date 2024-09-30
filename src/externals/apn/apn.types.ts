export interface ApnAlert {
  title?: string;
  subtitle?: string;
  body?: string;
  launchImage?: string;
  titleLocKey?: string;
  titleLocArgs?: string[];
  subtitleLocKey?: string;
  subtitleLocArgs?: string[];
  locKey?: string;
  locArgs?: string[];
}
