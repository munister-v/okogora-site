export interface Post {
  id: string;
  date: string;
  title: string;
  text: string;
  image: string;
  tags: string[];
  telegramUrl?: string;
}
