export interface Post {
  id: string;
  date: string;
  title: string;
  text: string;
  image: string;
  tags: string[];
  telegramUrl?: string;
  imageMeta?: {
    source?: string;
    originalUrl?: string;
    bytes?: number;
    qualityFlag?: 'high' | 'medium' | 'low' | string;
    fetchedAt?: string;
  };
}

export interface InvestigationArticle {
  id: string;
  title: string;
  summary: string;
  code: string;
  url?: string;
  tags: string[];
  publishedAt: string;
  status?: 'draft' | 'published';
  contentMarkdown?: string;
  contentPath?: string;
}

export interface StrategicTarget {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  mapTitle: string;
  title: string;
  titleUk?: string;
  category: 'occupation' | 'airbase' | 'naval' | 'logistics' | 'strategic';
  region?: string;
  layerLabel?: string;
  position: [number, number];
  bbox?: [number, number, number, number];
  radiusMeters: number;
  note?: string;
  importedAt?: string;
  tags?: string[];
}
