/**
 * Type declarations for the 'techcrunch-api' module
 */

declare module 'techcrunch-api' {
  export interface TechCrunchArticle {
    title?: string;
    headline?: string;
    name?: string;
    link?: string;
    url?: string;
    href?: string;
    description?: string;
    summary?: string;
    excerpt?: string;
    content?: string;
    body?: string;
    text?: string;
    author?: string;
    writer?: string;
    date?: string;
    publishedDate?: string;
    pubDate?: string;
    [key: string]: any;
  }

  export interface TechCrunchResponse {
    data?: TechCrunchArticle[];
    articles?: TechCrunchArticle[];
  }

  export type TechCrunchResult = 
    | TechCrunchArticle[]
    | TechCrunchArticle
    | TechCrunchResponse;

  /**
   * Get articles by category
   * @param category - The category name (e.g., 'startups', 'venture', 'fintech')
   * @returns Promise resolving to articles or article data
   */
  export function getByCategory(category: string): Promise<TechCrunchResult>;

  /**
   * Get articles by tag
   * @param tag - The tag name (e.g., 'startup', 'funding', 'seed')
   * @returns Promise resolving to articles or article data
   */
  export function getByTag(tag: string): Promise<TechCrunchResult>;
}

