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
