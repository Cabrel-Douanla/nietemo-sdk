/**
 * Nietemo BaaS Database Types & Interfaces
 */

export interface BaaSRecord {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export type NewBaaSRecord<T> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

export interface QueryOptions<T = any> {
  /**
   * Maximum number of documents to return (default: 50, max: 200)
   */
  limit?: number;

  /**
   * Number of documents to skip for pagination
   */
  offset?: number;

  /**
   * Field name to sort by
   */
  orderBy?: keyof T | string;

  /**
   * Sort direction
   */
  order?: 'asc' | 'desc';
}

export type FilterCondition<T = any> = {
  [K in keyof T]?: T[K] | any;
} & Record<string, any>;

export interface QueryResponse<T> {
  success: boolean;
  collection: string;
  total: number;
  records: T[];
  error?: string;
}

export interface SingleRecordResponse<T> {
  success: boolean;
  record?: T;
  error?: string;
}
